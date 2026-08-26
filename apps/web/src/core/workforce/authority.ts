import type { CapabilityRegistry } from "@/core/capability/registry";
import { isVentureLifecycle } from "@/core/venture-definition/lifecycle";
import { nowIso } from "@/platform/ids";
import { isAgentActor } from "./actor";
import type { WorkforceDefinitionRegistry } from "./definitions";
import type { WorkforceInstanceRegistry } from "./instances";
import type {
  AgentDefinition,
  AgentInstance,
  AgentInstanceStatus,
  AuthorityDenyReason,
  AuthorityEvaluation,
  AuthorityRequest,
  EnforcementContext,
  ModelContext,
} from "./types";

/**
 * ExecutionPort (Sprint 5) MUST:
 * 1. call evaluateAuthority against current authoritative state
 * 2. reject DENY
 * 3. reject UNAVAILABLE
 * 4. accept ALLOW only as a current decision, never as a cached ticket
 * 5. require a valid human FounderDecisionRecorded for ALLOW_WITH_APPROVAL
 * 6. compare request.contextVersion to the freshly composed contextVersion
 * 7. enforce durable idempotency before consequential side effects
 *
 * Sprint 6 approval resume MUST re-evaluate again.
 * A previous ALLOW is never an execution ticket.
 */
export const FOUNDER_ONLY_CAPABILITIES = ["governance.founder-decision"] as const;

const USABLE_CAPABILITY_LIFECYCLES = new Set(["internal", "shared", "stable"]);
const OPERATING_VENTURE_LIFECYCLES = new Set([
  "concept",
  "incubating",
  "operating",
  "scaling",
]);

export type VentureScopeRecord = {
  workspaceFound: boolean;
  venture: { workspaceId: string; lifecycle: string } | null;
};

export type VentureScopePort = {
  lookup(
    workspaceId: AuthorityRequest["workspaceId"],
    ventureId: AuthorityRequest["ventureId"],
  ): Promise<{ ok: true; value: VentureScopeRecord } | { ok: false }>;
};

export type AuthorityEvaluatorDeps = {
  definitions: WorkforceDefinitionRegistry;
  instances: WorkforceInstanceRegistry;
  capabilities: CapabilityRegistry;
  scope: VentureScopePort;
};

export async function evaluateAuthority(
  request: AuthorityRequest,
  deps: AuthorityEvaluatorDeps,
): Promise<AuthorityEvaluation> {
  try {
    return await evaluateAuthorityOrThrow(request, deps);
  } catch {
    return { ok: false, failure: "UNAVAILABLE" };
  }
}

export function isEnforcementContext(value: unknown): value is EnforcementContext {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.workspaceId === "string" &&
    typeof record.ventureId === "string" &&
    typeof record.agentInstanceId === "string" &&
    typeof record.definitionId === "string" &&
    typeof record.definitionVersion === "string" &&
    Array.isArray(record.capabilityScope) &&
    typeof record.contextVersion === "string" &&
    typeof record.ventureStatus === "string" &&
    typeof record.instanceStatus === "string" &&
    typeof record.definitionLifecycle === "string"
  );
}

export function isModelContext(value: unknown): value is ModelContext {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.objective === "string" &&
    Array.isArray(record.citations) &&
    !("capabilityScope" in record) &&
    !("contextVersion" in record) &&
    !("definitionLifecycle" in record)
  );
}

async function evaluateAuthorityOrThrow(
  request: AuthorityRequest,
  deps: AuthorityEvaluatorDeps,
): Promise<AuthorityEvaluation> {
  const evaluatedAt = nowIso();

  if (!isAgentActor(request.actor)) {
    return deny("ACTOR_INVALID", snapshot(request), evaluatedAt);
  }

  if (request.actor.agentInstanceId !== request.agentInstanceId) {
    return deny("INSTANCE_MISMATCH", snapshot(request), evaluatedAt);
  }

  if (request.actor.workspaceId !== request.workspaceId) {
    return deny("WORKSPACE_MISMATCH", snapshot(request), evaluatedAt);
  }

  if (request.actor.ventureId !== request.ventureId) {
    return deny("VENTURE_MISMATCH", snapshot(request), evaluatedAt);
  }

  const instance = deps.instances.get(request.agentInstanceId);
  if (!instance) {
    return deny("INSTANCE_MISSING", snapshot(request), evaluatedAt);
  }

  if (instance.workspaceId !== request.workspaceId) {
    return deny(
      "WORKSPACE_MISMATCH",
      snapshot(request, { instance }),
      evaluatedAt,
    );
  }

  if (instance.ventureId !== request.ventureId) {
    return deny(
      "VENTURE_MISMATCH",
      snapshot(request, { instance }),
      evaluatedAt,
    );
  }

  if (instance.status !== "active") {
    return deny(
      "INSTANCE_INACTIVE",
      snapshot(request, { instance }),
      evaluatedAt,
    );
  }

  const definition = deps.definitions.get(
    instance.definitionId,
    instance.definitionVersion,
  );
  if (!definition) {
    const reason = deps.definitions.has(instance.definitionId)
      ? "DEFINITION_VERSION_MISMATCH"
      : "DEFINITION_MISSING";
    return deny(reason, snapshot(request, { instance }), evaluatedAt);
  }

  if (definition.lifecycle !== "ACTIVE") {
    return deny(
      "DEFINITION_INACTIVE",
      snapshot(request, { instance, definition }),
      evaluatedAt,
    );
  }

  const scopeResult = await deps.scope.lookup(
    request.workspaceId,
    request.ventureId,
  );
  if (!scopeResult.ok) {
    return { ok: false, failure: "UNAVAILABLE" };
  }

  if (!scopeResult.value.workspaceFound) {
    return deny(
      "WORKSPACE_MISSING",
      snapshot(request, { instance, definition }),
      evaluatedAt,
    );
  }

  const venture = scopeResult.value.venture;
  if (!venture) {
    return deny(
      "VENTURE_MISSING",
      snapshot(request, { instance, definition }),
      evaluatedAt,
    );
  }

  if (venture.workspaceId !== request.workspaceId) {
    return deny(
      "VENTURE_MISMATCH",
      snapshot(request, { instance, definition, ventureStatus: venture.lifecycle }),
      evaluatedAt,
    );
  }

  if (!isOperatingVenture(venture.lifecycle)) {
    return deny(
      "VENTURE_INACTIVE",
      snapshot(request, { instance, definition, ventureStatus: venture.lifecycle }),
      evaluatedAt,
    );
  }

  const capabilityId = request.capabilityId.trim();
  if (!capabilityId) {
    return deny(
      "CAPABILITY_UNKNOWN",
      snapshot(request, {
        instance,
        definition,
        ventureStatus: venture.lifecycle,
      }),
      evaluatedAt,
    );
  }

  const capability = deps.capabilities.get(capabilityId);
  if (!capability) {
    return deny(
      "CAPABILITY_UNKNOWN",
      snapshot(request, {
        instance,
        definition,
        ventureStatus: venture.lifecycle,
      }),
      evaluatedAt,
    );
  }

  if (!USABLE_CAPABILITY_LIFECYCLES.has(capability.lifecycle)) {
    return deny(
      "CAPABILITY_DISABLED",
      snapshot(request, {
        instance,
        definition,
        ventureStatus: venture.lifecycle,
      }),
      evaluatedAt,
    );
  }

  const context = snapshot(request, {
    instance,
    definition,
    ventureStatus: venture.lifecycle,
  });

  if (isFounderOnlyCapability(capabilityId)) {
    return deny("CAPABILITY_DENIED", context, evaluatedAt);
  }

  if (definition.capabilityDenyList.includes(capabilityId)) {
    return deny("CAPABILITY_DENIED", context, evaluatedAt);
  }

  if (!definition.capabilityAllowList.includes(capabilityId)) {
    return deny("CAPABILITY_NOT_ALLOWED", context, evaluatedAt);
  }

  if (definition.autonomyCeiling === "observe") {
    return deny("AUTONOMY_EXCEEDED", context, evaluatedAt);
  }

  if (
    definition.autonomyCeiling === "prepare" ||
    definition.approvalBoundary === capabilityId
  ) {
    return {
      ok: true,
      decision: { outcome: "ALLOW_WITH_APPROVAL", reason: "APPROVAL_REQUIRED" },
      context,
      evaluatedAt,
    };
  }

  return {
    ok: true,
    decision: { outcome: "ALLOW" },
    context,
    evaluatedAt,
  };
}

function isFounderOnlyCapability(capabilityId: string) {
  return (FOUNDER_ONLY_CAPABILITIES as readonly string[]).includes(capabilityId);
}

function isOperatingVenture(lifecycle: string) {
  return (
    isVentureLifecycle(lifecycle) && OPERATING_VENTURE_LIFECYCLES.has(lifecycle)
  );
}

function deny(
  reason: AuthorityDenyReason,
  context: EnforcementContext,
  evaluatedAt: string,
): AuthorityEvaluation {
  return {
    ok: true,
    decision: { outcome: "DENY", reason },
    context,
    evaluatedAt,
  };
}

function snapshot(
  request: AuthorityRequest,
  parts?: {
    instance?: AgentInstance;
    definition?: AgentDefinition;
    ventureStatus?: string;
  },
): EnforcementContext {
  const instance = parts?.instance;
  const definition = parts?.definition;
  const capabilityScope = effectiveCapabilityScope(definition);
  const instanceStatus: AgentInstanceStatus = instance?.status ?? "disabled";
  const definitionLifecycle = definition?.lifecycle ?? "DISABLED";
  const definitionId = instance?.definitionId ?? definition?.id;
  const definitionVersion =
    instance?.definitionVersion ?? definition?.version ?? "";
  const ventureStatus = parts?.ventureStatus ?? "";

  const context: EnforcementContext = {
    workspaceId: request.workspaceId,
    ventureId: request.ventureId,
    agentInstanceId: request.agentInstanceId,
    definitionId: definitionId ?? ("" as EnforcementContext["definitionId"]),
    definitionVersion,
    capabilityScope,
    instanceStatus,
    definitionLifecycle,
    ventureStatus,
    contextVersion: "",
  };

  context.contextVersion = composeContextVersion(context);
  return context;
}

function effectiveCapabilityScope(definition: AgentDefinition | undefined) {
  if (!definition) {
    return [];
  }

  const denied = new Set(definition.capabilityDenyList);
  return unique(definition.capabilityAllowList.filter((id) => !denied.has(id))).sort();
}

function composeContextVersion(context: EnforcementContext) {
  return [
    context.agentInstanceId,
    `${context.definitionId}@${context.definitionVersion}`,
    context.workspaceId,
    context.ventureId,
    context.instanceStatus,
    context.definitionLifecycle,
    context.ventureStatus,
    [...context.capabilityScope].sort().join(","),
  ].join("|");
}

function unique(values: string[]) {
  return [...new Set(values)];
}
