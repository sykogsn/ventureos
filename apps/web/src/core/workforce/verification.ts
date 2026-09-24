import { createHash } from "node:crypto";
import type { VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import type {
  BoundPredicate,
  ExecutionArguments,
  VerificationFailure,
  VerificationObservation,
  VerificationObservationStatus,
  VerificationOutcome,
  VerificationPredicate,
  VerificationProcessResult,
  VerificationProvenance,
  VerificationResult,
  VerificationStatus,
} from "./types";

export const VERIFICATION_MAX_ATTEMPTS = 2;
export const VERIFICATION_MAX_RETRIES = 1;
export const VERIFICATION_RETRY_DELAY_MS = 15_000;
export const VERIFICATION_EVIDENCE_CEILING_BYTES = 8 * 1024;
export const VERIFICATION_OBSERVE_TIMEOUT_MS = 5_000;
export const VERIFICATION_PROVENANCE = "system_observation" as const;

const FORBIDDEN_EVIDENCE_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "credential",
  "session",
];

export type TrustedObservationRequest = {
  runId: string;
  executionId: string;
  workspaceId: string;
  ventureId: string;
  agentInstanceId: string;
  capabilityId: string;
  predicateFingerprint: string;
  sourceRequestId: string;
  sourceActionIndex: number;
};

export type VerificationEvidence = {
  provenance: typeof VERIFICATION_PROVENANCE;
  observationStatus: VerificationObservationStatus;
  predicateId: string;
  predicateFingerprint: string;
  capabilityId: string;
  executionId: string;
  observedKeys: string[];
  matched?: boolean;
};

export function fingerprintBoundPredicate(input: {
  capabilityId: string;
  predicateId: string;
  version: string;
  expected: ExecutionArguments;
}): string {
  return sha256(
    canonicalJson({
      capabilityId: input.capabilityId,
      predicateId: input.predicateId,
      version: input.version,
      expected: input.expected,
    }),
  );
}

export function bindPredicateRecord(
  predicate: VerificationPredicate,
  expected: ExecutionArguments,
): BoundPredicate {
  return {
    ...predicate,
    expected,
    fingerprint: fingerprintBoundPredicate({
      capabilityId: predicate.capabilityId,
      predicateId: predicate.id,
      version: predicate.version,
      expected,
    }),
  };
}

export function isRetryableObservation(
  status: VerificationObservationStatus,
): boolean {
  return status === "missing" || status === "unavailable" || status === "timeout";
}

export function isInfrastructureObservationFailure(
  status: VerificationObservationStatus,
): boolean {
  return status === "unavailable" || status === "timeout";
}

export function canRetryVerification(attemptCount: number): boolean {
  return attemptCount < VERIFICATION_MAX_ATTEMPTS;
}

export function verificationRetryAt(from = new Date()): Date {
  return new Date(from.getTime() + VERIFICATION_RETRY_DELAY_MS);
}

export function encodeVerificationEvidence(
  evidence: VerificationEvidence,
):
  | { ok: true; json: string }
  | { ok: false; failure: Extract<VerificationFailure, "EVIDENCE_TOO_LARGE"> } {
  const json = JSON.stringify(evidence);
  if (Buffer.byteLength(json, "utf8") > VERIFICATION_EVIDENCE_CEILING_BYTES) {
    return { ok: false, failure: "EVIDENCE_TOO_LARGE" };
  }
  return { ok: true, json };
}

export function observationContainsForbiddenData(
  observation: VerificationObservation,
): boolean {
  if (!observation.values) {
    return false;
  }
  return Object.keys(observation.values).some((key) =>
    FORBIDDEN_EVIDENCE_KEYS.includes(key.toLowerCase()),
  );
}

export function evidenceFromObservation(input: {
  observation: VerificationObservation;
  predicate: BoundPredicate;
  executionId: string;
  matched?: boolean;
}): VerificationEvidence {
  return {
    provenance: VERIFICATION_PROVENANCE,
    observationStatus: input.observation.status,
    predicateId: input.predicate.id,
    predicateFingerprint: input.predicate.fingerprint,
    capabilityId: input.predicate.capabilityId,
    executionId: input.executionId,
    observedKeys: input.observation.values
      ? Object.keys(input.observation.values).sort()
      : [],
    matched: input.matched,
  };
}

export function verifiedResult(): VerificationResult {
  return { outcome: "VERIFIED" };
}

export function notVerifiedResult(): VerificationResult {
  return { outcome: "NOT_VERIFIED" };
}

export function verificationProcessOk(
  verificationId: string,
  result: VerificationResult,
): VerificationProcessResult {
  return { ok: true, result, verificationId };
}

export function verificationProcessFail(
  failure: VerificationFailure,
  verificationId?: string,
): VerificationProcessResult {
  return { ok: false, failure, verificationId };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}

export type WorkforceVerificationRecord = {
  id: string;
  runId: WorkforceRunId;
  executionId: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  agentInstanceId: AgentInstanceId;
  capabilityId: string;
  sourceRequestId: string;
  sourceActionIndex: number;
  predicateId: string;
  predicateVersion: string;
  predicateFingerprint: string;
  expected: ExecutionArguments;
  status: VerificationStatus;
  failureCategory: VerificationFailure | null;
  attemptCount: number;
  observation: VerificationObservation | null;
  evidenceJson: string | null;
  provenance: VerificationProvenance | null;
  claimNonce: string | null;
  implementationId: string | null;
  implementationVersion: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type WorkforceVerificationInsert = {
  runId: WorkforceRunId;
  executionId: string;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  agentInstanceId: AgentInstanceId;
  capabilityId: string;
  sourceRequestId: string;
  sourceActionIndex: number;
  predicate: BoundPredicate;
  implementationId?: string | null;
  implementationVersion?: string | null;
};

export type WorkforceVerificationStore = {
  insertPending(
    row: WorkforceVerificationInsert,
  ): Promise<WorkforceVerificationRecord>;
  get(id: string): Promise<WorkforceVerificationRecord | undefined>;
  getByRunId(
    runId: WorkforceRunId,
  ): Promise<WorkforceVerificationRecord | undefined>;
  claimObserving(
    id: string,
  ): Promise<WorkforceVerificationRecord | undefined>;
  adoptObserving(
    id: string,
  ): Promise<WorkforceVerificationRecord | undefined>;
  releaseStaleObserving(
    id: string,
  ): Promise<WorkforceVerificationRecord | undefined>;
  persistObservation(
    id: string,
    observation: VerificationObservation,
  ): Promise<WorkforceVerificationRecord | undefined>;
  releasePending(id: string): Promise<WorkforceVerificationRecord | undefined>;
  complete(
    id: string,
    outcome: VerificationOutcome,
    evidenceJson: string,
    provenance: VerificationProvenance,
  ): Promise<WorkforceVerificationRecord | undefined>;
  fail(
    id: string,
    failure: VerificationFailure,
  ): Promise<WorkforceVerificationRecord | undefined>;
};

export function isTerminalVerificationStatus(status: VerificationStatus) {
  return status === "verified" || status === "not_verified" || status === "failed";
}
