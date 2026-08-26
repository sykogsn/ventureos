import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentDefinitionId, AgentInstanceId } from "@/contracts/ids";
import {
  platformCapabilityCatalog,
  platformCapabilityRegistry,
} from "@/core/capability/catalog";
import { createCapabilityRegistry } from "@/core/capability/registry";
import type { CapabilityLifecycle } from "@/core/capability/lifecycle";
import {
  evaluateAuthority,
  FOUNDER_ONLY_CAPABILITIES,
  isEnforcementContext,
  isModelContext,
  type AuthorityEvaluatorDeps,
  type VentureScopePort,
} from "./authority";
import { createWorkforceDefinitionRegistry } from "./definitions";
import { createWorkforceInstanceRegistry } from "./instances";
import type {
  AgentDefinition,
  AgentInstance,
  AgentWorkforceActor,
  AuthorityRequest,
  HumanWorkforceActor,
  ModelContext,
} from "./types";

const userId = "user-1" as UserId;
const workspaceId = "ws-1" as WorkspaceId;
const otherWorkspaceId = "ws-2" as WorkspaceId;
const ventureId = "venture-1" as VentureId;
const otherVentureId = "venture-2" as VentureId;
const agentInstanceId = "instance-1" as AgentInstanceId;
const otherInstanceId = "instance-2" as AgentInstanceId;
const definitionId = "definition-1" as AgentDefinitionId;
const allowedCapability = "intelligence.knowledge-graph";
const otherCapability = "intelligence.policy-engine";
const founderCapability = "governance.founder-decision";
const unknownCapability = "capability.does-not-exist";

const kernelPath = join(dirname(fileURLToPath(import.meta.url)), "../../platform/kernel.ts");
const authorityPath = join(dirname(fileURLToPath(import.meta.url)), "authority.ts");

function agentActor(
  overrides: Partial<AgentWorkforceActor> = {},
): AgentWorkforceActor {
  return {
    kind: "agent",
    agentInstanceId,
    workspaceId,
    ventureId,
    ...overrides,
  };
}

function definition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: definitionId,
    version: "1",
    role: "Research Analyst",
    responsibilities: ["Prepare cited findings."],
    capabilityAllowList: [allowedCapability],
    capabilityDenyList: [founderCapability],
    autonomyCeiling: "execute",
    approvalBoundary: "",
    memoryPolicy: "run-scoped",
    escalationPolicy: "fail-run",
    evaluationProfile: "verifiedCompletion",
    lifecycle: "ACTIVE",
    ...overrides,
  };
}

function instance(overrides: Partial<AgentInstance> = {}): AgentInstance {
  return {
    id: agentInstanceId,
    definitionId,
    definitionVersion: "1",
    workspaceId,
    ventureId,
    status: "active",
    ...overrides,
  };
}

function presentScope(lifecycle = "operating"): VentureScopePort {
  return {
    async lookup() {
      return {
        ok: true,
        value: {
          workspaceFound: true,
          venture: { workspaceId, lifecycle },
        },
      };
    },
  };
}

function deps(input: {
  definitions?: AgentDefinition[];
  instances?: AgentInstance[];
  scope?: VentureScopePort;
  capabilities?: AuthorityEvaluatorDeps["capabilities"];
} = {}): AuthorityEvaluatorDeps {
  return {
    definitions: createWorkforceDefinitionRegistry(input.definitions ?? [definition()]),
    instances: createWorkforceInstanceRegistry(input.instances ?? [instance()]),
    capabilities: input.capabilities ?? platformCapabilityRegistry,
    scope: input.scope ?? presentScope(),
  };
}

function request(overrides: Partial<AuthorityRequest> = {}): AuthorityRequest {
  return {
    actor: agentActor(),
    agentInstanceId,
    workspaceId,
    ventureId,
    capabilityId: allowedCapability,
    ...overrides,
  };
}

async function decide(overrides?: {
  request?: Partial<AuthorityRequest>;
  deps?: Parameters<typeof deps>[0];
}) {
  return evaluateAuthority(request(overrides?.request), deps(overrides?.deps));
}

function capabilityRegistryWith(
  id: string,
  lifecycle: CapabilityLifecycle,
) {
  return createCapabilityRegistry(
    platformCapabilityCatalog.map((item) =>
      item.id === id ? { ...item, lifecycle } : item,
    ),
  );
}

describe("evaluateAuthority", () => {
  it("denies a human actor that cannot masquerade as an agent", async () => {
    const human: HumanWorkforceActor = { kind: "human", userId, workspaceId, ventureId };
    const result = await decide({ request: { actor: human } });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.decision.outcome, "DENY");
      if (result.decision.outcome === "DENY") {
        assert.equal(result.decision.reason, "ACTOR_INVALID");
      }
    }
  });

  it("fails closed when explicit kind is missing", async () => {
    const result = await evaluateAuthority(
      request({
        actor: {
          agentInstanceId,
          workspaceId,
          ventureId,
        } as AuthorityRequest["actor"],
      }),
      deps(),
    );

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "ACTOR_INVALID");
    }
  });

  it("denies actor and AgentInstance mismatch", async () => {
    const result = await decide({
      request: {
        actor: agentActor({ agentInstanceId: otherInstanceId }),
      },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "INSTANCE_MISMATCH");
    }
  });

  it("denies workspace mismatch", async () => {
    const result = await decide({
      request: {
        actor: agentActor({ workspaceId: otherWorkspaceId }),
        workspaceId: otherWorkspaceId,
      },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "WORKSPACE_MISMATCH");
    }
  });

  it("denies Venture mismatch", async () => {
    const result = await decide({
      request: {
        actor: agentActor({ ventureId: otherVentureId }),
        ventureId: otherVentureId,
      },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "VENTURE_MISMATCH");
    }
  });

  it("denies definition version mismatch", async () => {
    const result = await decide({
      deps: {
        definitions: [definition({ version: "2" })],
        instances: [instance({ definitionVersion: "1" })],
      },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "DEFINITION_VERSION_MISMATCH");
    }
  });

  it("denies DRAFT, DISABLED, and REVOKED definitions", async () => {
    for (const lifecycle of ["DRAFT", "DISABLED", "REVOKED"] as const) {
      const result = await decide({
        deps: { definitions: [definition({ lifecycle })] },
      });
      assert.equal(result.ok, true);
      if (result.ok && result.decision.outcome === "DENY") {
        assert.equal(result.decision.reason, "DEFINITION_INACTIVE", lifecycle);
      }
    }
  });

  it("denies a disabled instance", async () => {
    const result = await decide({
      deps: { instances: [instance({ status: "disabled" })] },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "INSTANCE_INACTIVE");
    }
  });

  it("lets deny override allow", async () => {
    const result = await decide({
      deps: {
        definitions: [
          definition({
            capabilityAllowList: [allowedCapability],
            capabilityDenyList: [allowedCapability],
          }),
        ],
      },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "CAPABILITY_DENIED");
    }
  });

  it("denies an unknown capability", async () => {
    const result = await decide({ request: { capabilityId: unknownCapability } });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "CAPABILITY_UNKNOWN");
    }
  });

  it("denies deprecated and experimental capabilities", async () => {
    for (const lifecycle of ["deprecated", "experimental"] as const) {
      const result = await decide({
        deps: {
          capabilities: capabilityRegistryWith(allowedCapability, lifecycle),
        },
      });
      assert.equal(result.ok, true);
      if (result.ok && result.decision.outcome === "DENY") {
        assert.equal(result.decision.reason, "CAPABILITY_DISABLED", lifecycle);
      }
    }
  });

  it("denies a capability absent from the allow-list", async () => {
    const result = await decide({ request: { capabilityId: otherCapability } });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "CAPABILITY_NOT_ALLOWED");
    }
  });

  it("allows an allowed capability at execute autonomy", async () => {
    const result = await decide();

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.decision.outcome, "ALLOW");
      assert.deepEqual(result.context.capabilityScope, [allowedCapability]);
      assert.equal(result.context.ventureStatus, "operating");
    }
  });

  it("requires approval for an allowed capability at prepare autonomy", async () => {
    const result = await decide({
      deps: { definitions: [definition({ autonomyCeiling: "prepare" })] },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.decision.outcome, "ALLOW_WITH_APPROVAL");
      if (result.decision.outcome === "ALLOW_WITH_APPROVAL") {
        assert.equal(result.decision.reason, "APPROVAL_REQUIRED");
      }
    }
  });

  it("does not let execute broaden capability scope", async () => {
    const result = await decide({
      request: { capabilityId: otherCapability },
      deps: { definitions: [definition({ autonomyCeiling: "execute" })] },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "CAPABILITY_NOT_ALLOWED");
    }
  });

  it("fails closed for a malformed actor", async () => {
    const result = await evaluateAuthority(
      request({ actor: null as unknown as AuthorityRequest["actor"] }),
      deps(),
    );

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "ACTOR_INVALID");
    }
  });

  it("does not treat ModelContext as EnforcementContext", () => {
    const model: ModelContext = {
      objective: "Cite one finding.",
      citations: [{ sourceType: "finding", sourceId: "finding-1", excerpt: "Gap." }],
    };
    const enforcement = {
      workspaceId,
      ventureId,
      agentInstanceId,
      definitionId,
      definitionVersion: "1",
      capabilityScope: [allowedCapability],
      contextVersion: "ctx-1",
      ventureStatus: "operating",
      instanceStatus: "active" as const,
      definitionLifecycle: "ACTIVE" as const,
    };

    assert.equal(isModelContext(model), true);
    assert.equal(isEnforcementContext(model), false);
    assert.equal(isEnforcementContext(enforcement), true);
    assert.equal(isModelContext(enforcement), false);
    assert.equal("contextVersion" in model, false);
  });

  it("ignores a model-supplied authority claim", async () => {
    const forged = {
      ...request(),
      authority: "ALLOW",
      decision: { outcome: "ALLOW" },
    };

    const result = await evaluateAuthority(forged, deps({
      definitions: [definition({ capabilityAllowList: [] })],
    }));

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "CAPABILITY_NOT_ALLOWED");
    }
  });

  it("re-evaluates after state mutation and changes contextVersion", async () => {
    const first = await decide();
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    assert.equal(first.decision.outcome, "ALLOW");

    const second = await decide({
      deps: { instances: [instance({ status: "disabled" })] },
    });
    assert.equal(second.ok, true);
    if (second.ok && second.decision.outcome === "DENY") {
      assert.equal(second.decision.reason, "INSTANCE_INACTIVE");
      assert.notEqual(second.context.contextVersion, first.context.contextVersion);
    }
  });

  it("is deterministic for the same authoritative state", async () => {
    const first = await decide();
    const second = await decide();

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok && second.ok) {
      assert.deepEqual(first.decision, second.decision);
      assert.equal(first.context.contextVersion, second.context.contextVersion);
      assert.deepEqual(first.context.capabilityScope, second.context.capabilityScope);
    }
  });

  it("hard-denies governance.founder-decision even when allow-listed", async () => {
    assert.deepEqual([...FOUNDER_ONLY_CAPABILITIES], [founderCapability]);
    const result = await decide({
      request: { capabilityId: founderCapability },
      deps: {
        definitions: [
          definition({
            capabilityAllowList: [founderCapability],
            capabilityDenyList: [],
            autonomyCeiling: "execute",
          }),
        ],
      },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "CAPABILITY_DENIED");
    }
  });

  it("never treats infrastructure UNAVAILABLE as ALLOW", async () => {
    const unavailable: VentureScopePort = {
      async lookup() {
        return { ok: false };
      },
    };
    const result = await decide({ deps: { scope: unavailable } });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "UNAVAILABLE");
    }

    const throwing: VentureScopePort = {
      async lookup() {
        throw new Error("disk offline");
      },
    };
    const thrown = await decide({ deps: { scope: throwing } });
    assert.equal(thrown.ok, false);
    if (!thrown.ok) {
      assert.equal(thrown.failure, "UNAVAILABLE");
    }
  });

  it("denies a sunset Venture definition", async () => {
    const result = await decide({ deps: { scope: presentScope("sunset") } });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "VENTURE_INACTIVE");
    }
  });

  it("requires approval when execute hits the explicit approval boundary", async () => {
    const result = await decide({
      deps: {
        definitions: [
          definition({
            autonomyCeiling: "execute",
            approvalBoundary: allowedCapability,
          }),
        ],
      },
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.decision.outcome, "ALLOW_WITH_APPROVAL");
    }
  });

  it("denies observe autonomy for an otherwise allowed capability", async () => {
    const result = await decide({
      deps: { definitions: [definition({ autonomyCeiling: "observe" })] },
    });

    assert.equal(result.ok, true);
    if (result.ok && result.decision.outcome === "DENY") {
      assert.equal(result.decision.reason, "AUTONOMY_EXCEEDED");
    }
  });

  it("has no LLM or ModelPort dependency", async () => {
    const source = await readFile(authorityPath, "utf8");
    assert.doesNotMatch(source, /ModelPort/);
    assert.doesNotMatch(source, /openai/i);
    assert.doesNotMatch(source, /invoke\(/);
  });

  it("registers a bounded workforce.run.step kernel handler and not an autonomous loop", async () => {
    const source = await readFile(kernelPath, "utf8");
    assert.match(source, /jobs\.register\("noop"/);
    assert.match(source, /jobs\.register\(WORKFORCE_RUN_STEP_JOB/);
    assert.doesNotMatch(source, /createOpenAIModelPort/);
    assert.doesNotMatch(source, /createWorkforceExecutionGate/);
    assert.doesNotMatch(source, /execution-probe/);
  });
});
