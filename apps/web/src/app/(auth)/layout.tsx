import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-4 py-10">
      <div className="vos-panel w-full max-w-sm p-6 sm:p-8">{children}</div>
    </div>
  );
}
