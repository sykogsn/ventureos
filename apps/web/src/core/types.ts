import type { NavSection, Notification, WorkspaceId } from "@/contracts";

export type { WorkspaceId };

export type Workspace = {
  id: WorkspaceId;
  name: string;
};

export type ThemePreference = "light" | "dark" | "system";

export type PaletteMode = "command" | "ai";

export type { NavSection };

export type OsNotification = Notification;

export type CoreCommandAction =
  | "theme.toggle"
  | "theme.light"
  | "theme.dark"
  | "theme.system"
  | "palette.open"
  | "palette.ai"
  | "notifications.open";
