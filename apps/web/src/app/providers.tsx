"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/core/theme/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
