"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { IconButton } from "@/core/shell/icon-button";
import { ControlFace } from "@/core/layout";
import { useMounted } from "@/core/theme/theme-provider";

export function ThemeToggle() {
  const mounted = useMounted();
  const { resolvedTheme, setTheme } = useTheme();

  if (!mounted) {
    return <ControlFace />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <IconButton
      aria-label={
        isDark ? "Switch to Executive Light" : "Switch to Executive Dark"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="ids-icon-sm" aria-hidden="true" /> : <Moon className="ids-icon-sm" aria-hidden="true" />}
    </IconButton>
  );
}
