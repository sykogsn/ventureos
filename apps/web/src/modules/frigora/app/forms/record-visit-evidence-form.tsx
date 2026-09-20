"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  FRIGORA_EVIDENCE_ONLINE_NOTE,
  FRIGORA_VISIT_EVIDENCE_STATUS_COPY,
} from "@/modules/frigora/app/pwa/copy";
import { FRIGORA_VISIT_EVIDENCE_CATEGORIES } from "@/modules/frigora/types";
import {
  recordVisitEvidenceFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";
import {
  type FrigoraOfflineMutationEnvelope,
} from "@/modules/frigora/app/offline";
import {
  captureVisitEvidenceOffline,
  createVisitEvidenceClientOperationId,
  listVisitEvidenceMutations,
  loadPersistedEvidenceBlobForSubmit,
  markEvidenceBlobAwaitingAcceptance,
} from "@/modules/frigora/app/offline/visit-evidence-capture";
import {
  submitPendingVisitEvidenceFormAction,
  type ExplicitVisitEvidenceSubmitState,
} from "@/modules/frigora/app/offline/visit-evidence-submit-action";

import { canExplicitlySubmitOffline, saveOfflineOnce, submitOfflineFromClient } from "@/modules/frigora/app/offline/offline-client-actions";

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

function categoryLabel(category: string) {
  return category.replace(/_/g, " ").toLowerCase();
}

function statusLabel(state: FrigoraOfflineMutationEnvelope["syncState"], online: boolean): string {
  switch (state) {
    case "LOCAL_DRAFT":
    case "PENDING":
      return online
        ? FRIGORA_VISIT_EVIDENCE_STATUS_COPY.readyToSubmit
        : FRIGORA_VISIT_EVIDENCE_STATUS_COPY.savedOnDevice;
    case "SYNCING":
      return "Submission status needs reconciliation. Retry when online.";
    case "SYNCED":
      return FRIGORA_VISIT_EVIDENCE_STATUS_COPY.acceptedByServer;
    case "BLOCKED":
      return FRIGORA_VISIT_EVIDENCE_STATUS_COPY.blocked;
    case "CONFLICT":
      return FRIGORA_VISIT_EVIDENCE_STATUS_COPY.conflict;
    case "RETRYABLE_FAILURE":
      return FRIGORA_VISIT_EVIDENCE_STATUS_COPY.retryable;
  }
}

export function RecordVisitEvidenceForm({
  workspaceId,
  ventureId,
  workOrderId,
  visitId,
  primaryAssetId,
  actorUserId,
}: {
  workspaceId: string;
  ventureId: string;
  workOrderId: string;
  visitId: string;
  primaryAssetId: string | null;
  actorUserId: string;
}) {
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const [onlineState, onlineAction, onlinePending] = useActionState(
    recordVisitEvidenceFormAction,
    {} as FieldFormState,
  );
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlinePending, startOfflineTransition] = useTransition();
  const offlineSaveInFlight = useRef(false);
  const [pendingOps, setPendingOps] = useState<FrigoraOfflineMutationEnvelope[]>([]);

  async function refreshPending() {
    const ops = await listVisitEvidenceMutations(
      { ventureId, actorUserId },
      { workOrderId, visitId },
    );
    setPendingOps(ops);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ops = await listVisitEvidenceMutations(
        { ventureId, actorUserId },
        { workOrderId, visitId },
      );
      if (!cancelled) setPendingOps(ops);
    })();
    return () => {
      cancelled = true;
    };
  }, [ventureId, actorUserId, workOrderId, visitId, online]);

  function onOfflineSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    const data = new FormData(form);
    const category = String(data.get("category") ?? "TECHNICAL");
    const description = String(data.get("description") ?? "");
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setOfflineError("A photo or file is required.");
      return;
    }
    setOfflineError(null);
    startOfflineTransition(async () => {
      await saveOfflineOnce(offlineSaveInFlight, async () => {
        try {
          const bytes = await file.arrayBuffer();
          await captureVisitEvidenceOffline({
            partition: { ventureId, actorUserId },
            workspaceId,
            workOrderId,
            visitId,
            payload: {
              category,
              description: description.length > 0 ? description : null,
              originalFilename: file.name || "evidence.bin",
              mimeType: file.type || "application/octet-stream",
              assetId: primaryAssetId ?? null,
              bytes,
            },
            clientOperationId: createVisitEvidenceClientOperationId(),
            syncState: "PENDING",
          });
          form.reset();
          await refreshPending();
        } catch (error) {
          setOfflineError(error instanceof Error ? error.message : "Could not save on this device.");
        }
      });
    });
  }

  return (
    <Stack gap="tight">
      {online ? (
        <Form action={onlineAction} encType="multipart/form-data" gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="ventureId" value={ventureId} />
          <input type="hidden" name="workOrderId" value={workOrderId} />
          <input type="hidden" name="visitId" value={visitId} />
          {primaryAssetId ? <input type="hidden" name="assetId" value={primaryAssetId} /> : null}
          <Stack gap="tight">
            <p className="ids-caption text-muted">
              Evidence recorded here supports provenance and traceability only.
              {` ${FRIGORA_EVIDENCE_ONLINE_NOTE}`}
            </p>
            <EvidenceFields
              defaultCategory={onlineState.values?.category}
              defaultDescription={onlineState.values?.description}
            />
            {onlineState.error ? (
              <p className="ids-caption text-danger" role="alert">
                {onlineState.error}
              </p>
            ) : null}
            {onlinePending ? (
              <p className="ids-caption text-muted" role="status">
                Uploading evidence…
              </p>
            ) : null}
            <Button type="submit" disabled={onlinePending} className="w-full sm:w-auto">
              {onlinePending ? "Uploading…" : "Record evidence"}
            </Button>
          </Stack>
        </Form>
      ) : (
        <form
          data-frigora-offline-capture="recordVisitEvidence"
          onSubmit={onOfflineSubmit}
          className="flex flex-col gap-[var(--ids-foundation-space-3)]"
        >
          <p className="ids-caption text-muted" role="status">
            {FRIGORA_VISIT_EVIDENCE_STATUS_COPY.offlineCaptureHint}
          </p>
          <EvidenceFields />
          {offlineError ? (
            <p className="ids-caption text-danger" role="alert">
              {offlineError}
            </p>
          ) : null}
          <Button type="submit" disabled={offlinePending} className="w-full sm:w-auto">
            {offlinePending ? "Saving on device…" : "Save on this device"}
          </Button>
        </form>
      )}

      {pendingOps.length > 0 ? (
        <Stack gap="tight">
          <p className="ids-label text-foreground">Pending on this device</p>
          {pendingOps.map((op) => (
            <PendingVisitEvidenceRow
              key={op.clientOperationId}
              envelope={op}
              workspaceId={workspaceId}
              online={online}
              onChanged={refreshPending}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

function EvidenceFields({
  defaultCategory,
  defaultDescription,
}: {
  defaultCategory?: string;
  defaultDescription?: string;
}) {
  return (
    <Stack gap="tight">
      <Field>
        Category
        <select
          name="category"
          required
          className="vos-field"
          defaultValue={defaultCategory ?? "TECHNICAL"}
        >
          {FRIGORA_VISIT_EVIDENCE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {categoryLabel(category)}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        Description (required for OTHER)
        <textarea
          name="description"
          rows={2}
          className="vos-field"
          defaultValue={defaultDescription ?? ""}
        />
      </Field>
      <Field>
        Photo or file
        <input
          name="file"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
          capture="environment"
          className="vos-field vos-file-field"
        />
      </Field>
    </Stack>
  );
}

function PendingVisitEvidenceRow({
  envelope,
  workspaceId,
  online,
  onChanged,
}: {
  envelope: FrigoraOfflineMutationEnvelope;
  workspaceId: string;
  online: boolean;
  onChanged: () => Promise<void>;
}) {
  const [state, setState] = useState<ExplicitVisitEvidenceSubmitState>({});
  const submitInFlight = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmitTransition] = useTransition();
  const payload = envelope.payload;
  const category = String(payload.category ?? "");
  const description = typeof payload.description === "string" ? payload.description : "";
  const originalFilename = String(payload.originalFilename ?? "evidence.bin");
  const mimeType = String(payload.mimeType ?? "application/octet-stream");
  const assetId = typeof payload.assetId === "string" ? payload.assetId : "";

  const canSubmit = canExplicitlySubmitOffline(envelope.syncState, online);

  function onExplicitSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setSubmitError(null);
    startSubmitTransition(async () => {
      await saveOfflineOnce(submitInFlight, async () => {
        try {
          const blob = await loadPersistedEvidenceBlobForSubmit(envelope);
          await markEvidenceBlobAwaitingAcceptance(blob.blobId);
          const formData = new FormData();
          formData.set("workspaceId", workspaceId);
          formData.set("ventureId", envelope.ventureId);
          formData.set("workOrderId", envelope.workOrderId);
          formData.set("visitId", envelope.visitId ?? "");
          formData.set("clientOperationId", envelope.clientOperationId);
          formData.set("category", category);
          formData.set("description", description);
          formData.set("originalFilename", originalFilename);
          formData.set("mimeType", mimeType);
          formData.set("assetId", assetId);
          formData.set("actorUserId", envelope.actorUserId);
          formData.set(
            "file",
            new File([blob.bytes], originalFilename, {
              type: mimeType,
            }),
          );
          setState(await submitOfflineFromClient(envelope, () => submitPendingVisitEvidenceFormAction({}, formData), onChanged));
        } catch (error) {
          setSubmitError(
            error instanceof Error ? error.message : "Could not prepare evidence for submission.",
          );
        }
      });
    });
  }

  return (
    <article className="rounded-[var(--ids-foundation-radius-sm)] border border-[var(--ids-foundation-stroke-subtle)] p-3">
      <Stack gap="tight">
        <p className="ids-caption text-muted" role="status">
          {submitting ? FRIGORA_VISIT_EVIDENCE_STATUS_COPY.submitting : statusLabel(envelope.syncState, online)}
          {!online && (envelope.syncState === "PENDING" || envelope.syncState === "LOCAL_DRAFT")
            ? ` · ${FRIGORA_VISIT_EVIDENCE_STATUS_COPY.notYetSubmitted}`
            : null}
        </p>
        <p className="ids-body">
          {category}
          {description ? `: ${description}` : ""} · {originalFilename}
        </p>
        {submitError || state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {submitError ?? state.error}
          </p>
        ) : null}
        {state.acceptedEntityId ? (
          <p className="ids-caption text-muted" role="status">
            {FRIGORA_VISIT_EVIDENCE_STATUS_COPY.acceptedByServer}
          </p>
        ) : null}
        {canSubmit ? (
          <form
            onSubmit={onExplicitSubmit}
            className="flex flex-col gap-[var(--ids-foundation-space-3)]"
          >
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting
                ? FRIGORA_VISIT_EVIDENCE_STATUS_COPY.submitting
                : envelope.syncState === "RETRYABLE_FAILURE" || envelope.syncState === "SYNCING"
                  ? "Retry submission"
                  : "Submit to server"}
            </Button>
          </form>
        ) : null}
      </Stack>
    </article>
  );
}
