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

type ShellContextValue = {
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
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({
  children,
  workspaces,
  ventures,
  initialWorkspaceId,
}: {
  children: ReactNode;
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

  useEffect(() => {
    setActiveWorkspaceId(initialWorkspaceId);
  }, [initialWorkspaceId]);

  const openPalette = useCallback((mode: PaletteMode = "command") => {
    setPaletteMode(mode);
    setPaletteOpen(true);
    setNotificationsOpen(false);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
  }, []);

  const openNotifications = useCallback(() => {
    setNotificationsOpen(true);
    setPaletteOpen(false);
  }, []);

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsOpen((open) => {
      if (!open) {
        setPaletteOpen(false);
      }
      return !open;
    });
  }, []);

  const value = useMemo(
    () => ({
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
    }),
    [
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
