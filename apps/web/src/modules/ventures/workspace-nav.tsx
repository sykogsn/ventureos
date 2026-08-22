"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { companyHomeHref } from "@/modules/ventures/home";
import { SurfaceTabFace, SurfaceTabs } from "@/core/layout";

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
    <SurfaceTabs label="Company surfaces">
      {links.map((item) => {
        const active =
          item.match === "prefix"
            ? pathname === item.href || pathname.startsWith(`${item.href}/`)
            : pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
          >
            <SurfaceTabFace active={active}>{item.label}</SurfaceTabFace>
          </Link>
        );
      })}
    </SurfaceTabs>
  );
}
