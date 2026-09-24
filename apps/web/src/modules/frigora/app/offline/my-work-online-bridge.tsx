"use client";

import type { ReactNode } from "react";
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
  if (!online) {
    return null;
  }
  return <>{children}</>;
}
