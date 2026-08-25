import type { ReactNode } from "react";
import { ThemeToggle } from "@/core/shell/theme-toggle";
import { AuthEntranceShell } from "@/modules/auth/presentation";

export function ExecutiveAuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthEntranceShell themeControl={<ThemeToggle />}>{children}</AuthEntranceShell>
  );
}
