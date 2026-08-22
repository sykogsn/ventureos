"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cluster } from "@/core/layout";
import { cn } from "@/utils/cn";

const items: { href: string; label: string; exact?: boolean }[] = [
  { href: "/engineering", label: "Dashboard", exact: true },
  { href: "/engineering/sprints", label: "Sprints" },
  { href: "/engineering/constitution", label: "Constitution" },
  { href: "/engineering/decisions", label: "Decisions" },
  { href: "/engineering/debt", label: "Debt" },
  { href: "/engineering/lessons", label: "Lessons" },
  { href: "/engineering/foundation", label: "Foundation" },
  { href: "/engineering/releases", label: "Releases" },
];

export function EngineeringNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Engineering HQ">
      <Cluster justify="start">
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
      </Cluster>
    </nav>
  );
}
