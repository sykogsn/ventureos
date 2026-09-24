"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { shouldBlockFrigoraFieldMutation } from "@/modules/frigora/app/pwa/connectivity";
import { isFrigoraOfflineCaptureOperationAllowed } from "@/modules/frigora/app/offline/capture-gate";
import {
  FRIGORA_CONNECTIVITY_OFFLINE_BODY,
  FRIGORA_CONNECTIVITY_OFFLINE_TITLE,
  FRIGORA_CONNECTIVITY_RESTORED_BODY,
  FRIGORA_CONNECTIVITY_RESTORED_TITLE,
} from "@/modules/frigora/app/pwa/copy";
import { isFrigoraFieldPath } from "@/modules/frigora/app/pwa/paths";

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

export function FrigoraConnectivityBanner() {
  const pathname = usePathname();
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [restored, setRestored] = useState(false);
  const seenOffline = useRef(false);
  const blockMutations = shouldBlockFrigoraFieldMutation(online, pathname);

  useEffect(() => {
    if (!online) {
      seenOffline.current = true;
      setRestored(false);
      return;
    }
    if (!seenOffline.current) {
      return;
    }
    setRestored(true);
    const timer = window.setTimeout(() => setRestored(false), 6000);
    return () => window.clearTimeout(timer);
  }, [online]);

  useEffect(() => {
    if (!blockMutations) {
      document.documentElement.removeAttribute("data-frigora-offline");
      return;
    }
    document.documentElement.setAttribute("data-frigora-offline", "true");
    const onSubmit = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLFormElement) {
        const allowed = target.getAttribute("data-frigora-offline-capture");
        if (allowed && isFrigoraOfflineCaptureOperationAllowed(allowed)) {
          return;
        }
      }
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.documentElement.removeAttribute("data-frigora-offline");
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [blockMutations]);

  if (!isFrigoraFieldPath(pathname)) {
    return null;
  }

  if (online && !restored) {
    return null;
  }

  const title = online ? FRIGORA_CONNECTIVITY_RESTORED_TITLE : FRIGORA_CONNECTIVITY_OFFLINE_TITLE;
  const body = online ? FRIGORA_CONNECTIVITY_RESTORED_BODY : FRIGORA_CONNECTIVITY_OFFLINE_BODY;

  return (
    <div
      role={online ? "status" : "alert"}
      className="border-b border-border bg-surface px-[var(--ids-foundation-space-4)] py-[var(--ids-foundation-space-3)]"
    >
      <p className="ids-label text-foreground">{title}</p>
      <p className="ids-caption">{body}</p>
    </div>
  );
}
