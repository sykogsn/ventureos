"use client";

import { LogOut, Sparkles } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { getAiRuntime } from "@/ai/runtime";
import { IconButton } from "@/core/shell/icon-button";
import { NotificationCenter } from "@/core/shell/notification-center";
import { ThemeToggle } from "@/core/shell/theme-toggle";
import { VentureSwitcher } from "@/core/shell/venture-switcher";
import { WorkspaceSwitcher } from "@/core/shell/workspace-switcher";
import { logoutAction } from "@/modules/auth/actions";

export function TopNav() {
  const { openPalette } = useShell();
  const runtime = getAiRuntime();

  return (
    <header className="ids-surface-toolbar z-topbar flex h-14 shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4">
      <WorkspaceSwitcher />
      <VentureSwitcher />
      <button
        type="button"
        onClick={() => openPalette("command")}
        className="vos-control ml-1 hidden min-w-0 flex-1 bg-background text-muted sm:flex"
      >
        <span className="truncate">Jump to a module or run a command</span>
        <kbd className="vos-kbd ml-auto">Ctrl+K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => openPalette("ai")}
          className="vos-btn-accent-control hidden md:inline-flex"
        >
          <Sparkles className="ids-icon-sm" />
          Ask
        </button>
        <IconButton
          className="md:hidden"
          aria-label="Ask VentureOS"
          onClick={() => openPalette("ai")}
        >
          <Sparkles className="ids-icon-sm" />
        </IconButton>
        <span
          className="ids-kicker hidden items-center px-2 lg:inline-flex"
          title={`AI runtime: ${runtime.status}`}
        >
          {runtime.status}
        </span>
        <NotificationCenter />
        <ThemeToggle />
        <form action={logoutAction}>
          <IconButton type="submit" aria-label="Sign out">
            <LogOut className="ids-icon-sm" />
          </IconButton>
        </form>
      </div>
    </header>
  );
}
