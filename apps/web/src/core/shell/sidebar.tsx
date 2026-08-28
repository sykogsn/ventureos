"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Brain, Building2, DraftingCompass, LayoutDashboard, Settings, Users } from "lucide-react";
import { useShell } from "@/core/context/shell-context";
import { listNavContributions } from "@/extensions";
import type { ExtensionIcon, NavContribution } from "@/extensions/types";
import type { NavSection } from "@/core/types";
import { VentureMark } from "@/core/shell/venture-mark";
import {
  NavigationBrand,
  NavigationItem,
  NavigationMenu,
  NavigationRail,
  NavigationSection,
} from "@/core/layout";

const icons: Record<ExtensionIcon, typeof LayoutDashboard> = {
  "layout-dashboard": LayoutDashboard,
  "building-2": Building2,
  users: Users,
  bot: Bot,
  brain: Brain,
  settings: Settings,
  "drafting-compass": DraftingCompass,
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

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavContribution;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = icons[item.icon];
  const active = isActive(pathname, item.href);

  return (
    <NavigationItem href={item.href} current={active} onNavigate={onNavigate}>
      <Icon className="ids-icon-sm" aria-hidden="true" />
      {item.label}
    </NavigationItem>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isNavOpen, closeNav } = useShell();
  const items = listNavContributions();

  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

  return (
    <NavigationRail open={isNavOpen} onDismiss={closeNav}>
      <NavigationBrand>
        <Link
          href="/dashboard"
          className="ids-transition text-foreground"
          onClick={closeNav}
        >
          <VentureMark compact />
        </Link>
      </NavigationBrand>
      <NavigationMenu>
        {sections.map((section) => {
          const sectionItems = items.filter((item) => item.section === section.id);

          if (sectionItems.length === 0) {
            return null;
          }

          return (
            <NavigationSection key={section.id} label={section.label}>
              {sectionItems.map((item) => (
                <NavLink
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  onNavigate={closeNav}
                />
              ))}
            </NavigationSection>
          );
        })}
      </NavigationMenu>
    </NavigationRail>
  );
}
