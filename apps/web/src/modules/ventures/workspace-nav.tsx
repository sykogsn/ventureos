"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { companyHomeHref } from "@/modules/ventures/home";
import { SurfaceTabFace, SurfaceTabs } from "@/core/layout";
import { buildVentureSurfaceLinks } from "@/modules/frigora/app/nav";

export function VentureWorkspaceNav({
  ventureId,
  slug,
  definitionId,
}: {
  ventureId: string;
  slug: string;
  definitionId: string;
}) {
  const pathname = usePathname();
  const links = buildVentureSurfaceLinks({
    ventureId,
    slug,
    definitionId,
    companyHomeHref: companyHomeHref(slug),
  });

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
