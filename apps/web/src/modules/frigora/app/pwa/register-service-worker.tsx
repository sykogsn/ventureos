"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  FRIGORA_PWA_SERVICE_WORKER_PATH,
  isFrigoraFieldPath,
} from "@/modules/frigora/app/pwa/paths";

export function RegisterFrigoraServiceWorker() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }
    if (!isFrigoraFieldPath(pathname)) {
      return;
    }
    void navigator.serviceWorker.register(FRIGORA_PWA_SERVICE_WORKER_PATH, {
      scope: "/",
      updateViaCache: "none",
    });
  }, [pathname]);

  return null;
}
