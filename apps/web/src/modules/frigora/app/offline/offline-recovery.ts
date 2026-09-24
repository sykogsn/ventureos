import type { LookupClientOperationAcceptanceInput } from "@/modules/frigora/types";
import type { FrigoraOfflineMutationEnvelope, FrigoraOfflineServerReceipt, FrigoraOfflineSyncState } from "./types";
import { openFrigoraOfflineStore, type FrigoraOfflineStore } from "./store";
import { applyOfflineLocalSubmitOutcome } from "./offline-local-submit-outcome";
import { applyTechnicalFindingLocalSubmitOutcome } from "./technical-finding-local-outcome";
import { loadPersistedEvidenceBlobForSubmit } from "./visit-evidence-capture";

export type OfflineAcceptanceProbe =
  | { status: "UNAUTHENTICATED" }
  | { status: "NOT_FOUND" }
  | { status: "MISMATCH" }
  | {
      status: "ACCEPTED";
      receiptId: string;
      clientOperationId: string;
      acceptedEntityId: string;
      operationType: "recordTechnicalFinding" | "recordFieldCapture" | "recordVisitEvidence";
      acceptedAt: string;
      workOrderId: string;
      visitId: string | null;
    };

export type OfflineAcceptanceDisposition =
  | "accepted"
  | "not_found"
  | "mismatch"
  | "blocked"
  | "unchanged";

const MISMATCH_MESSAGE = "This saved operation does not match an authoritative acceptance record.";
const SIGN_IN_MESSAGE = "Sign in again before this saved work can be submitted or reconciled.";
const CHECK_FAILED_MESSAGE = "Acceptance could not be checked. Try again when you are online and signed in.";
const LOST_RESPONSE_MESSAGE =
  "Server acceptance could not be confirmed. Retry this saved operation to check or complete submission.";

export class OfflineEvidenceLinkageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfflineEvidenceLinkageError";
  }
}

export function buildOfflineAcceptanceLookupInput(
  envelope: FrigoraOfflineMutationEnvelope,
  workspaceId: string,
): LookupClientOperationAcceptanceInput {
  const base = {
    ventureId: envelope.ventureId,
    workspaceId: envelope.workspaceId || workspaceId,
    actorUserId: envelope.actorUserId,
    clientOperationId: envelope.clientOperationId,
    workOrderId: envelope.workOrderId,
    visitId: envelope.visitId ?? "",
  };
  const payload = envelope.payload;
  if (envelope.operationType === "recordTechnicalFinding") {
    return {
      ...base,
      operationType: "recordTechnicalFinding",
      findingKind: String(payload.findingKind ?? ""),
      description: String(payload.description ?? ""),
      assertedAt: String(payload.assertedAt ?? ""),
      assetId: typeof payload.assetId === "string" ? payload.assetId : null,
      sourceFieldCaptureIds: Array.isArray(payload.sourceFieldCaptureIds)
        ? payload.sourceFieldCaptureIds.map(String)
        : null,
    };
  }
  if (envelope.operationType === "recordFieldCapture") {
    return {
      ...base,
      operationType: "recordFieldCapture",
      captureKind: String(payload.captureKind ?? ""),
      captureCode: String(payload.captureCode ?? ""),
      valueNumeric: typeof payload.valueNumeric === "number" ? payload.valueNumeric : null,
      valueUnit: typeof payload.valueUnit === "string" ? payload.valueUnit : null,
      description: typeof payload.description === "string" ? payload.description : null,
      observedAt: String(payload.observedAt ?? ""),
      assetId: typeof payload.assetId === "string" ? payload.assetId : null,
    };
  }
  if (envelope.operationType === "recordVisitEvidence") {
    const byteLength = payload.byteLength;
    return {
      ...base,
      operationType: "recordVisitEvidence",
      category: String(payload.category ?? ""),
      description: typeof payload.description === "string" ? payload.description : null,
      originalFilename: String(payload.originalFilename ?? ""),
      mimeType: String(payload.mimeType ?? ""),
      byteLength: typeof byteLength === "number" ? byteLength : 0,
      contentSha256: String(payload.contentSha256 ?? ""),
      assetId: typeof payload.assetId === "string" ? payload.assetId : null,
    };
  }
  throw new Error(`Offline operation ${envelope.operationType} cannot be reconciled.`);
}

export function recoveryControl(input: {
  syncState: FrigoraOfflineSyncState;
  online: boolean;
  serverErrorCode?: string;
  acceptanceCheckedNotFound: boolean;
}): "submit" | "retry" | "check" | "sign-in" | "none" {
  if (input.syncState === "SYNCED") return "none";
  if (input.syncState === "BLOCKED") return "sign-in";
  if (!input.online || input.syncState === "LOCAL_DRAFT") return "none";
  if (input.syncState === "PENDING") return "submit";
  if (input.syncState === "SYNCING") {
    return input.acceptanceCheckedNotFound ? "retry" : "check";
  }
  if (input.syncState === "RETRYABLE_FAILURE") return "retry";
  if (input.syncState === "CONFLICT") {
    return input.serverErrorCode === "authority" ? "retry" : "none";
  }
  return "none";
}

export function persistedRecoveryReason(
  envelope: FrigoraOfflineMutationEnvelope,
): string | undefined {
  if (envelope.syncState === "SYNCED") return undefined;
  const message = envelope.serverReceipt?.serverMessage?.trim();
  if (!message || envelope.serverReceipt?.accepted === true) return undefined;
  return message;
}

export function frigoraFieldSignInHref(
  ventureId: string,
  workOrderId: string,
  visitId: string,
): string {
  const next = `/ventures/${ventureId}/work/${workOrderId}/visit/${visitId}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

function rejectionReceipt(
  code: string,
  message: string,
): FrigoraOfflineServerReceipt {
  return {
    accepted: false,
    recordedAt: new Date().toISOString(),
    serverErrorCode: code,
    serverMessage: message,
  };
}

function acceptanceReceipt(acceptedAt: string): FrigoraOfflineServerReceipt {
  return { accepted: true, recordedAt: acceptedAt };
}

function stepsBetween(
  from: FrigoraOfflineSyncState,
  to: "SYNCED" | "CONFLICT" | "BLOCKED" | "RETRYABLE_FAILURE",
): FrigoraOfflineSyncState[] {
  if (from === to) return [];
  if (to === "SYNCED") {
    if (from === "SYNCING") return ["SYNCED"];
    if (from === "PENDING" || from === "RETRYABLE_FAILURE") return ["SYNCING", "SYNCED"];
    if (from === "LOCAL_DRAFT" || from === "BLOCKED" || from === "CONFLICT") {
      return ["PENDING", "SYNCING", "SYNCED"];
    }
  }
  if (to === "CONFLICT" || to === "BLOCKED" || to === "RETRYABLE_FAILURE") {
    if (from === "SYNCING") return [to];
    if (from === "PENDING" || from === "RETRYABLE_FAILURE") return ["SYNCING", to];
    if (from === "LOCAL_DRAFT" || from === "BLOCKED" || from === "CONFLICT") {
      return ["PENDING", "SYNCING", to];
    }
  }
  throw new Error(`Illegal offline recovery path: ${from} → ${to}`);
}

async function commitRecoveryState(
  store: FrigoraOfflineStore,
  clientOperationId: FrigoraOfflineMutationEnvelope["clientOperationId"],
  to: "SYNCED" | "CONFLICT" | "BLOCKED" | "RETRYABLE_FAILURE",
  serverReceipt: FrigoraOfflineServerReceipt,
): Promise<FrigoraOfflineMutationEnvelope> {
  const current = await store.getMutation(clientOperationId);
  if (!current) {
    throw new Error(`Unknown offline mutation ${clientOperationId}`);
  }
  const steps = stepsBetween(current.syncState, to);
  if (steps.length === 0) {
    return store.updateMutationState(clientOperationId, to, {
      serverReceipt,
      serverAccepted: to === "SYNCED" ? true : undefined,
      lastAttemptAt: new Date().toISOString(),
    });
  }
  let latest = current;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]!;
    const last = index === steps.length - 1;
    latest = await store.updateMutationState(clientOperationId, step, {
      serverAccepted: step === "SYNCED" ? true : undefined,
      serverReceipt: last ? serverReceipt : undefined,
      lastAttemptAt: last ? new Date().toISOString() : undefined,
    });
  }
  return latest;
}

function probeMatchesEnvelope(
  envelope: FrigoraOfflineMutationEnvelope,
  probe: Extract<OfflineAcceptanceProbe, { status: "ACCEPTED" }>,
): boolean {
  return (
    probe.clientOperationId === envelope.clientOperationId &&
    probe.operationType === envelope.operationType &&
    probe.workOrderId === envelope.workOrderId &&
    (probe.visitId ?? "") === (envelope.visitId ?? "")
  );
}

async function applyLocalOutcome(
  envelope: FrigoraOfflineMutationEnvelope,
  outcome: Parameters<typeof applyOfflineLocalSubmitOutcome>[1],
  store: FrigoraOfflineStore,
) {
  if (envelope.operationType === "recordTechnicalFinding") {
    return applyTechnicalFindingLocalSubmitOutcome(envelope, outcome, store);
  }
  return applyOfflineLocalSubmitOutcome(envelope, outcome, store);
}

export async function applyOfflineAcceptanceProbe(
  envelope: FrigoraOfflineMutationEnvelope,
  probe: OfflineAcceptanceProbe,
  store?: FrigoraOfflineStore,
): Promise<{
  envelope: FrigoraOfflineMutationEnvelope | undefined;
  disposition: OfflineAcceptanceDisposition;
}> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const current = await offlineStore.getMutation(envelope.clientOperationId);
  if (!current || current.syncState === "SYNCED") {
    return { envelope: current, disposition: current?.syncState === "SYNCED" ? "accepted" : "unchanged" };
  }
  if (probe.status === "NOT_FOUND") {
    return { envelope: current, disposition: "not_found" };
  }
  if (probe.status === "UNAUTHENTICATED") {
    const next = await commitRecoveryState(
      offlineStore,
      current.clientOperationId,
      "BLOCKED",
      rejectionReceipt("auth_required", SIGN_IN_MESSAGE),
    );
    return { envelope: next, disposition: "blocked" };
  }
  if (probe.status === "MISMATCH" || !probeMatchesEnvelope(current, probe)) {
    const next = await commitRecoveryState(
      offlineStore,
      current.clientOperationId,
      "CONFLICT",
      rejectionReceipt("mismatch", MISMATCH_MESSAGE),
    );
    return { envelope: next, disposition: "mismatch" };
  }
  if (current.operationType === "recordVisitEvidence") {
    try {
      await loadPersistedEvidenceBlobForSubmit(current, offlineStore);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Evidence linkage failed.";
      const next = await commitRecoveryState(
        offlineStore,
        current.clientOperationId,
        "CONFLICT",
        rejectionReceipt("rejected", message),
      );
      return { envelope: next, disposition: "mismatch" };
    }
    const next = await offlineStore.acceptEvidence(
      {
        ...current,
        serverReceipt: acceptanceReceipt(probe.acceptedAt),
      },
      {
        receiptId: probe.receiptId,
        clientOperationId: current.clientOperationId,
        ventureId: current.ventureId,
        actorUserId: current.actorUserId,
        recordedAt: probe.acceptedAt,
        kind: "accepted",
        detail: probe.acceptedEntityId,
      },
    );
    return { envelope: next, disposition: "accepted" };
  }
  await offlineStore.putReceipt({
    receiptId: probe.receiptId,
    clientOperationId: current.clientOperationId,
    ventureId: current.ventureId,
    actorUserId: current.actorUserId,
    recordedAt: probe.acceptedAt,
    kind: "accepted",
    detail: probe.acceptedEntityId,
  });
  const next = await commitRecoveryState(
    offlineStore,
    current.clientOperationId,
    "SYNCED",
    acceptanceReceipt(probe.acceptedAt),
  );
  return { envelope: next, disposition: "accepted" };
}

export async function refreshOfflineAcceptance(
  operations: readonly FrigoraOfflineMutationEnvelope[],
  lookup: (envelope: FrigoraOfflineMutationEnvelope) => Promise<OfflineAcceptanceProbe>,
  store?: FrigoraOfflineStore,
): Promise<{
  operations: FrigoraOfflineMutationEnvelope[];
  notFoundSyncingIds: string[];
}> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const next: FrigoraOfflineMutationEnvelope[] = [];
  const notFoundSyncingIds: string[] = [];
  for (const operation of operations) {
    if (operation.syncState === "SYNCED") {
      next.push(operation);
      continue;
    }
    try {
      const probe = await lookup(operation);
      const applied = await applyOfflineAcceptanceProbe(operation, probe, offlineStore);
      next.push(applied.envelope ?? operation);
      if (applied.disposition === "not_found" && operation.syncState === "SYNCING") {
        notFoundSyncingIds.push(operation.clientOperationId);
      }
    } catch (error) {
      if (error instanceof OfflineEvidenceLinkageError) {
        const conflicted = await commitRecoveryState(
          offlineStore,
          operation.clientOperationId,
          "CONFLICT",
          rejectionReceipt("rejected", error.message),
        );
        next.push(conflicted);
      } else {
        next.push(operation);
      }
    }
  }
  return { operations: next, notFoundSyncingIds };
}

export async function runReadOnlyAcceptanceCheck(
  envelope: FrigoraOfflineMutationEnvelope,
  lookup: () => Promise<OfflineAcceptanceProbe>,
  store?: FrigoraOfflineStore,
): Promise<{
  disposition: OfflineAcceptanceDisposition;
  error?: string;
}> {
  try {
    const probe = await lookup();
    const applied = await applyOfflineAcceptanceProbe(envelope, probe, store);
    return { disposition: applied.disposition };
  } catch (error) {
    if (error instanceof OfflineEvidenceLinkageError) {
      const offlineStore = store ?? (await openFrigoraOfflineStore());
      await commitRecoveryState(
        offlineStore,
        envelope.clientOperationId,
        "CONFLICT",
        rejectionReceipt("rejected", error.message),
      );
      return { disposition: "mismatch", error: error.message };
    }
    return { disposition: "unchanged", error: CHECK_FAILED_MESSAGE };
  }
}

type ExplicitOfflineSubmitCode =
  | "auth_required"
  | "authority"
  | "idempotency_conflict"
  | "rejected"
  | "retryable"
  | "partition";

type ExplicitOfflineSubmitResult = {
  error?: string;
  code?: ExplicitOfflineSubmitCode;
  acceptedEntityId?: string;
  receiptId?: string;
};

export async function runExplicitOfflineSubmission(
  envelope: FrigoraOfflineMutationEnvelope,
  lookup: () => Promise<OfflineAcceptanceProbe>,
  submit: () => Promise<ExplicitOfflineSubmitResult>,
  onChanged: () => Promise<void>,
  store?: FrigoraOfflineStore,
): Promise<ExplicitOfflineSubmitResult> {
  const offlineStore = store ?? (await openFrigoraOfflineStore());
  const current = (await offlineStore.getMutation(envelope.clientOperationId)) ?? envelope;
  if (current.clientOperationId !== envelope.clientOperationId) {
    return { code: "rejected", error: MISMATCH_MESSAGE };
  }
  if (current.syncState === "SYNCED") {
    return {};
  }

  let probe: OfflineAcceptanceProbe;
  try {
    probe = await lookup();
  } catch (error) {
    if (error instanceof OfflineEvidenceLinkageError) {
      await commitRecoveryState(
        offlineStore,
        current.clientOperationId,
        "CONFLICT",
        rejectionReceipt("rejected", error.message),
      );
      return { code: "rejected", error: error.message };
    }
    const message = LOST_RESPONSE_MESSAGE;
    await applyLocalOutcome(current, { ok: false, code: "retryable", error: message }, offlineStore);
    return { code: "retryable", error: message };
  }

  if (probe.status === "ACCEPTED") {
    const applied = await applyOfflineAcceptanceProbe(current, probe, offlineStore);
    try {
      await onChanged();
    } catch {
      return {
        acceptedEntityId: probe.acceptedEntityId,
        receiptId: probe.receiptId,
        error: "Could not refresh this device's operations. Reload to check the saved submission status.",
      };
    }
    if (applied.disposition !== "accepted") {
      return { code: "rejected", error: MISMATCH_MESSAGE };
    }
    return { acceptedEntityId: probe.acceptedEntityId, receiptId: probe.receiptId };
  }
  if (probe.status === "MISMATCH") {
    await applyOfflineAcceptanceProbe(current, probe, offlineStore);
    try {
      await onChanged();
    } catch {
      /* The durable conflict remains. */
    }
    return { code: "idempotency_conflict", error: MISMATCH_MESSAGE };
  }
  if (probe.status === "UNAUTHENTICATED") {
    await applyOfflineAcceptanceProbe(current, probe, offlineStore);
    try {
      await onChanged();
    } catch {
      /* The blocked operation remains. */
    }
    return { code: "auth_required", error: SIGN_IN_MESSAGE };
  }

  let result: ExplicitOfflineSubmitResult;
  try {
    result = await submit();
  } catch {
    result = { code: "retryable", error: LOST_RESPONSE_MESSAGE };
  }

  try {
    if (result.acceptedEntityId && result.receiptId) {
      await applyLocalOutcome(current, {
        ok: true,
        receiptId: result.receiptId,
        acceptedEntityId: result.acceptedEntityId,
      }, offlineStore);
    } else if (result.error && result.code) {
      const code = result.code;
      if (
        code === "auth_required" ||
        code === "authority" ||
        code === "idempotency_conflict" ||
        code === "rejected" ||
        code === "retryable" ||
        code === "partition"
      ) {
        await applyLocalOutcome(current, { ok: false, code, error: result.error }, offlineStore);
      }
    }
  } catch {
    result = {
      ...result,
      error: "Could not update this device's submission status. Retry this saved operation to reconcile it with the server.",
    };
  }
  try {
    await onChanged();
  } catch {
    result = {
      ...result,
      error: "Could not refresh this device's operations. Reload to check the saved submission status.",
    };
  }
  return result;
}
