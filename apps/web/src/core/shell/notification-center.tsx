"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { EmptyCopy } from "@/core/shell/empty-copy";
import { IconButton } from "@/core/shell/icon-button";
import { Popover } from "@/core/shell/popover";
import { Anchor, Fit, Inset } from "@/core/layout";

export function NotificationCenter() {
  const { isNotificationsOpen, toggleNotifications, closeNotifications } =
    useShell();

  return (
    <Anchor>
      <IconButton
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={isNotificationsOpen}
        onClick={toggleNotifications}
      >
        <Bell className="ids-icon-sm" aria-hidden="true" />
      </IconButton>
      <Popover
        open={isNotificationsOpen}
        onClose={closeNotifications}
        align="end"
        size="lg"
      >
        <p className="ids-kicker">Notifications</p>
        <Inset>
          <EmptyCopy
            title="No notifications"
            action={
              <Fit>
                <Link
                  href="/dashboard"
                  className="vos-btn-secondary"
                  onClick={closeNotifications}
                >
                  Open Executive Workspace
                </Link>
              </Fit>
            }
          >
            Founder calls appear in the Executive Workspace, not a separate inbox.
          </EmptyCopy>
        </Inset>
      </Popover>
    </Anchor>
  );
}
