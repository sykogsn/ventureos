"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Semantic VentureOS entity link.
 *
 * A venture supplies the destination. When no supported destination exists,
 * the value remains ordinary text rather than becoming a placeholder or dead
 * link.
 */
export function EntityLink({
  href,
  children,
  label,
}: {
  href?: string | null;
  children: ReactNode;
  label?: string;
}) {
  if (!href) {
    return <>{children}</>;
  }

  return (
    <Link href={href} className="vos-entity-link break-words" aria-label={label}>
      {children}
    </Link>
  );
}
