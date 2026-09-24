"use client";

import { useState, useTransition } from "react";
import { buildAuthenticatedFieldWorkspacePreload } from "@/modules/frigora/app/offline/preload-action";
import { openFrigoraOfflineStore } from "@/modules/frigora/app/offline/store";
import { FRIGORA_PRELOAD_STATUS_COPY } from "@/modules/frigora/app/pwa/copy";
import type { FrigoraOfflinePartition } from "@/modules/frigora/app/offline/types";

export function FieldWorkspacePreloadControl({
  ventureId,
  actorUserId,
}: {
  ventureId: string;
  actorUserId: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="vos-btn-secondary w-full sm:w-auto"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await buildAuthenticatedFieldWorkspacePreload(ventureId);
            if (!result.ok) {
              setError(result.error || FRIGORA_PRELOAD_STATUS_COPY.preloadFailed);
              return;
            }
            const partition: FrigoraOfflinePartition = {
              ventureId: result.package.partition.ventureId,
              actorUserId: result.package.partition.actorUserId,
            };
            if (
              partition.ventureId !== ventureId ||
              partition.actorUserId !== actorUserId
            ) {
              setError("Preload partition does not match the signed-in engineer.");
              return;
            }
            try {
              const store = await openFrigoraOfflineStore();
              await store.commitAuthenticatedPreload(partition, result.package.drafts, {
                asOf: result.package.asOf,
                generation: result.package.generation,
              });
              store.close();
              setMessage(FRIGORA_PRELOAD_STATUS_COPY.preloadSuccess);
            } catch (commitError) {
              setError(
                commitError instanceof Error
                  ? commitError.message
                  : FRIGORA_PRELOAD_STATUS_COPY.preloadFailed,
              );
            }
          });
        }}
      >
        {pending
          ? "Preloading…"
          : FRIGORA_PRELOAD_STATUS_COPY.preloadAction}
      </button>
      {message ? (
        <p className="ids-caption text-muted" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="ids-caption text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
