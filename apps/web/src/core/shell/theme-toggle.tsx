"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { IconButton } from "@/core/shell/icon-button";
import { useMounted } from "@/core/theme/theme-provider";

export function ThemeToggle() {
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return <span className="inline-flex h-8 w-8" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <IconButton
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="ids-icon-sm" /> : <Moon className="ids-icon-sm" />}
    </IconButton>
  );
}
