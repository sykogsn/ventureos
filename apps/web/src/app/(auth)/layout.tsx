import type { ReactNode } from "react";
import { ExecutiveAuthShell } from "@/modules/auth/executive-auth-shell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <ExecutiveAuthShell>{children}</ExecutiveAuthShell>;
}
