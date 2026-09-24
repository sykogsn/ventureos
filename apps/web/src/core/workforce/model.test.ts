import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentInstanceId, VentureId, WorkspaceId } from "@/contracts/ids";
import { isEnforcementContext } from "./authority";
import {
  createFakeModelPort,
  MODEL_EVIDENCE_LIMIT,
  MODEL_UNTRUSTED_TEXT_LIMIT,
} from "./model";
import type {
  AuthorityDecision,
  EnforcementContext,
  ModelReasoningResult,
  ModelRequest,
  ModelResult,
} from "./types";

const workspaceId = "ws-1" as WorkspaceId;
const ventureId = "venture-1" as VentureId;
const agentInstanceId = "instance-1" as AgentInstanceId;
const allowedCapability = "intelligence.knowledge-graph";

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    requestId: "req-1",
    workspaceId,
    ventureId,
    agentInstanceId,
    purpose: "workforce.reason",
    platformInstructions: "Follow VentureOS platform rules.",
    roleInstructions: "Research Analyst. Prepare cited findings.",
    task: "Summarise the supplied note.",
    context: { objective: "Identify one gap.", citations: [] },
    evidence: [{ id: "ev-1", sourceType: "note", excerpt: "Coverage is incomplete." }],
    candidateCapabilities: [
      { id: allowedCapability, description: "Knowledge graph facts." },
    ],
    ...overrides,
  };
}

function validOutput(overrides: Partial<ModelReasoningResult> = {}): ModelReasoningResult {
  return {
    summary: "Coverage is incomplete.",
    explanation: "The supplied note states a gap.",
    findings: [{ statement: "Coverage gap.", evidenceIds: ["ev-1"] }],
    uncertainties: ["Sample size is unknown."],
    proposedActions: [
      {
        capabilityId: allowedCapability,
        intent: "Retrieve related knowledge.",
        arguments: { query: "coverage" },
        rationale: "Ground the gap.",
        evidenceIds: ["ev-1"],
      },
    ],
    ...overrides,
  };
}

describe("ModelPort domain", () => {
  it("keeps ModelRequest free of OpenAI-specific fields", () => {
    const keys = Object.keys(request()).sort();
    assert.deepEqual(keys, [
      "agentInstanceId",
      "candidateCapabilities",
      "context",
      "evidence",
      "platformInstructions",
      "purpose",
      "requestId",
      "roleInstructions",
      "task",
      "ventureId",
      "workspaceId",
    ]);
    assert.equal("messages" in request(), false);
    assert.equal("temperature" in request(), false);
    assert.equal("response_format" in request(), false);
    assert.equal("text" in request(), false);
  });

  it("returns a validated reasoning result from the fake port", async () => {
    const port = createFakeModelPort(validOutput());
    const result = await port.invoke(request());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.summary, "Coverage is incomplete.");
      assert.equal("confidence" in result.data, false);
      assert.equal("chainOfThought" in result.data, false);
      assert.equal(result.trace.provider, "fake");
      assert.equal(result.trace.model, "fake");
    }
  });

  it("rejects unknown evidence ids as INVALID_OUTPUT", async () => {
    const port = createFakeModelPort(
      validOutput({
        findings: [{ statement: "Invented.", evidenceIds: ["ev-missing"] }],
      }),
    );
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_OUTPUT");
    }
  });

  it("rejects a capability outside the candidate set as INVALID_OUTPUT", async () => {
    const port = createFakeModelPort(
      validOutput({
        proposedActions: [
          {
            capabilityId: "intelligence.policy-engine",
            intent: "Evaluate policy.",
            arguments: {},
            rationale: "Hallucinated.",
            evidenceIds: ["ev-1"],
          },
        ],
      }),
    );
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_OUTPUT");
    }
  });

  it("rejects the whole result when one of several actions is unknown", async () => {
    const port = createFakeModelPort(
      validOutput({
        proposedActions: [
          {
            capabilityId: allowedCapability,
            intent: "Retrieve related knowledge.",
            arguments: {},
            rationale: "Valid.",
            evidenceIds: ["ev-1"],
          },
          {
            capabilityId: "not.a.capability",
            intent: "Do something else.",
            arguments: {},
            rationale: "Invalid.",
            evidenceIds: ["ev-1"],
          },
        ],
      }),
    );
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_OUTPUT");
    }
  });

  it("rejects schema-invalid output", async () => {
    const port = createFakeModelPort({ summary: "only" });
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_OUTPUT");
    }
  });

  it("rejects empty output", async () => {
    const port = createFakeModelPort("");
    const result = await port.invoke(request());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_OUTPUT");
    }
  });

  it("rejects oversized untrusted text before treating output as success", async () => {
    const port = createFakeModelPort(validOutput());
    const result = await port.invoke(
      request({ task: "x".repeat(MODEL_UNTRUSTED_TEXT_LIMIT + 1) }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_OUTPUT");
    }
  });

  it("rejects too many evidence items", async () => {
    const port = createFakeModelPort(validOutput());
    const evidence = Array.from({ length: MODEL_EVIDENCE_LIMIT + 1 }, (_, index) => ({
      id: `ev-${index}`,
      sourceType: "note",
      excerpt: "n",
    }));
    const result = await port.invoke(request({ evidence }));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "INVALID_OUTPUT");
    }
  });

  it("does not treat ModelResult as AuthorityDecision or EnforcementContext", async () => {
    const port = createFakeModelPort(validOutput());
    const result: ModelResult = await port.invoke(request());
    assert.equal("decision" in result, false);
    assert.equal(isEnforcementContext(result), false);
    if (result.ok) {
      assert.equal("outcome" in result.data, false);
      assert.equal(isEnforcementContext(result.data), false);
      const decision: AuthorityDecision = { outcome: "DENY", reason: "CAPABILITY_UNKNOWN" };
      assert.notDeepEqual(result.data, decision);
      const enforcement: EnforcementContext = {
        workspaceId,
        ventureId,
        agentInstanceId,
        definitionId: "definition-1" as EnforcementContext["definitionId"],
        definitionVersion: "1",
        capabilityScope: [allowedCapability],
        contextVersion: "ctx",
        ventureStatus: "operating",
        instanceStatus: "active",
        definitionLifecycle: "ACTIVE",
      };
      assert.notDeepEqual(result.data, enforcement);
    }
  });

  it("normalises OpenAI-style argument entries into domain arguments", async () => {
    const port = createFakeModelPort({
      ...validOutput(),
      proposedActions: [
        {
          capabilityId: allowedCapability,
          intent: "Retrieve related knowledge.",
          arguments: [{ name: "query", value: "coverage" }],
          rationale: "Ground the gap.",
          evidenceIds: ["ev-1"],
        },
      ],
    });
    const result = await port.invoke(request());
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data.proposedActions[0]?.arguments, { query: "coverage" });
    }
  });
});
