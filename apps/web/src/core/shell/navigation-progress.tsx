"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { OverlayPulse } from "@/core/layout";

export function NavigationProgress() {
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusy(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      if (link.target === "_blank" || link.hasAttribute("download")) {
        return;
      }

      const next = new URL(link.href, window.location.href);
      if (next.origin !== window.location.origin) {
        return;
      }

      if (
        next.pathname === window.location.pathname &&
        next.search === window.location.search
      ) {
        return;
      }

      setBusy(true);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!busy) {
    return null;
  }

  return <OverlayPulse />;
}
