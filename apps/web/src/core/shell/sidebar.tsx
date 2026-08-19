"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Brain, Building2, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/utils/cn";
import { listNavContributions } from "@/extensions";
import type { ExtensionIcon, NavContribution } from "@/extensions/types";
import type { NavSection } from "@/core/types";

const icons: Record<ExtensionIcon, typeof LayoutDashboard> = {
  "layout-dashboard": LayoutDashboard,
  "building-2": Building2,
  bot: Bot,
  brain: Brain,
  settings: Settings,
};

const sections: { id: NavSection; label: string }[] = [
  { id: "operate", label: "Operate" },
  { id: "intelligence", label: "Intelligence" },
  { id: "system", label: "System" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavContribution; pathname: string }) {
  const Icon = icons[item.icon];
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "ids-label ids-transition flex items-center gap-2 rounded-md px-2 py-2",
        active
          ? "bg-surface-muted text-foreground shadow-xs"
          : "text-muted hover:bg-surface-muted hover:text-foreground",
      )}
    >
      <Icon className="ids-icon-sm" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const items = listNavContributions();

  return (
    <aside className="z-sidebar flex w-[13.75rem] shrink-0 flex-col border-r border-border bg-surface lg:w-60">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/dashboard" className="ids-label">
          VentureOS
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3">
        {sections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section.id);

          if (sectionItems.length === 0) {
            return null;
          }

          return (
            <div key={section.id} className="flex flex-col gap-1">
              <p className="ids-kicker px-2 pb-1">
                {section.label}
              </p>
              {sectionItems.map((item) => (
                <NavLink key={item.id} item={item} pathname={pathname} />
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
