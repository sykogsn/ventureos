"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";
import { companyHomeHref } from "@/modules/ventures/home";

export function VentureWorkspaceNav({
  ventureId,
  slug,
}: {
  ventureId: string;
  slug: string;
}) {
  const pathname = usePathname();
  const base = `/ventures/${ventureId}`;
  const links = [
    { href: companyHomeHref(slug), label: "Company HQ", match: "exact" as const },
    { href: `${base}/agents`, label: "Executive Office", match: "prefix" as const },
    { href: `${base}/documents`, label: "Documents", match: "exact" as const },
    { href: `${base}/crm`, label: "CRM", match: "exact" as const },
    { href: `${base}/finance`, label: "Finance", match: "exact" as const },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-3 sm:px-4">
      {links.map((item) => {
        const active =
          item.match === "prefix"
            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
            : pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "ids-label ids-transition shrink-0 px-3 py-3",
              active
                ? "border-b-2 border-accent text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
