import type { NotificationId, UserId, VentureId, WorkspaceId } from "./ids";

export type NotificationSource = "system" | "ai" | "intelligence";

export type Notification = {
  id: NotificationId;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
  source: NotificationSource;
  userId?: UserId;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
};

export type NotificationPort = {
  list(userId: UserId): Promise<Notification[]>;
  push(notification: Omit<Notification, "id" | "createdAt" | "read">): Promise<Notification>;
  markRead(id: NotificationId): Promise<void>;
};
