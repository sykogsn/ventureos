"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search, Sparkles, X } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { getAiRuntime } from "@/ai/runtime";
import { aiRuntimeStatusLabel } from "@/ai/status-label";
import { IconButton } from "@/core/shell/icon-button";
import { NotificationCenter } from "@/core/shell/notification-center";
import { ProfileMenu } from "@/core/shell/profile-menu";
import { ThemeToggle } from "@/core/shell/theme-toggle";
import { VentureSwitcher } from "@/core/shell/venture-switcher";
import { WorkspaceSwitcher } from "@/core/shell/workspace-switcher";
import { Cluster, Fill, Grow, Reveal, Toolbar, Trailing } from "@/core/layout";
import { FRIGORA_PWA_NAME } from "@/modules/frigora/app/pwa/copy";
import {
  FRIGORA_PWA_START_PATH,
  isFrigoraCustomerPath,
} from "@/modules/frigora/app/pwa/paths";

export function TopNav() {
  const pathname = usePathname() ?? "";
  const frigoraCustomer = isFrigoraCustomerPath(pathname);
  const { openPalette, isNavOpen, toggleNav } = useShell();
  const runtime = getAiRuntime();
  const runtimeLabel = aiRuntimeStatusLabel(runtime.status);

  if (frigoraCustomer) {
    return (
      <Toolbar>
        <Link
          href={FRIGORA_PWA_START_PATH}
          className="ids-kicker ids-transition text-foreground"
        >
          {FRIGORA_PWA_NAME}
        </Link>
        <Grow>
          <span className="ids-caption text-muted truncate">
            Field operations
          </span>
        </Grow>
        <Trailing>
          <ThemeToggle />
          <ProfileMenu />
        </Trailing>
      </Toolbar>
    );
  }

  return (
    <Toolbar>
      <Reveal on="hide-lg">
        <IconButton
          aria-label={isNavOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isNavOpen}
          aria-controls="primary-navigation"
          onClick={toggleNav}
        >
          {isNavOpen ? <X className="ids-icon-sm" aria-hidden="true" /> : <Menu className="ids-icon-sm" aria-hidden="true" />}
        </IconButton>
      </Reveal>
      <WorkspaceSwitcher />
      <Reveal on="show-sm">
        <VentureSwitcher />
      </Reveal>
      <Grow>
        <Fill>
          <button
            type="button"
            onClick={() => openPalette("command")}
            aria-label="Search commands"
            aria-keyshortcuts="Control+K"
            className="vos-control bg-background text-muted"
          >
            <Cluster justify="between" wrap={false}>
              <span className="truncate">Jump to a module or run a command</span>
              <kbd className="vos-kbd">Ctrl+K</kbd>
            </Cluster>
          </button>
        </Fill>
      </Grow>
      <Trailing>
        <Reveal on="hide-sm">
          <IconButton
            aria-label="Search commands"
            onClick={() => openPalette("command")}
          >
            <Search className="ids-icon-sm" aria-hidden="true" />
          </IconButton>
        </Reveal>
        <Reveal on="show-md">
          <button
            type="button"
            onClick={() => openPalette("ai")}
            className="vos-btn-accent-control"
          >
            <Sparkles className="ids-icon-sm" aria-hidden="true" />
            Ask
          </button>
        </Reveal>
        <Reveal on="hide-md">
          <IconButton
            aria-label="Ask VentureOS"
            onClick={() => openPalette("ai")}
          >
            <Sparkles className="ids-icon-sm" aria-hidden="true" />
          </IconButton>
        </Reveal>
        <Reveal on="show-lg">
          <span className="ids-kicker" title={`AI runtime: ${runtimeLabel}`}>
            {runtimeLabel}
          </span>
        </Reveal>
        <Reveal on="show-sm">
          <NotificationCenter />
        </Reveal>
        <ThemeToggle />
        <ProfileMenu />
      </Trailing>
    </Toolbar>
  );
}
