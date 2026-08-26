import { createHash } from "node:crypto";
import { createId } from "@/platform/ids";
import { isAgentActor } from "./actor";
import { evaluateAuthority, type AuthorityEvaluatorDeps } from "./authority";
import type { WorkforceExecutorRegistry } from "./executors";
import type { WorkforceImplementationRegistry } from "./bindings";
import {
  EXECUTION_FAILURES,
  type AgentWorkforceActor,
  type ExecutionArguments,
  type ExecutionFailure,
  type ExecutionOutcome,
  type ExecutionPort,
  type ExecutionRequest,
  type WorkforceExecutionResult,
} from "./types";

export const EXECUTION_TIMEOUT_MS = 5_000;
export const EXECUTION_ARGUMENT_LIMIT = 32;
export const SCOPE_ARGUMENT_KEYS = [
  "workspaceId",
  "ventureId",
  "agentInstanceId",
] as const;

export const SECRET_ARGUMENT_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "credential",
  "session",
] as const;

export const EXTERNAL_REFERENCE_LIMIT = 256;

export type ExecutionRecordStatus = "running" | "succeeded" | "failed";

export type ExecutionRecord = {
  id: string;
  idempotencyKey: string;
  workspaceId: string;
  ventureId: string;
  agentInstanceId: string;
  capabilityId: string;
  sourceRequestId: string;
  sourceActionIndex: number;
  argumentHash: string;
  fingerprintHash: string;
  status: ExecutionRecordStatus;
  authorityContextVersion: string;
  authorityEvaluatedAt: string;
  outcomeJson: string | null;
  errorCategory: string | null;
  implementationId: string | null;
  implementationVersion: string | null;
  externalReference: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type ExecutionClaimInput = {
  id: string;
  idempotencyKey: string;
  workspaceId: string;
  ventureId: string;
  agentInstanceId: string;
  capabilityId: string;
  sourceRequestId: string;
  sourceActionIndex: number;
  argumentHash: string;
  fingerprintHash: string;
  authorityContextVersion: string;
  authorityEvaluatedAt: string;
  startedAt: string;
  implementationId?: string | null;
  implementationVersion?: string | null;
};

export type ExecutionClaimResult =
  | { kind: "claimed"; record: ExecutionRecord }
  | { kind: "reused"; record: ExecutionRecord }
  | { kind: "prior_failure"; record: ExecutionRecord }
  | { kind: "in_progress"; record: ExecutionRecord }
  | { kind: "mismatch"; record: ExecutionRecord };

export type WorkforceExecutionStore = {
  recoverInterrupted(): Promise<number>;
  claim(input: ExecutionClaimInput): Promise<ExecutionClaimResult>;
  complete(id: string, outcome: ExecutionOutcome): Promise<void>;
  fail(
    id: string,
    category: ExecutionFailure,
    outcome?: ExecutionOutcome,
  ): Promise<void>;
};

/**
 * Bound human approval is not an authority ticket. The gate still calls
 * evaluateAuthority against current state. This port may only satisfy a
 * current ALLOW_WITH_APPROVAL for the exact fingerprint. DENY and
 * UNAVAILABLE never consult it.
 */
export type WorkforceApprovalSatisfaction = {
  approved: boolean;
  fingerprintHash: string;
};

export type WorkforceApprovalSatisfactionPort = {
  satisfy(input: {
    workspaceId: string;
    ventureId: string;
    agentInstanceId: string;
    capabilityId: string;
    sourceRequestId: string;
    sourceActionIndex: number;
    fingerprintHash: string;
  }): Promise<WorkforceApprovalSatisfaction>;
};

export type WorkforceExecutionGateDeps = AuthorityEvaluatorDeps & {
  executors: WorkforceExecutorRegistry;
  store: WorkforceExecutionStore;
  timeoutMs?: number;
  approvals?: WorkforceApprovalSatisfactionPort;
  implementations?: WorkforceImplementationRegistry;
};

/**
 * Logical identity of one proposed action. Capability and arguments are
 * not part of the key; they are fingerprint payload. Changing them under
 * the same identity fails closed.
 */
export function deriveExecutionIdempotencyKey(request: ExecutionRequest): string {
  return sha256(
    [
      request.workspaceId,
      request.ventureId,
      request.agentInstanceId,
      request.sourceRequestId.trim(),
      String(request.sourceActionIndex),
    ].join("|"),
  );
}

export function deriveExternalIdempotencyKey(request: ExecutionRequest): string {
  return deriveExecutionIdempotencyKey(request);
}

export function hashExecutionArguments(args: ExecutionArguments): string {
  return sha256(canonicalJson(args));
}

export function fingerprintExecution(input: {
  workspaceId: string;
  ventureId: string;
  agentInstanceId: string;
  capabilityId: string;
  argumentHash: string;
}): string {
  return sha256(
    [
      input.workspaceId,
      input.ventureId,
      input.agentInstanceId,
      input.capabilityId,
      input.argumentHash,
    ].join("|"),
  );
}

export function createWorkforceExecutionGate(
  deps: WorkforceExecutionGateDeps,
): ExecutionPort {
  const timeoutMs = deps.timeoutMs ?? EXECUTION_TIMEOUT_MS;

  return {
    async execute(request) {
      const structural = readTrustedCommand(request);
      if (!structural.ok) {
        return structural.result;
      }
      const command = structural.command;

      const evaluation = await evaluateAuthority(
        {
          actor: command.actor,
          agentInstanceId: command.agentInstanceId,
          workspaceId: command.workspaceId,
          ventureId: command.ventureId,
          capabilityId: command.capabilityId,
        },
        deps,
      );

      if (!evaluation.ok) {
        return { ok: false, failure: "AUTHORITY_UNAVAILABLE" };
      }

      const { decision, context, evaluatedAt } = evaluation;
      if (decision.outcome === "DENY") {
        return {
          ok: false,
          failure: "AUTHORITY_DENIED",
          reason: decision.reason,
          contextVersion: context.contextVersion,
          evaluatedAt,
        };
      }
      if (decision.outcome === "ALLOW_WITH_APPROVAL" && !deps.approvals) {
        return {
          ok: false,
          failure: "APPROVAL_REQUIRED",
          contextVersion: context.contextVersion,
          evaluatedAt,
        };
      }

      const executor = deps.executors.get(command.capabilityId);
      if (!executor) {
        return {
          ok: false,
          failure: "NOT_EXECUTABLE",
          contextVersion: context.contextVersion,
          evaluatedAt,
        };
      }

      if (hasScopeInjection(command.arguments) || hasSecretInjection(command.arguments)) {
        return {
          ok: false,
          failure: "INVALID_ARGUMENTS",
          contextVersion: context.contextVersion,
          evaluatedAt,
        };
      }

      const parsed = executor.parseArguments(command.arguments);
      if (!parsed.ok) {
        return {
          ok: false,
          failure: "INVALID_ARGUMENTS",
          contextVersion: context.contextVersion,
          evaluatedAt,
        };
      }

      const argumentHash = hashExecutionArguments(parsed.value);
      const idempotencyKey = deriveExecutionIdempotencyKey(command);
      const fingerprintHash = fingerprintExecution({
        workspaceId: command.workspaceId,
        ventureId: command.ventureId,
        agentInstanceId: command.agentInstanceId,
        capabilityId: command.capabilityId,
        argumentHash,
      });
      const executionId = createId<string>();

      if (decision.outcome === "ALLOW_WITH_APPROVAL") {
        const approvals = deps.approvals;
        if (!approvals) {
          return {
            ok: false,
            failure: "APPROVAL_REQUIRED",
            contextVersion: context.contextVersion,
            evaluatedAt,
          };
        }
        const satisfaction = await approvals.satisfy({
          workspaceId: command.workspaceId,
          ventureId: command.ventureId,
          agentInstanceId: command.agentInstanceId,
          capabilityId: command.capabilityId,
          sourceRequestId: command.sourceRequestId,
          sourceActionIndex: command.sourceActionIndex,
          fingerprintHash,
        });
        if (
          !satisfaction.approved ||
          satisfaction.fingerprintHash !== fingerprintHash
        ) {
          return {
            ok: false,
            failure: "APPROVAL_REQUIRED",
            contextVersion: context.contextVersion,
            evaluatedAt,
          };
        }
      }

      const identity = deps.implementations?.get(command.capabilityId);
      const externalIdempotencyKey = deriveExternalIdempotencyKey(command);

      await deps.store.recoverInterrupted();
      const claimed = await deps.store.claim({
        id: executionId,
        idempotencyKey,
        workspaceId: command.workspaceId,
        ventureId: command.ventureId,
        agentInstanceId: command.agentInstanceId,
        capabilityId: command.capabilityId,
        sourceRequestId: command.sourceRequestId,
        sourceActionIndex: command.sourceActionIndex,
        argumentHash,
        fingerprintHash,
        authorityContextVersion: context.contextVersion,
        authorityEvaluatedAt: evaluatedAt,
        startedAt: evaluatedAt,
        implementationId: identity?.bindingId ?? null,
        implementationVersion: identity?.implementationVersion ?? null,
      });

      if (claimed.kind === "mismatch") {
        return {
          ok: false,
          failure: "IDEMPOTENCY_MISMATCH",
          executionId: claimed.record.id,
          idempotencyKey,
          contextVersion: context.contextVersion,
          evaluatedAt,
        };
      }
      if (claimed.kind === "in_progress") {
        return {
          ok: false,
          failure: "DUPLICATE_IN_PROGRESS",
          executionId: claimed.record.id,
          idempotencyKey,
          contextVersion: claimed.record.authorityContextVersion,
          evaluatedAt: claimed.record.authorityEvaluatedAt,
        };
      }
      if (claimed.kind === "prior_failure") {
        return priorFailureResult(claimed.record, idempotencyKey);
      }
      if (claimed.kind === "reused") {
        const outcome = parseStoredOutcome(claimed.record.outcomeJson);
        if (!outcome) {
          return {
            ok: false,
            failure: "EXECUTION_FAILED",
            executionId: claimed.record.id,
            idempotencyKey,
            contextVersion: claimed.record.authorityContextVersion,
            evaluatedAt: claimed.record.authorityEvaluatedAt,
          };
        }
        return {
          ok: true,
          executionId: claimed.record.id,
          idempotencyKey,
          outcome,
          contextVersion: claimed.record.authorityContextVersion,
          evaluatedAt: claimed.record.authorityEvaluatedAt,
          reused: true,
        };
      }

      const invocation = {
        executionId: claimed.record.id,
        actor: command.actor,
        agentInstanceId: command.agentInstanceId,
        workspaceId: command.workspaceId,
        ventureId: command.ventureId,
        capabilityId: command.capabilityId,
        arguments: parsed.value,
        externalIdempotencyKey,
        sourceRequestId: command.sourceRequestId,
      };

      try {
        const outcome = await withTimeout(
          executor.execute(invocation),
          timeoutMs,
        );
        if (!outcome.ok) {
          const failed: ExecutionOutcome = {
            executorId: executor.id,
            ok: false,
            error: "EXECUTION_FAILED",
          };
          await deps.store.fail(claimed.record.id, "EXECUTION_FAILED", failed);
          return {
            ok: false,
            failure: "EXECUTION_FAILED",
            executionId: claimed.record.id,
            idempotencyKey,
            contextVersion: context.contextVersion,
            evaluatedAt,
            outcome: failed,
          };
        }
        const succeeded: ExecutionOutcome = {
          executorId: executor.id,
          ok: true,
          output: outcome.output,
          receipt: boundReceipt(identity, outcome.receipt),
        };
        await deps.store.complete(claimed.record.id, succeeded);
        return {
          ok: true,
          executionId: claimed.record.id,
          idempotencyKey,
          outcome: succeeded,
          contextVersion: context.contextVersion,
          evaluatedAt,
        };
      } catch {
        const failed: ExecutionOutcome = {
          executorId: executor.id,
          ok: false,
          error: "EXECUTION_FAILED",
        };
        await deps.store.fail(claimed.record.id, "EXECUTION_FAILED", failed);
        return {
          ok: false,
          failure: "EXECUTION_FAILED",
          executionId: claimed.record.id,
          idempotencyKey,
          contextVersion: context.contextVersion,
          evaluatedAt,
          outcome: failed,
        };
      }
    },
  };
}

function readTrustedCommand(
  request: ExecutionRequest,
):
  | { ok: true; command: TrustedCommand }
  | { ok: false; result: WorkforceExecutionResult } {
  if (!isAgentActor(request.actor)) {
    return { ok: false, result: { ok: false, failure: "MALFORMED_REQUEST" } };
  }

  const capabilityId = request.capabilityId.trim();
  const sourceRequestId = request.sourceRequestId.trim();
  if (!capabilityId || !sourceRequestId) {
    return { ok: false, result: { ok: false, failure: "MALFORMED_REQUEST" } };
  }
  if (
    !Number.isInteger(request.sourceActionIndex) ||
    request.sourceActionIndex < 0
  ) {
    return { ok: false, result: { ok: false, failure: "MALFORMED_REQUEST" } };
  }
  if (!isArgumentMap(request.arguments)) {
    return { ok: false, result: { ok: false, failure: "MALFORMED_REQUEST" } };
  }
  if (Object.keys(request.arguments).length > EXECUTION_ARGUMENT_LIMIT) {
    return { ok: false, result: { ok: false, failure: "MALFORMED_REQUEST" } };
  }

  return {
    ok: true,
    command: {
      actor: request.actor,
      agentInstanceId: request.agentInstanceId,
      workspaceId: request.workspaceId,
      ventureId: request.ventureId,
      capabilityId,
      arguments: request.arguments,
      sourceRequestId,
      sourceActionIndex: request.sourceActionIndex,
    },
  };
}

type TrustedCommand = {
  actor: AgentWorkforceActor;
  agentInstanceId: ExecutionRequest["agentInstanceId"];
  workspaceId: ExecutionRequest["workspaceId"];
  ventureId: ExecutionRequest["ventureId"];
  capabilityId: string;
  arguments: ExecutionArguments;
  sourceRequestId: string;
  sourceActionIndex: number;
};

function hasScopeInjection(args: ExecutionArguments) {
  return SCOPE_ARGUMENT_KEYS.some((key) => key in args);
}

function hasSecretInjection(args: ExecutionArguments) {
  return Object.keys(args).some((key) =>
    (SECRET_ARGUMENT_KEYS as readonly string[]).includes(key.toLowerCase()),
  );
}

function boundReceipt(
  identity: { bindingId: string; implementationVersion: string } | undefined,
  receipt: ExecutionOutcome["receipt"],
): ExecutionOutcome["receipt"] | undefined {
  const externalReference = sanitizeExternalReference(receipt?.externalReference);
  if (!identity && !externalReference && !receipt?.occurredAt) {
    return undefined;
  }
  return {
    implementationId: identity?.bindingId ?? "",
    implementationVersion: identity?.implementationVersion ?? "",
    ...(externalReference ? { externalReference } : {}),
    ...(receipt?.occurredAt ? { occurredAt: receipt.occurredAt } : {}),
  };
}

function sanitizeExternalReference(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > EXTERNAL_REFERENCE_LIMIT) {
    return undefined;
  }
  if (
    (SECRET_ARGUMENT_KEYS as readonly string[]).some((key) =>
      trimmed.toLowerCase().includes(key),
    )
  ) {
    return undefined;
  }
  return trimmed;
}

function isArgumentMap(value: unknown): value is ExecutionArguments {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (entry) =>
      entry === null ||
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean",
  );
}

function priorFailureResult(
  record: ExecutionRecord,
  idempotencyKey: string,
): WorkforceExecutionResult {
  const category = isExecutionFailure(record.errorCategory)
    ? record.errorCategory
    : "EXECUTION_FAILED";
  return {
    ok: false,
    failure: category,
    executionId: record.id,
    idempotencyKey,
    contextVersion: record.authorityContextVersion,
    evaluatedAt: record.authorityEvaluatedAt,
    outcome: parseStoredOutcome(record.outcomeJson),
  };
}

function isExecutionFailure(value: string | null): value is ExecutionFailure {
  return (
    value !== null &&
    (EXECUTION_FAILURES as readonly string[]).includes(value)
  );
}

function parseStoredOutcome(raw: string | null): ExecutionOutcome | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.executorId !== "string" || typeof record.ok !== "boolean") {
      return undefined;
    }
    const outcome: ExecutionOutcome = {
      executorId: record.executorId,
      ok: record.ok,
    };
    if (record.output !== undefined) {
      outcome.output = record.output;
    }
    if (typeof record.error === "string") {
      outcome.error = record.error;
    }
    if (record.receipt && typeof record.receipt === "object" && !Array.isArray(record.receipt)) {
      const receipt = record.receipt as Record<string, unknown>;
      if (
        typeof receipt.implementationId === "string" &&
        typeof receipt.implementationVersion === "string"
      ) {
        outcome.receipt = {
          implementationId: receipt.implementationId,
          implementationVersion: receipt.implementationVersion,
          ...(typeof receipt.externalReference === "string"
            ? { externalReference: receipt.externalReference }
            : {}),
          ...(typeof receipt.occurredAt === "string"
            ? { occurredAt: receipt.occurredAt }
            : {}),
        };
      }
    }
    return outcome;
  } catch {
    return undefined;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("EXECUTION_TIMEOUT"));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
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
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}
