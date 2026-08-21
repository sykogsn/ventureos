"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

const items: { href: string; label: string; exact?: boolean }[] = [
  { href: "/brain", label: "Dashboard", exact: true },
  { href: "/brain/governance", label: "Governance" },
  { href: "/brain/library", label: "Library" },
  { href: "/brain/decisions", label: "Decisions" },
  { href: "/brain/search", label: "Search" },
  { href: "/brain/health", label: "Health" },
];

export function BrainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Brain" className="flex flex-wrap gap-x-4 gap-y-2">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "ids-caption ids-transition",
              active ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
