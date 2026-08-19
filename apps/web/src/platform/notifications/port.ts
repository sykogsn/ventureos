import type { Notification, NotificationId, NotificationPort, UserId } from "@/contracts";
import { createId, nowIso } from "@/platform/ids";

export function createNotificationPort(): NotificationPort {
  const items: Notification[] = [];

  return {
    async list(userId: UserId) {
      return items.filter((item) => !item.userId || item.userId === userId);
    },
    async push(notification) {
      const record: Notification = {
        ...notification,
        id: createId<NotificationId>(),
        createdAt: nowIso(),
        read: false,
      };
      items.push(record);
      return record;
    },
    async markRead(id) {
      const item = items.find((entry) => entry.id === id);
      if (item) {
        item.read = true;
      }
    },
  };
}
