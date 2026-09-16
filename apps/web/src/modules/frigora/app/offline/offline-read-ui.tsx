"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  listAvailableOfflineWorkspaces,
  readOfflineWorkspaceSnapshot,
  type OfflineWorkspaceReadStatus,
} from "@/modules/frigora/app/offline/offline-read";
import { openFrigoraOfflineStore } from "@/modules/frigora/app/offline/store";
import type {
  FrigoraOfflinePartition,
  FrigoraOfflineWorkspaceSnapshot,
} from "@/modules/frigora/app/offline/types";
import { FRIGORA_PRELOAD_STATUS_COPY } from "@/modules/frigora/app/pwa/copy";

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

function statusCopy(status: OfflineWorkspaceReadStatus): string {
  switch (status) {
    case "AVAILABLE":
      return `${FRIGORA_PRELOAD_STATUS_COPY.viewingPreloaded}. ${FRIGORA_PRELOAD_STATUS_COPY.reconnectToRefresh}. ${FRIGORA_PRELOAD_STATUS_COPY.offlineChangesUnavailable}.`;
    case "EXPIRED":
      return FRIGORA_PRELOAD_STATUS_COPY.leaseExpired;
    case "MISSING":
      return FRIGORA_PRELOAD_STATUS_COPY.leaseMissing;
    case "WRONG_PARTITION":
      return FRIGORA_PRELOAD_STATUS_COPY.leaseMissing;
  }
}

export function FieldOfflineReadBanner({
  partition,
  workOrderId,
  visitId,
}: {
  partition: FrigoraOfflinePartition;
  workOrderId?: string;
  visitId?: string;
}) {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [status, setStatus] = useState<OfflineWorkspaceReadStatus | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (online) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const store = await openFrigoraOfflineStore();
      try {
        if (workOrderId) {
          const result = await readOfflineWorkspaceSnapshot(store, partition, workOrderId, {
            visitId,
          });
          if (!cancelled) {
            setStatus(result.status);
            setCount(result.status === "AVAILABLE" ? 1 : 0);
          }
        } else {
          const result = await listAvailableOfflineWorkspaces(store, partition);
          if (!cancelled) {
            setStatus(result.status);
            setCount(result.snapshots.length);
          }
        }
      } finally {
        store.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, partition, workOrderId, visitId]);

  if (online || !status) {
    return null;
  }

  return (
    <div
      className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] bg-[var(--ids-foundation-surface-subtle)] p-3"
      role="status"
    >
      <p className="ids-label text-foreground">
        {status === "AVAILABLE"
          ? FRIGORA_PRELOAD_STATUS_COPY.workspaceAvailable
          : FRIGORA_CONNECTIVITY_OFFLINE_TITLE_SAFE}
      </p>
      <p className="ids-caption text-muted">{statusCopy(status)}</p>
      {status === "AVAILABLE" && count > 0 ? (
        <p className="ids-caption text-muted">{count} preloaded job(s) on this device.</p>
      ) : null}
    </div>
  );
}

const FRIGORA_CONNECTIVITY_OFFLINE_TITLE_SAFE = "No connection";

export function useOfflineWorkspaceList(partition: FrigoraOfflinePartition) {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [status, setStatus] = useState<OfflineWorkspaceReadStatus | null>(null);
  const [snapshots, setSnapshots] = useState<FrigoraOfflineWorkspaceSnapshot[]>([]);

  useEffect(() => {
    if (online) {
      setStatus(null);
      setSnapshots([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const store = await openFrigoraOfflineStore();
      try {
        const result = await listAvailableOfflineWorkspaces(store, partition);
        if (!cancelled) {
          setStatus(result.status);
          setSnapshots(result.snapshots);
        }
      } finally {
        store.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, partition]);

  return { online, status, snapshots };
}

export function useOfflineWorkspaceSnapshot(
  partition: FrigoraOfflinePartition,
  workOrderId: string,
  visitId?: string,
) {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [status, setStatus] = useState<OfflineWorkspaceReadStatus | null>(null);
  const [snapshot, setSnapshot] = useState<FrigoraOfflineWorkspaceSnapshot | null>(null);
  const [leaseExpiresAt, setLeaseExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (online) {
      setStatus(null);
      setSnapshot(null);
      setLeaseExpiresAt(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const store = await openFrigoraOfflineStore();
      try {
        const before = await store.getLease(partition);
        const result = await readOfflineWorkspaceSnapshot(store, partition, workOrderId, {
          visitId,
        });
        const after = await store.getLease(partition);
        if (!cancelled) {
          setStatus(result.status);
          setSnapshot(
            result.status === "AVAILABLE" || result.status === "EXPIRED"
              ? result.snapshot ?? null
              : null,
          );
          setLeaseExpiresAt(after?.expiresAt ?? before?.expiresAt ?? null);
          // Prove read did not renew: expiresAt unchanged when both present.
          if (before && after && before.expiresAt !== after.expiresAt) {
            console.error("F33-02 invariant: offline read must not renew lease");
          }
        }
      } finally {
        store.close();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, partition, workOrderId, visitId]);

  return { online, status, snapshot, leaseExpiresAt };
}
