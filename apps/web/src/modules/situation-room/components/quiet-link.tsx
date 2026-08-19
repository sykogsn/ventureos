import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/utils/cn";

export function QuietLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "ids-label ids-transition inline-flex items-center text-foreground underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
    </Link>
  );
}
