import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Actor, UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentDefinitionId, AgentInstanceId, JobId } from "@/contracts/ids";
import {
  isAgentActor,
  isHumanActor,
  isSystemActor,
  toHumanWorkforceActor,
} from "./actor";
import {
  AGENT_DEFINITION_LIFECYCLE,
  AUTHORITY_DECISIONS,
  VERIFICATION_RESULTS,
  type AgentDefinition,
  type AgentInstance,
  type AgentWorkforceActor,
  type AuthorityDecision,
  type EnforcementContext,
  type ExecutionOutcome,
  type HumanWorkforceActor,
  type ModelContext,
  type SystemWorkforceActor,
  type VerificationResult,
  type WorkforceRun,
} from "./types";

const userId = "user-1" as UserId;
const workspaceId = "ws-1" as WorkspaceId;
const ventureId = "venture-1" as VentureId;
const agentInstanceId = "instance-1" as AgentInstanceId;
const definitionId = "definition-1" as AgentDefinitionId;

describe("WorkforceActor", () => {
  it("distinguishes human actors from agent actors", () => {
    const human: HumanWorkforceActor = { kind: "human", userId };
    const agent: AgentWorkforceActor = {
      kind: "agent",
      agentInstanceId,
      workspaceId,
      ventureId,
    };

    assert.equal(isHumanActor(human), true);
    assert.equal(isAgentActor(human), false);
    assert.equal(isHumanActor(agent), false);
    assert.equal(isAgentActor(agent), true);
  });

  it("does not require UserId on agent actors", () => {
    const agent: AgentWorkforceActor = {
      kind: "agent",
      agentInstanceId,
      workspaceId,
      ventureId,
    };

    assert.equal("userId" in agent, false);
    assert.equal(isAgentActor(agent), true);
  });

  it("does not require AgentInstanceId on human actors", () => {
    const human: HumanWorkforceActor = { kind: "human", userId };

    assert.equal("agentInstanceId" in human, false);
    assert.equal(isHumanActor(human), true);
  });

  it("does not treat a missing kind as a human actor", () => {
    const legacy: Actor = { userId, workspaceId, ventureId };
    const malformed = { userId };

    assert.equal(isHumanActor(legacy), false);
    assert.equal(isHumanActor(malformed), false);
    assert.equal(isAgentActor(legacy), false);
    assert.equal(isSystemActor(legacy), false);
  });

  it("converts an existing Actor to a human WorkforceActor explicitly", () => {
    const legacy: Actor = { userId, workspaceId, ventureId };
    const human = toHumanWorkforceActor(legacy);

    assert.equal(human.kind, "human");
    assert.equal(human.userId, userId);
    assert.equal(isHumanActor(human), true);
  });

  it("distinguishes system actors without treating them as humans", () => {
    const system: SystemWorkforceActor = {
      kind: "system",
      component: "workforce-run",
    };

    assert.equal(isSystemActor(system), true);
    assert.equal(isHumanActor(system), false);
    assert.equal(isAgentActor(system), false);
  });
});

describe("AgentDefinition lifecycle", () => {
  it("contains DRAFT, ACTIVE, DISABLED, and REVOKED", () => {
    assert.deepEqual([...AGENT_DEFINITION_LIFECYCLE], [
      "DRAFT",
      "ACTIVE",
      "DISABLED",
      "REVOKED",
    ]);
  });

  it("does not include REVIEW", () => {
    assert.equal(
      (AGENT_DEFINITION_LIFECYCLE as readonly string[]).includes("REVIEW"),
      false,
    );
  });

  it("accepts a role contract without personality fields", () => {
    const definition: AgentDefinition = {
      id: definitionId,
      version: "1",
      role: "Qualora Evidence Analyst",
      responsibilities: ["Prepare a cited evidence pack."],
      capabilityAllowList: ["knowledge.retrieve"],
      capabilityDenyList: ["governance.founder-decision"],
      autonomyCeiling: "prepare",
      approvalBoundary: "governance.prepareDecision",
      memoryPolicy: "run-scoped",
      escalationPolicy: "fail-run",
      evaluationProfile: "verifiedCompletion",
      lifecycle: "DRAFT",
    };

    assert.equal("biography" in definition, false);
    assert.equal("avatar" in definition, false);
  });
});

describe("AuthorityDecision", () => {
  it("contains ALLOW, ALLOW_WITH_APPROVAL, and DENY", () => {
    assert.deepEqual([...AUTHORITY_DECISIONS], [
      "ALLOW",
      "ALLOW_WITH_APPROVAL",
      "DENY",
    ]);
  });

  it("does not include ESCALATE", () => {
    assert.equal(
      (AUTHORITY_DECISIONS as readonly string[]).includes("ESCALATE"),
      false,
    );
    const decision: AuthorityDecision = {
      outcome: "DENY",
      reason: "unknown executor",
    };
    assert.equal(decision.outcome === "ALLOW", false);
  });
});

describe("context and outcome contracts", () => {
  it("keeps ModelContext distinct from EnforcementContext", () => {
    const enforcement: EnforcementContext = {
      workspaceId,
      ventureId,
      agentInstanceId,
      definitionId,
      definitionVersion: "1",
      capabilityScope: ["knowledge.retrieve"],
      contextVersion: "ctx-1",
      ventureStatus: "active",
      instanceStatus: "active",
      definitionLifecycle: "ACTIVE",
    };
    const model: ModelContext = {
      objective: "Cite one Qualora finding.",
      citations: [{ sourceType: "finding", sourceId: "finding-1", excerpt: "Gap." }],
    };

    assert.equal("contextVersion" in enforcement, true);
    assert.equal("capabilityScope" in enforcement, true);
    assert.equal("contextVersion" in model, false);
    assert.equal("capabilityScope" in model, false);
    assert.equal("objective" in model, true);
    assert.equal("objective" in enforcement, false);
  });

  it("keeps ExecutionOutcome distinct from VerificationResult", () => {
    const execution: ExecutionOutcome = {
      executorId: "knowledge.retrieve",
      ok: true,
    };
    const verification: VerificationResult = { outcome: "VERIFIED" };

    assert.equal("executorId" in execution, true);
    assert.equal("executorId" in verification, false);
    assert.equal("outcome" in verification, true);
    assert.deepEqual([...VERIFICATION_RESULTS], ["VERIFIED", "NOT_VERIFIED"]);
    assert.equal(
      (VERIFICATION_RESULTS as readonly string[]).includes("UNCERTAIN"),
      false,
    );
  });

  it("binds a WorkforceRun to one workspace, venture, and instance", () => {
    const instance: AgentInstance = {
      id: agentInstanceId,
      definitionId,
      definitionVersion: "1",
      workspaceId,
      ventureId,
      status: "active",
    };
    const run: WorkforceRun = {
      jobId: "job-1" as JobId,
      objective: "qualora.evidence-analyst.cite-and-prepare-finding",
      agentInstanceId: instance.id,
      workspaceId: instance.workspaceId,
      ventureId: instance.ventureId,
      definitionVersion: instance.definitionVersion,
      contextVersion: "ctx-1",
      phase: "awaiting_approval",
      limits: {
        maxSteps: 8,
        maxModelCalls: 3,
        maxDurationMs: 900_000,
        retryCeiling: 2,
        maxModelTokens: 12_000,
      },
      usage: { modelCallCount: 0, inputTokens: 0, outputTokens: 0 },
      executorOutcomes: [],
    };

    assert.equal(run.ventureId, instance.ventureId);
    assert.equal(run.workspaceId, instance.workspaceId);
    assert.equal(run.agentInstanceId, instance.id);
  });
});
