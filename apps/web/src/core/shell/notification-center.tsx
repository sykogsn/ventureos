"use client";

import { Bell } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { IconButton } from "@/core/shell/icon-button";
import { Popover } from "@/core/shell/popover";

export function NotificationCenter() {
  const { isNotificationsOpen, toggleNotifications, closeNotifications } =
    useShell();

  return (
    <div className="relative">
      <IconButton
        aria-label="Notifications"
        aria-expanded={isNotificationsOpen}
        onClick={toggleNotifications}
      >
        <Bell className="ids-icon-sm" />
      </IconButton>
      <Popover
        open={isNotificationsOpen}
        onClose={closeNotifications}
        align="end"
        className="w-80"
      >
        <div className="ids-kicker px-2 py-2">Notifications</div>
        <p className="ids-body px-2 py-2 text-muted">
          There is no OS inbox yet. Founder calls appear in the Situation Room.
        </p>
      </Popover>
    </div>
  );
}
