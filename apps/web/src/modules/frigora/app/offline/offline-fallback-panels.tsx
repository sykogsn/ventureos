"use client";

import Link from "next/link";
import { Stack } from "@/core/layout";
import {
  FieldOfflineReadBanner,
  useOfflineWorkspaceList,
  useOfflineWorkspaceSnapshot,
} from "@/modules/frigora/app/offline/offline-read-ui";
import type { FrigoraOfflinePartition } from "@/modules/frigora/app/offline/types";
import { FRIGORA_PRELOAD_STATUS_COPY } from "@/modules/frigora/app/pwa/copy";

function textValue(value: unknown, fallback = "—"): string {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

export function OfflineMyWorkFallback({
  partition,
  basePath,
}: {
  partition: FrigoraOfflinePartition;
  basePath: string;
}) {
  const { online, status, snapshots } = useOfflineWorkspaceList(partition);
  if (online) {
    return null;
  }

  const uniqueByWorkOrder = new Map(
    snapshots.map((snapshot) => [snapshot.workOrderId, snapshot]),
  );

  return (
    <Stack gap="compact">
      <FieldOfflineReadBanner partition={partition} />
      {status === "AVAILABLE" && uniqueByWorkOrder.size > 0 ? (
        <Stack gap="compact">
          {[...uniqueByWorkOrder.values()].map((snapshot) => {
            const wo = snapshot.payload.workOrder;
            const customer = snapshot.payload.customer;
            const site = snapshot.payload.site;
            const visitId =
              snapshot.visitId ??
              (typeof snapshot.payload.visit?.id === "string"
                ? snapshot.payload.visit.id
                : undefined);
            const href = visitId
              ? `${basePath}/${snapshot.workOrderId}/visit/${visitId}`
              : `${basePath}/${snapshot.workOrderId}`;
            return (
              <article
                key={snapshot.snapshotId}
                className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4"
              >
                <Stack gap="tight">
                  <p className="ids-caption text-muted">
                    {FRIGORA_PRELOAD_STATUS_COPY.viewingPreloaded}
                  </p>
                  <p className="ids-label text-foreground">
                    {textValue(wo?.workReference, snapshot.workOrderId)}
                  </p>
                  <p className="ids-caption text-muted">
                    {textValue(customer?.displayName)} · {textValue(site?.name)}
                  </p>
                  <Link href={href} className="vos-btn-secondary w-full sm:w-auto">
                    Open preloaded job
                  </Link>
                </Stack>
              </article>
            );
          })}
        </Stack>
      ) : (
        <p className="ids-caption text-muted" role="status">
          {status === "EXPIRED"
            ? FRIGORA_PRELOAD_STATUS_COPY.leaseExpired
            : FRIGORA_PRELOAD_STATUS_COPY.leaseMissing}
        </p>
      )}
    </Stack>
  );
}

export function OfflineWorkOrderFallback({
  partition,
  workOrderId,
}: {
  partition: FrigoraOfflinePartition;
  workOrderId: string;
}) {
  const { online, status, snapshot } = useOfflineWorkspaceSnapshot(partition, workOrderId);
  if (online) {
    return <FieldOfflineReadBanner partition={partition} workOrderId={workOrderId} />;
  }

  return (
    <Stack gap="compact">
      <FieldOfflineReadBanner partition={partition} workOrderId={workOrderId} />
      {status === "AVAILABLE" && snapshot ? (
        <div className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4">
          <p className="ids-caption text-muted">
            {FRIGORA_PRELOAD_STATUS_COPY.viewingPreloaded}
          </p>
          <p className="ids-label text-foreground">
            {textValue(snapshot.payload.workOrder?.workReference, workOrderId)}
          </p>
          <p className="ids-body text-muted">
            {textValue(snapshot.payload.customer?.displayName)} ·{" "}
            {textValue(snapshot.payload.site?.name)}
          </p>
          <p className="ids-caption text-muted">
            Asset: {textValue(snapshot.payload.asset?.tag)}
          </p>
          <p className="ids-caption text-muted">
            {FRIGORA_PRELOAD_STATUS_COPY.offlineChangesUnavailable}
          </p>
        </div>
      ) : null}
    </Stack>
  );
}

export function OfflineVisitFallback({
  partition,
  workOrderId,
  visitId,
}: {
  partition: FrigoraOfflinePartition;
  workOrderId: string;
  visitId: string;
}) {
  const { online, status, snapshot } = useOfflineWorkspaceSnapshot(
    partition,
    workOrderId,
    visitId,
  );
  if (online) {
    return (
      <FieldOfflineReadBanner
        partition={partition}
        workOrderId={workOrderId}
        visitId={visitId}
      />
    );
  }

  return (
    <Stack gap="compact">
      <FieldOfflineReadBanner
        partition={partition}
        workOrderId={workOrderId}
        visitId={visitId}
      />
      {status === "AVAILABLE" && snapshot ? (
        <div className="rounded-[var(--ids-foundation-radius-md)] border border-[var(--ids-foundation-stroke-subtle)] p-4">
          <p className="ids-caption text-muted">
            {FRIGORA_PRELOAD_STATUS_COPY.viewingPreloaded}
          </p>
          <p className="ids-label text-foreground">
            Visit {textValue(snapshot.payload.visit?.id, visitId)}
          </p>
          <p className="ids-body text-muted">
            {textValue(snapshot.payload.workOrder?.workReference)} ·{" "}
            {textValue(snapshot.payload.site?.name)}
          </p>
          <p className="ids-caption text-muted">
            History items:{" "}
            {Array.isArray(snapshot.payload.history) ? snapshot.payload.history.length : 0}
          </p>
          <p className="ids-caption text-muted">
            {FRIGORA_PRELOAD_STATUS_COPY.offlineChangesUnavailable}
          </p>
        </div>
      ) : null}
    </Stack>
  );
}
