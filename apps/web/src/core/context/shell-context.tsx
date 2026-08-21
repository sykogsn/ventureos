"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

export function ShellProvider({
  children,
  user,
  workspaces,
  ventures,
  initialWorkspaceId,
}: {
  children: ReactNode;
  user: ShellUser;
  workspaces: WorkspaceRecord[];
  ventures: VentureRecord[];
  initialWorkspaceId: string | null;
}) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    initialWorkspaceId,
  );
  const [activeVentureId, setActiveVentureId] = useState<string | null>(null);
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("command");
  const [isNotificationsOpen, setNotificationsOpen] = useState(false);
  const [isNavOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setActiveWorkspaceId(initialWorkspaceId);
  }, [initialWorkspaceId]);

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
      user,
      workspaces,
      activeWorkspaceId,
      setActiveWorkspaceId,
      ventures,
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
      user,
      workspaces,
      ventures,
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
