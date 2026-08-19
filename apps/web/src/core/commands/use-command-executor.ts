"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useShell } from "@/core/context/shell-context";
import type { CommandContribution } from "@/extensions/types";

export function useCommandExecutor() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { openPalette, openNotifications } = useShell();

  return (command: CommandContribution) => {
    if (command.href) {
      router.push(command.href);
    }

    switch (command.action) {
      case "palette.open":
        openPalette("command");
        break;
      case "palette.ai":
        openPalette("ai");
        break;
      case "notifications.open":
        openNotifications();
        break;
      case "theme.toggle":
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        break;
      case "theme.light":
        setTheme("light");
        break;
      case "theme.dark":
        setTheme("dark");
        break;
      case "theme.system":
        setTheme("system");
        break;
      default:
        break;
    }
  };
}
