"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button } from "@repo/ui/button";
import { Field, Form, Stack } from "@/core/layout";
import {
  recordFieldCaptureFormAction,
  type FieldFormState,
} from "@/modules/frigora/app/field-mutation-actions";
import {
  captureFieldCaptureOffline,
  createFieldCaptureClientOperationId,
  listFieldCaptureMutations,
} from "@/modules/frigora/app/offline/field-capture-capture";
import {
  submitPendingFieldCaptureFormAction,
  type ExplicitFieldCaptureSubmitState,
} from "@/modules/frigora/app/offline/field-capture-submit-action";
import {
  type FrigoraOfflineMutationEnvelope,
} from "@/modules/frigora/app/offline";
import { FRIGORA_FIELD_CAPTURE_STATUS_COPY } from "@/modules/frigora/app/pwa/copy";
import {
  FRIGORA_FIELD_CAPTURE_CODES,
  FRIGORA_FIELD_CAPTURE_UNITS,
} from "@/modules/frigora/types";

import { saveOfflineOnce } from "@/modules/frigora/app/offline/offline-client-actions";
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
  const copy = FRIGORA_FIELD_CAPTURE_STATUS_COPY;
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

export function RecordFieldCaptureForm({
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
    recordFieldCaptureFormAction,
    {} as FieldFormState,
  );
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlinePending, startOfflineTransition] = useTransition();
  const offlineSaveInFlight = useRef(false);
  const [pendingOps, setPendingOps] = useState<FrigoraOfflineMutationEnvelope[]>([]);
  const [notFoundSyncing, setNotFoundSyncing] = useState<ReadonlySet<string>>(() => new Set());
  const [captureKind, setCaptureKind] = useState(
    onlineState.values?.captureKind ?? "measurement",
  );

  async function refreshPending() {
    const ops = await listFieldCaptureMutations(
      { ventureId, actorUserId },
      { workOrderId, visitId },
    );
    setPendingOps(ops);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ops = await listFieldCaptureMutations(
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
    const kind = String(data.get("captureKind") ?? "measurement") as
      | "measurement"
      | "condition";
    const captureCode = String(data.get("captureCode") ?? "");
    const description = String(data.get("description") ?? "");
    const valueNumericRaw = String(data.get("valueNumeric") ?? "");
    const valueUnit = String(data.get("valueUnit") ?? "");
    setOfflineError(null);
    startOfflineTransition(async () => {
      await saveOfflineOnce(offlineSaveInFlight, async () => {
        try {
          await captureFieldCaptureOffline({
            partition: { ventureId, actorUserId },
            workspaceId,
            workOrderId,
            visitId,
            payload: {
              captureKind: kind,
              captureCode,
              observedAt: new Date().toISOString(),
              assetId: primaryAssetId ?? null,
              description: kind === "condition" ? description : null,
              valueNumeric:
                kind === "measurement" && valueNumericRaw.trim().length > 0
                  ? Number(valueNumericRaw)
                  : null,
              valueUnit: kind === "measurement" ? valueUnit : null,
            },
            clientOperationId: createFieldCaptureClientOperationId(),
            syncState: "PENDING",
          });
          form.reset();
          setCaptureKind("measurement");
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
          <CaptureFields
            captureKind={captureKind}
            onCaptureKindChange={setCaptureKind}
            defaultCode={onlineState.values?.captureCode}
            defaultValueNumeric={onlineState.values?.valueNumeric}
            defaultValueUnit={onlineState.values?.valueUnit}
            defaultDescription={onlineState.values?.description}
          />
          {onlineState.error ? (
            <p className="ids-caption text-danger" role="alert">
              {onlineState.error}
            </p>
          ) : null}
          <Button type="submit" disabled={onlinePending} className="w-full sm:w-auto">
            {onlinePending ? "Recording…" : "Record observation"}
          </Button>
        </Form>
      ) : (
        <form
          data-frigora-offline-capture="recordFieldCapture"
          onSubmit={onOfflineSubmit}
          className="flex flex-col gap-[var(--ids-foundation-space-3)]"
        >
          <p className="ids-caption text-muted" role="status">
            {FRIGORA_FIELD_CAPTURE_STATUS_COPY.offlineCaptureHint}
          </p>
          <CaptureFields
            captureKind={captureKind}
            onCaptureKindChange={setCaptureKind}
          />
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
            <PendingFieldCaptureRow
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

function CaptureFields({
  captureKind,
  onCaptureKindChange,
  defaultCode,
  defaultValueNumeric,
  defaultValueUnit,
  defaultDescription,
}: {
  captureKind: string;
  onCaptureKindChange: (kind: string) => void;
  defaultCode?: string;
  defaultValueNumeric?: string;
  defaultValueUnit?: string;
  defaultDescription?: string;
}) {
  return (
    <Stack gap="tight">
      <Field>
        Kind
        <select
          name="captureKind"
          className="vos-field"
          value={captureKind}
          onChange={(event) => onCaptureKindChange(event.target.value)}
        >
          <option value="measurement">Measurement</option>
          <option value="condition">Condition</option>
        </select>
      </Field>
      <Field>
        Code
        <select
          name="captureCode"
          required
          className="vos-field"
          defaultValue={defaultCode ?? "temperature"}
        >
          {FRIGORA_FIELD_CAPTURE_CODES.map((code) => (
            <option key={code} value={code}>
              {code.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </Field>
      {captureKind === "measurement" ? (
        <>
          <Field>
            Value
            <input
              name="valueNumeric"
              type="number"
              step="any"
              required
              className="vos-field"
              defaultValue={defaultValueNumeric ?? ""}
            />
          </Field>
          <Field>
            Unit
            <select
              name="valueUnit"
              required
              className="vos-field"
              defaultValue={defaultValueUnit ?? "celsius"}
            >
              {FRIGORA_FIELD_CAPTURE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : (
        <Field>
          Description
          <textarea
            name="description"
            rows={3}
            required
            className="vos-field"
            defaultValue={defaultDescription ?? ""}
            placeholder="What was observed"
          />
        </Field>
      )}
    </Stack>
  );
}

function PendingFieldCaptureRow({
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
    async (previous: ExplicitFieldCaptureSubmitState, data: FormData) =>
      runExplicitOfflineSubmission(
        envelope,
        () => lookupPendingOfflineAcceptanceAction(buildOfflineAcceptanceLookupInput(envelope, workspaceId)),
        () => submitPendingFieldCaptureFormAction(previous, data),
        onChanged,
      ),
    {} as ExplicitFieldCaptureSubmitState,
  );
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const payload = envelope.payload;
  const captureKind = String(payload.captureKind ?? "");
  const captureCode = String(payload.captureCode ?? "");
  const observedAt = String(payload.observedAt ?? "");
  const description = typeof payload.description === "string" ? payload.description : "";
  const valueNumeric =
    typeof payload.valueNumeric === "number"
      ? String(payload.valueNumeric)
      : payload.valueNumeric == null
        ? ""
        : String(payload.valueNumeric);
  const valueUnit = typeof payload.valueUnit === "string" ? payload.valueUnit : "";
  const assetId = typeof payload.assetId === "string" ? payload.assetId : "";

  const copy = FRIGORA_FIELD_CAPTURE_STATUS_COPY;
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

  const summary =
    captureKind === "measurement"
      ? `${captureCode}: ${valueNumeric} ${valueUnit}`
      : `${captureCode}: ${description}`;

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
        <p className="ids-body">{summary}</p>
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
            <input type="hidden" name="captureKind" value={captureKind} />
            <input type="hidden" name="captureCode" value={captureCode} />
            <input type="hidden" name="observedAt" value={observedAt} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="valueNumeric" value={valueNumeric} />
            <input type="hidden" name="valueUnit" value={valueUnit} />
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
