"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordTechnicalFindingFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";
import {
  captureTechnicalFindingOffline,
  createTechnicalFindingClientOperationId,
  listTechnicalFindingMutations,
} from "@/modules/frigora/app/offline/technical-finding-capture";
import {
  submitPendingTechnicalFindingFormAction,
  type ExplicitTechnicalFindingSubmitState,
} from "@/modules/frigora/app/offline/technical-finding-submit-action";
import {
  type FrigoraOfflineMutationEnvelope,
} from "@/modules/frigora/app/offline";
import { FRIGORA_TECHNICAL_FINDING_STATUS_COPY } from "@/modules/frigora/app/pwa/copy";
import { saveTechnicalFindingOnce } from "@/modules/frigora/app/offline/technical-finding-client-actions";
import { lookupPendingOfflineAcceptanceAction } from "@/modules/frigora/app/offline/offline-acceptance-action";
import {
  buildOfflineAcceptanceLookupInput,
  frigoraFieldSignInHref,
  persistedRecoveryReason,
  recoveryControl,
  refreshOfflineAcceptance,
  runExplicitOfflineSubmission,
  runReadOnlyAcceptanceCheck,
} from "@/modules/frigora/app/offline/offline-recovery";

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

function statusLabel(state: FrigoraOfflineMutationEnvelope["syncState"]): string {
  const copy = FRIGORA_TECHNICAL_FINDING_STATUS_COPY;
  switch (state) {
    case "LOCAL_DRAFT":
    case "PENDING":
      return `${copy.savedOnDevice} · ${copy.notYetSubmitted}`;
    case "SYNCING":
      return copy.acceptanceNotConfirmed;
    case "SYNCED":
      return copy.acceptedByServer;
    case "BLOCKED":
      return copy.blocked;
    case "CONFLICT":
      return copy.conflict;
    case "RETRYABLE_FAILURE":
      return copy.retryable;
  }
}

export function RecordTechnicalFindingForm({
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
  primaryAssetId?: string | null;
  actorUserId: string;
}) {
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot);
  const [onlineState, onlineAction, onlinePending] = useActionState(
    recordTechnicalFindingFormAction,
    {} as FieldFormState,
  );
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlinePending, startOfflineTransition] = useTransition();
  const offlineSaveInFlight = useRef(false);
  const [pendingOps, setPendingOps] = useState<FrigoraOfflineMutationEnvelope[]>([]);
  const [notFoundSyncing, setNotFoundSyncing] = useState<ReadonlySet<string>>(() => new Set());

  async function refreshPending() {
    const ops = await listTechnicalFindingMutations(
      { ventureId, actorUserId },
      { workOrderId, visitId },
    );
    setPendingOps(ops);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ops = await listTechnicalFindingMutations(
        { ventureId, actorUserId },
        { workOrderId, visitId },
      );
      if (!online) {
        if (!cancelled) setPendingOps(ops);
        return;
      }
      const refreshed = await refreshOfflineAcceptance(ops, (operation) =>
        lookupPendingOfflineAcceptanceAction(
          buildOfflineAcceptanceLookupInput(operation, workspaceId),
        ),
      );
      if (!cancelled) {
        setPendingOps(refreshed.operations);
        setNotFoundSyncing(new Set(refreshed.notFoundSyncingIds));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ventureId, actorUserId, workOrderId, visitId, workspaceId, online]);

  function onOfflineSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.currentTarget;
    const data = new FormData(form);
    const findingKind = String(data.get("findingKind") ?? "symptom") as
      | "symptom"
      | "suspected_fault"
      | "confirmed_fault";
    const description = String(data.get("description") ?? "");
    setOfflineError(null);
    startOfflineTransition(async () => {
      await saveTechnicalFindingOnce(offlineSaveInFlight, async () => {
        try {
          await captureTechnicalFindingOffline({
            partition: { ventureId, actorUserId },
            workspaceId,
            workOrderId,
            visitId,
            payload: {
              findingKind,
              description,
              assertedAt: new Date().toISOString(),
              assetId: primaryAssetId ?? null,
            },
            clientOperationId: createTechnicalFindingClientOperationId(),
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
        <Form action={onlineAction} gap="tight">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="ventureId" value={ventureId} />
          <input type="hidden" name="workOrderId" value={workOrderId} />
          <input type="hidden" name="visitId" value={visitId} />
          {primaryAssetId ? (
            <input type="hidden" name="assetId" value={primaryAssetId} />
          ) : null}
          <FindingFields
            defaultKind={onlineState.values?.findingKind}
            defaultDescription={onlineState.values?.description}
          />
          {onlineState.error ? (
            <p className="ids-caption text-danger" role="alert">
              {onlineState.error}
            </p>
          ) : null}
          <Button type="submit" disabled={onlinePending} className="w-full sm:w-auto">
            {onlinePending ? "Recording…" : "Record finding"}
          </Button>
        </Form>
      ) : (
        <form
          data-frigora-offline-capture="recordTechnicalFinding"
          onSubmit={onOfflineSubmit}
          className="flex flex-col gap-[var(--ids-foundation-space-3)]"
        >
          <p className="ids-caption text-muted" role="status">
            {FRIGORA_TECHNICAL_FINDING_STATUS_COPY.offlineCaptureHint}
          </p>
          <FindingFields />
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
            <PendingTechnicalFindingRow
              key={op.clientOperationId}
              envelope={op}
              workspaceId={workspaceId}
              online={online}
              acceptanceCheckedNotFound={notFoundSyncing.has(op.clientOperationId)}
              onAcceptanceNotFound={() =>
                setNotFoundSyncing((current) => new Set(current).add(op.clientOperationId))
              }
              onChanged={refreshPending}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

function FindingFields({
  defaultKind,
  defaultDescription,
}: {
  defaultKind?: string;
  defaultDescription?: string;
}) {
  return (
    <Stack gap="tight">
      <Field>
        Finding kind
        <select
          name="findingKind"
          required
          className="vos-field"
          defaultValue={defaultKind ?? "symptom"}
        >
          <option value="symptom">Symptom</option>
          <option value="suspected_fault">Suspected fault</option>
          <option value="confirmed_fault">Confirmed fault</option>
        </select>
      </Field>
      <Field>
        Description
        <textarea
          name="description"
          rows={3}
          required
          className="vos-field"
          defaultValue={defaultDescription ?? ""}
          placeholder="What the technician concluded"
        />
      </Field>
    </Stack>
  );
}

function PendingTechnicalFindingRow({
  envelope,
  workspaceId,
  online,
  acceptanceCheckedNotFound,
  onAcceptanceNotFound,
  onChanged,
}: {
  envelope: FrigoraOfflineMutationEnvelope;
  workspaceId: string;
  online: boolean;
  acceptanceCheckedNotFound: boolean;
  onAcceptanceNotFound: () => void;
  onChanged: () => Promise<void>;
}) {
  const [state, action, pending] = useActionState(
    async (previous: ExplicitTechnicalFindingSubmitState, formData: FormData) =>
      runExplicitOfflineSubmission(
        envelope,
        () => lookupPendingOfflineAcceptanceAction(buildOfflineAcceptanceLookupInput(envelope, workspaceId)),
        () => submitPendingTechnicalFindingFormAction(previous, formData),
        onChanged,
      ),
    {} as ExplicitTechnicalFindingSubmitState,
  );
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const payload = envelope.payload;
  const findingKind = String(payload.findingKind ?? "");
  const description = String(payload.description ?? "");
  const assertedAt = String(payload.assertedAt ?? "");
  const assetId = typeof payload.assetId === "string" ? payload.assetId : "";
  const copy = FRIGORA_TECHNICAL_FINDING_STATUS_COPY;
  const control = recoveryControl({
    syncState: envelope.syncState,
    online,
    serverErrorCode: envelope.serverReceipt?.serverErrorCode,
    acceptanceCheckedNotFound,
  });
  const reason = persistedRecoveryReason(envelope);
  const busy = pending || checking;

  function onCheckAcceptance() {
    setCheckError(null);
    startCheck(async () => {
      const result = await runReadOnlyAcceptanceCheck(envelope, () =>
        lookupPendingOfflineAcceptanceAction(buildOfflineAcceptanceLookupInput(envelope, workspaceId)),
      );
      if (result.disposition === "not_found") onAcceptanceNotFound();
      setCheckError(result.error ?? null);
      await onChanged();
    });
  }

  return (
    <article
      className="rounded-[var(--ids-foundation-radius-sm)] border border-[var(--ids-foundation-stroke-subtle)] p-3"
      data-frigora-client-operation-id={envelope.clientOperationId}
      data-frigora-offline-operation={envelope.operationType}
    >
      <Stack gap="tight">
        <p className="ids-caption text-muted" role="status">
          {busy ? copy.submitting : statusLabel(envelope.syncState)}
        </p>
        <p className="ids-body">
          {findingKind}: {description}
        </p>
        {reason ? <p className="ids-caption text-muted">{reason}</p> : null}
        {checkError || state.error ? (
          <p className="ids-caption text-danger" role="alert">
            {checkError ?? state.error}
          </p>
        ) : null}
        {state.acceptedEntityId ? (
          <p className="ids-caption text-muted" role="status">
            {copy.acceptedByServer}
          </p>
        ) : null}
        {control === "check" ? (
          <Button type="button" disabled={busy} className="w-full sm:w-auto" onClick={onCheckAcceptance}>
            {copy.checkAcceptance}
          </Button>
        ) : null}
        {control === "sign-in" ? (
          <a href={frigoraFieldSignInHref(envelope.ventureId, envelope.workOrderId, envelope.visitId ?? "")}>
            {copy.signIn}
          </a>
        ) : null}
        {control === "submit" || control === "retry" ? (
          <Form action={action} gap="tight">
            <input type="hidden" name="workspaceId" value={workspaceId} />
            <input type="hidden" name="ventureId" value={envelope.ventureId} />
            <input type="hidden" name="workOrderId" value={envelope.workOrderId} />
            <input type="hidden" name="visitId" value={envelope.visitId ?? ""} />
            <input type="hidden" name="clientOperationId" value={envelope.clientOperationId} />
            <input type="hidden" name="findingKind" value={findingKind} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="assertedAt" value={assertedAt} />
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="actorUserId" value={envelope.actorUserId} />
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? copy.submitting : control === "retry" ? copy.retrySubmission : copy.submitToServer}
            </Button>
          </Form>
        ) : null}
      </Stack>
    </article>
  );
}
