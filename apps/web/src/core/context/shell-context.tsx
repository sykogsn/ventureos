"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PaletteMode } from "@/core/types";
import type { WorkspaceRecord } from "@/modules/workspaces/service";
import type { VentureRecord } from "@/modules/ventures/service";

export type ShellUser = {
  name: string;
  email: string;
};

type ShellContextValue = {
  user: ShellUser;
  workspaces: WorkspaceRecord[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  ventures: VentureRecord[];
  activeVentureId: string | null;
  setActiveVentureId: (id: string | null) => void;
  isPaletteOpen: boolean;
  paletteMode: PaletteMode;
  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
  isNotificationsOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  toggleNotifications: () => void;
  isNavOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
  toggleNav: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

function sameUser(left: ShellUser, right: ShellUser) {
  return left.name === right.name && left.email === right.email;
}

function sameWorkspaces(
  left: WorkspaceRecord[],
  right: WorkspaceRecord[],
) {
  return (
    left.length === right.length &&
    left.every(
      (workspace, index) =>
        workspace.id === right[index]?.id &&
        workspace.name === right[index]?.name &&
        workspace.slug === right[index]?.slug,
    )
  );
}

function sameVentures(left: VentureRecord[], right: VentureRecord[]) {
  return (
    left.length === right.length &&
    left.every(
      (venture, index) =>
        venture.id === right[index]?.id &&
        venture.workspaceId === right[index]?.workspaceId &&
        venture.name === right[index]?.name &&
        venture.slug === right[index]?.slug &&
        venture.definitionId === right[index]?.definitionId &&
        venture.definitionVersion === right[index]?.definitionVersion,
    )
  );
}

function useStableValue<T>(value: T, equal: (left: T, right: T) => boolean) {
  const ref = useRef(value);
  if (!equal(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

export function ShellProvider({
  children,
  user,
  workspaces,
  ventures,
  initialWorkspaceId,
  initialVentureId,
}: {
  children: ReactNode;
  user: ShellUser;
  workspaces: WorkspaceRecord[];
  ventures: VentureRecord[];
  initialWorkspaceId: string | null;
  initialVentureId: string | null;
}) {
  const stableUser = useStableValue(user, sameUser);
  const stableWorkspaces = useStableValue(workspaces, sameWorkspaces);
  const stableVentures = useStableValue(ventures, sameVentures);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    initialWorkspaceId,
  );
  const [activeVentureId, setActiveVentureId] = useState<string | null>(
    initialVentureId,
  );
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("command");
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isNavOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setActiveWorkspaceId(initialWorkspaceId);
  }, [initialWorkspaceId]);

  useEffect(() => {
    setActiveVentureId(initialVentureId);
  }, [initialVentureId]);

  const openPalette = useCallback((mode: PaletteMode = "command") => {
    setPaletteMode(mode);
    setPaletteOpen(true);
    setNotificationsOpen(false);
    setNavOpen(false);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
  }, []);

  const openNotifications = useCallback(() => {
    setNotificationsOpen(true);
    setPaletteOpen(false);
    setNavOpen(false);
  }, []);

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsOpen((open) => {
      if (!open) {
        setPaletteOpen(false);
        setNavOpen(false);
      }
      return !open;
    });
  }, []);

  const openNav = useCallback(() => {
    setNavOpen(true);
    setPaletteOpen(false);
    setNotificationsOpen(false);
  }, []);

  const closeNav = useCallback(() => {
    setNavOpen(false);
  }, []);

  const toggleNav = useCallback(() => {
    setNavOpen((open) => {
      if (!open) {
        setPaletteOpen(false);
        setNotificationsOpen(false);
      }
      return !open;
    });
  }, []);

  const value = useMemo(
    () => ({
      user: stableUser,
      workspaces: stableWorkspaces,
      activeWorkspaceId,
      setActiveWorkspaceId,
      ventures: stableVentures,
      activeVentureId,
      setActiveVentureId,
      isPaletteOpen,
      paletteMode,
      openPalette,
      closePalette,
      isNotificationsOpen,
      openNotifications,
      closeNotifications,
      toggleNotifications,
      isNavOpen,
      openNav,
      closeNav,
      toggleNav,
    }),
    [
      stableUser,
      stableWorkspaces,
      stableVentures,
      activeWorkspaceId,
      activeVentureId,
      isPaletteOpen,
      paletteMode,
      openPalette,
      closePalette,
      isNotificationsOpen,
      openNotifications,
      closeNotifications,
      toggleNotifications,
      isNavOpen,
      openNav,
      closeNav,
      toggleNav,
    ],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function useShell() {
  const context = useContext(ShellContext);

  if (!context) {
    throw new Error("useShell must be used within ShellProvider");
  }

  return context;
}
