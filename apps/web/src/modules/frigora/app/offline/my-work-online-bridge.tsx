"use client";

import type { ReactNode } from "react";
import { FRIGORA_F33_OFFLINE_RUNTIME_ENABLED } from "@/modules/frigora/app/offline/runtime-gate";
import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

/** Hides live SSR My Work list while disconnected so preloaded fallback is primary. */
export function MyWorkOnlineList({ children }: { children: ReactNode }) {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!FRIGORA_F33_OFFLINE_RUNTIME_ENABLED) {
    return <>{children}</>;
  }
  if (!online) {
    return null;
  }
  return <>{children}</>;
}
