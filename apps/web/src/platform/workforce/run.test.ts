import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentDefinitionId, AgentInstanceId } from "@/contracts/ids";
import { CAPABILITY_CONTRACTS } from "@/core/capability/contracts";
import { platformCapabilityCatalog } from "@/core/capability/catalog";
import { createCapabilityManifest } from "@/core/capability/model";
import { createCapabilityRegistry } from "@/core/capability/registry";
import { WORKFORCE_APPROVAL_PERMISSION } from "@/core/workforce/approval";
import {
  createWorkforceExecutionGate,
} from "@/core/workforce/execution";
import {
  createExecutionProbeExecutor,
  createProbeAuthoritativeStore,
  createWorkforceExecutorRegistry,
  EXECUTION_PROBE_CAPABILITY_ID,
} from "@/core/workforce/executors";
import {
  createExecutionProbeVerifier,
  createWorkforceVerifierRegistry,
} from "@/core/workforce/verifiers";
import { createFakeModelPort } from "@/core/workforce/model";
import {
  createWorkforceRunOrchestrator,
  WORKFORCE_RUN_MAX_MODEL_CALLS,
  WORKFORCE_RUN_STEP_JOB,
} from "@/core/workforce/run";
import type {
  AgentDefinition,
  AgentInstance,
  HumanWorkforceActor,
  ModelReasoningResult,
  ModelRequest,
  ProposedAction,
} from "@/core/workforce/types";
import type { VentureLifecycle } from "@/core/venture-definition/lifecycle";
import { createJobOrchestrator } from "@/platform/jobs/orchestrator";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { jobs as jobTable } from "@/platform/persistence/schema";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import { createWorkforceApprovalSatisfactionPort } from "@/platform/workforce/approval-store";
import { createWorkforceApprovalStore } from "@/platform/workforce/approval-store";
import { createWorkforceDefinitionRepository } from "@/platform/workforce/definition-repository";
import { createWorkforceExecutionStore } from "@/platform/workforce/execution-store";
import { createWorkforceInstanceRepository } from "@/platform/workforce/instance-repository";
import { createWorkforceRunStepHandler } from "@/platform/workforce/run-handler";
import { createWorkforceRunStore } from "@/platform/workforce/run-store";
import { createWorkforceVerificationStore } from "@/platform/workforce/verification-store";
import { createVentureScopePort } from "@/platform/workforce/venture-scope";
import { createAuditLog } from "@/platform/audit/log";
import {
  workforceExecutions as executionTable,
  workforceVerifications as verificationTable,
} from "@/platform/persistence/schema";

const userId = "user-1" as UserId;
const workspaceId = "ws-1" as WorkspaceId;
const ventureId = "venture-1" as VentureId;
const agentInstanceId = "instance-1" as AgentInstanceId;
const definitionId = "definition-1" as AgentDefinitionId;
const founderCapability = "governance.founder-decision";

const here = dirname(fileURLToPath(import.meta.url));
const kernelPath = join(here, "../kernel.ts");
const runPath = join(here, "../../core/workforce/run.ts");
const servicePath = join(here, "../../modules/workforce/service.ts");
const adapterPath = join(here, "../ai/openai-adapter.ts");

let tempDir: string | undefined;

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
  if (tempDir) {
    const dir = tempDir;
    tempDir = undefined;
    await removeDir(dir);
  }
});

async function removeDir(dir: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

async function fileDatabase() {
  tempDir = await mkdtemp(join(tmpdir(), "vos-run-"));
  const path = join(tempDir, "ventureos.db").replaceAll("\\", "/");
  return `file:${path}`;
}

function human(): HumanWorkforceActor {
  return { kind: "human", userId, workspaceId, ventureId };
}

function definition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: definitionId,
    version: "1",
    role: "Research Analyst",
    responsibilities: ["Prepare cited findings."],
    capabilityAllowList: [EXECUTION_PROBE_CAPABILITY_ID],
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

function action(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    capabilityId: EXECUTION_PROBE_CAPABILITY_ID,
    intent: "probe",
    arguments: { marker: "alpha" },
    rationale: "test",
    evidenceIds: [],
    ...overrides,
  };
}

function reasoning(actions: ProposedAction[]): ModelReasoningResult {
  return {
    summary: "done",
    explanation: "because",
    findings: [],
    uncertainties: [],
    proposedActions: actions,
  };
}

function probeCapability() {
  return createCapabilityManifest({
    id: EXECUTION_PROBE_CAPABILITY_ID,
    name: "Workforce Execution Probe",
    classification: "Platform",
    purpose: "Test-only controlled side-effect probe.",
    owner: "platform",
    version: "0.1.0",
    maturity: "experimental",
    lifecycle: "internal",
    dependencies: [],
    provides: [CAPABILITY_CONTRACTS.capabilityRegistry],
    requires: [],
    guarantees: ["Probe invocations are counted in-process."],
    limitations: ["Not part of the production catalogue."],
  });
}

async function drainDue(jobs: ReturnType<typeof createJobOrchestrator>, rounds = 8) {
  for (let i = 0; i < rounds; i += 1) {
    const processed = await jobs.processDue();
    if (processed === 0) {
      return;
    }
  }
}

async function releaseQueuedJobs() {
  await getDb()
    .update(jobTable)
    .set({ runAt: new Date().toISOString() })
    .where(eq(jobTable.status, "queued"));
}

async function seedScope(lifecycle: VentureLifecycle = "operating") {
  await ensureSchema();
  const store = getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "Alpha",
    slug: "alpha",
    createdAt: "2026-08-26T00:00:00.000Z",
  });
  await store.ventures.insert({
    id: ventureId,
    workspaceId,
    name: "North Star",
    slug: "north-star",
    stage: "Seed",
    href: "/ventures/hq/north-star",
    foundedAt: "2026-08-26T00:00:00.000Z",
    category: "SaaS",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "",
      category: "SaaS",
      stage: "Seed",
      goal: "",
      posture: "human-led",
      risk: "focused",
      motion: "",
      cadence: "",
    },
    mission: {
      today: {
        title: "",
        ask: "",
        whyNow: "",
        ifDeferred: "",
        timeNeeded: "",
        actionLabel: "",
        actionHref: "/",
        attention: "hold",
        founderAsk: "",
        active: false,
      },
      sprint: { name: "", objective: "", tasks: [] },
    },
    launchDraft: {},
    documents: { documents: [] },
    risk: { headline: "", signals: [] },
    definitionId: "ventureos.company",
    definitionVersion: "1.0.0",
    lifecycle,
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
  });
}

async function setup(options: {
  definition?: AgentDefinition;
  instance?: AgentInstance;
  actions?: ProposedAction[];
  model?: ReturnType<typeof createFakeModelPort>;
  lifecycle?: "concept" | "incubating" | "operating" | "scaling" | "sunset";
  canApprove?: boolean;
  databaseUrl?: string;
  hydrateOnly?: boolean;
  includeVerifier?: boolean;
  observeScript?: Array<"observed" | "missing" | "unavailable" | "timeout" | "invalid">;
  authoritativeStore?: ReturnType<typeof createProbeAuthoritativeStore>;
} = {}) {
  if (!options.hydrateOnly) {
    await resetPersistenceLifecycle(options.databaseUrl ?? ":memory:");
    await seedScope(options.lifecycle ?? "operating");
  } else if (options.databaseUrl) {
    await resetPersistenceLifecycle(options.databaseUrl);
  }
  const definitions = createWorkforceDefinitionRepository();
  const instances = createWorkforceInstanceRepository();
  if (!options.hydrateOnly) {
    await definitions.publish(options.definition ?? definition());
    await instances.insert(options.instance ?? instance());
  }

  const authoritativeStore =
    options.authoritativeStore ?? createProbeAuthoritativeStore();
  const probe = createExecutionProbeExecutor(authoritativeStore);
  const probeVerifier = createExecutionProbeVerifier(authoritativeStore, {
    observeScript: options.observeScript,
  });
  const executors = createWorkforceExecutorRegistry([probe.executor]);
  const verifiers = createWorkforceVerifierRegistry(
    options.includeVerifier === false ? [] : [probeVerifier.verifier],
  );
  const runs = createWorkforceRunStore();
  const approvals = createWorkforceApprovalStore();
  const verifications = createWorkforceVerificationStore();
  const jobs = createJobOrchestrator();
  const audit = createAuditLog();
  let modelCalls = 0;
  const payload = reasoning(options.actions ?? [action()]);
  const model =
    options.model ??
    createFakeModelPort((request: ModelRequest) => {
      modelCalls += 1;
      assert.equal(request.requestId.length > 0, true);
      return payload;
    });

  const execution = createWorkforceExecutionGate({
    definitions,
    instances,
    capabilities: createCapabilityRegistry([
      ...platformCapabilityCatalog,
      probeCapability(),
    ]),
    scope: createVentureScopePort(),
    executors,
    store: createWorkforceExecutionStore(),
    approvals: createWorkforceApprovalSatisfactionPort(approvals),
  });

  const orchestrator = createWorkforceRunOrchestrator({
    definitions,
    instances,
    capabilities: createCapabilityRegistry([
      ...platformCapabilityCatalog,
      probeCapability(),
    ]),
    scope: createVentureScopePort(),
    model,
    executors,
    verifiers,
    execution,
    runs,
    approvals,
    verifications,
    jobs: {
      enqueue: (name, jobPayload, runAt) => jobs.enqueue(name, jobPayload, runAt),
    },
    canApprove: async () => options.canApprove ?? true,
    audit,
  });

  jobs.register(WORKFORCE_RUN_STEP_JOB, createWorkforceRunStepHandler(orchestrator));

  return {
    orchestrator,
    jobs,
    runs,
    approvals,
    verifications,
    instances,
    definitions,
    probe,
    probeVerifier,
    authoritativeStore,
    audit,
    modelCalls: () => modelCalls,
  };
}

describe("WorkforceRun orchestrator", () => {
  it("keeps RunId independent from JobId and completes a single allowed action", async () => {
    const ctx = await setup();
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.notEqual(created.runId, created.jobId);
    await drainDue(ctx.jobs);
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.completionKind, "executed");
    assert.equal(run?.verificationOutcome, "VERIFIED");
    assert.equal(run?.modelCallCount, 1);
    assert.equal(ctx.probe.invocationCount(), 1);
    assert.equal(ctx.modelCalls(), 1);
    assert.equal(WORKFORCE_RUN_MAX_MODEL_CALLS, 1);
    const verification = await ctx.verifications.getByRunId(created.runId);
    assert.equal(verification?.status, "verified");
  });

  it("completes with no_action when the model proposes none", async () => {
    const ctx = await setup({ actions: [] });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "observe",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.completionKind, "no_action");
    assert.equal(ctx.probe.invocationCount(), 0);
    assert.equal(await ctx.verifications.getByRunId(created.runId), undefined);
  });

  it("does not execute when the model proposes more than one action", async () => {
    const ctx = await setup({
      actions: [action({ arguments: { marker: "a" } }), action({ arguments: { marker: "b" } })],
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "choose",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.completionKind, "multiple_proposed_actions");
    assert.equal(ctx.probe.invocationCount(), 0);
    assert.equal(ctx.modelCalls(), 1);
    assert.equal(await ctx.verifications.getByRunId(created.runId), undefined);
  });

  it("pauses for approval without occupying a running job", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "awaiting_approval");
    assert.equal(ctx.probe.invocationCount(), 0);
    const jobs = await getDb().select().from(jobTable);
    assert.equal(jobs.every((row) => row.status !== "running"), true);
    assert.equal(jobs.some((row) => row.status === "completed"), true);
  });

  it("requires an authorised human and rejects agent self-approval", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const agentResult = await ctx.orchestrator.approve(created.runId, {
      kind: "agent",
      agentInstanceId,
      workspaceId,
      ventureId,
    });
    assert.equal(agentResult.ok, false);
    if (!agentResult.ok) {
      assert.equal(agentResult.failure, "AGENT_CANNOT_APPROVE");
    }
    const forbidden = await ctx.orchestrator.approve(created.runId, human());
    assert.equal(forbidden.ok, true);
  });

  it("does not approve when the caller lacks venture.update", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
      canApprove: false,
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const result = await ctx.orchestrator.approve(created.runId, human());
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "FORBIDDEN");
    }
    assert.equal(WORKFORCE_APPROVAL_PERMISSION, "venture.update");
  });

  it("rejects without executing", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const rejected = await ctx.orchestrator.reject(created.runId, human());
    assert.equal(rejected.ok, true);
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "failed");
    assert.equal(run?.failureCategory, "APPROVAL_REJECTED");
    assert.equal(ctx.probe.invocationCount(), 0);
    assert.equal(await ctx.verifications.getByRunId(created.runId), undefined);
  });

  it("resumes with fresh authority after approval and executes once", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const approved = await ctx.orchestrator.approve(created.runId, human());
    assert.equal(approved.ok, true);
    await drainDue(ctx.jobs);
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.completionKind, "executed");
    assert.equal(run?.verificationOutcome, "VERIFIED");
    assert.equal(ctx.probe.invocationCount(), 1);
    assert.equal(ctx.modelCalls(), 1);
  });

  it("does not let a stale approval override disable, revoke, or sunset", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const approved = await ctx.orchestrator.approve(created.runId, human());
    assert.equal(approved.ok, true);
    await ctx.instances.setStatus(agentInstanceId, "disabled");
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "failed");
    assert.equal(run?.failureCategory, "AUTHORITY_DENIED");
    assert.equal(ctx.probe.invocationCount(), 0);
  });

  it("denies resume after definition revoke", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    await ctx.orchestrator.approve(created.runId, human());
    await ctx.definitions.setLifecycle(definitionId, "1", "REVOKED");
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.failureCategory, "AUTHORITY_DENIED");
    assert.equal(ctx.probe.invocationCount(), 0);
  });

  it("denies resume after Venture sunset", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    await ctx.orchestrator.approve(created.runId, human());
    const store = getPersistence();
    const row = await store.ventures.findById(ventureId);
    await store.ventures.update({ ...row!, lifecycle: "sunset" });
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.failureCategory, "AUTHORITY_DENIED");
    assert.equal(ctx.probe.invocationCount(), 0);
  });

  it("does not duplicate side effects on duplicate resume", async () => {
    const ctx = await setup({
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    await ctx.orchestrator.approve(created.runId, human());
    await drainDue(ctx.jobs);
    await ctx.jobs.enqueue(WORKFORCE_RUN_STEP_JOB, {
      runId: created.runId,
      step: "resume",
    });
    await drainDue(ctx.jobs);
    assert.equal(ctx.probe.invocationCount(), 1);
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.verificationOutcome, "VERIFIED");
  });

  it("survives restart while waiting for approval", async () => {
    const url = await fileDatabase();
    const first = await setup({
      databaseUrl: url,
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const created = await first.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "prepare",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await first.jobs.processDue();
    await first.orchestrator.approve(created.runId, human());

    const second = await setup({
      databaseUrl: url,
      hydrateOnly: true,
      definition: definition({ autonomyCeiling: "prepare" }),
    });
    const pending = await second.runs.get(created.runId);
    assert.equal(pending?.phase, "awaiting_approval");
    const approval = await second.approvals.getByRunId(created.runId);
    assert.equal(approval?.status, "APPROVED");
  });

  it("does not invoke the model more than once even if reason is delivered twice", async () => {
    const ctx = await setup();
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.enqueue(WORKFORCE_RUN_STEP_JOB, {
      runId: created.runId,
      step: "reason",
    });
    await ctx.jobs.processDue();
    assert.equal(ctx.modelCalls(), 1);
    assert.equal(ctx.probe.invocationCount(), 1);
  });

  it("keeps founder-decision hard-DENY and production service free of probe executors", async () => {
    const ctx = await setup({
      actions: [action({ capabilityId: founderCapability })],
      definition: definition({
        capabilityAllowList: [EXECUTION_PROBE_CAPABILITY_ID, founderCapability],
        capabilityDenyList: [],
      }),
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "found",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.failureCategory, "MODEL_FAILED");
    assert.equal(ctx.probe.invocationCount(), 0);

    const service = await readFile(servicePath, "utf8");
    assert.match(service, /createWorkforceExecutorRegistry\(\[\]\)/);
    assert.match(service, /createWorkforceVerifierRegistry\(\[\]\)/);
    assert.doesNotMatch(service, /execution-probe/);
    assert.doesNotMatch(service, /Qualora|Calviora|Farmora/);
  });

  it("does not loop, self-schedule reasoning, or call the OpenAI adapter from the orchestrator", async () => {
    const runSource = await readFile(runPath, "utf8");
    assert.match(runSource, /WORKFORCE_RUN_MAX_MODEL_CALLS = 1/);
    assert.doesNotMatch(runSource, /while\s*\(/);
    assert.doesNotMatch(runSource, /step:\s*"reason".*step:\s*"reason"/s);
    assert.doesNotMatch(runSource, /createOpenAIModelPort/);
    assert.equal([...runSource.matchAll(/model\.invoke/g)].length, 1);
    assert.match(runSource, /step:\s*"verify"/);
    assert.doesNotMatch(runSource, /createOpenAIModelPort/);

    const kernel = await readFile(kernelPath, "utf8");
    assert.match(kernel, /jobs\.register\(WORKFORCE_RUN_STEP_JOB/);
    assert.doesNotMatch(kernel, /createOpenAIModelPort/);

    const adapter = await readFile(adapterPath, "utf8");
    assert.doesNotMatch(adapter, /ExecutionPort/);
  });

  it("claims executing before the Sprint 5 gate and does not complete as executed before verification", async () => {
    const ctx = await setup();
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "verifying");
    assert.equal(run?.completionKind, null);
    assert.ok(run?.executionId);
    assert.equal(ctx.probe.invocationCount(), 1);
    const executions = await getDb().select().from(executionTable);
    assert.equal(executions[0]?.status, "succeeded");
  });

  it("verifies matching state and rejects wrong state without retry", async () => {
    const matched = await setup();
    const created = await matched.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await drainDue(matched.jobs);
    assert.equal((await matched.runs.get(created.runId))?.verificationOutcome, "VERIFIED");
    assert.equal(matched.modelCalls(), 1);

    const mismatched = await setup();
    const second = await mismatched.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(second.ok, true);
    if (!second.ok) {
      return;
    }
    await mismatched.jobs.processDue();
    mismatched.authoritativeStore.write(
      { workspaceId, ventureId, agentInstanceId },
      "wrong",
    );
    await drainDue(mismatched.jobs);
    const run = await mismatched.runs.get(second.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.verificationOutcome, "NOT_VERIFIED");
    assert.equal(mismatched.probe.invocationCount(), 1);
    const delayed = await getDb()
      .select()
      .from(jobTable)
      .where(eq(jobTable.status, "queued"));
    assert.equal(delayed.length, 0);
  });

  it("never marks VERIFIED from executor success alone", async () => {
    const ctx = await setup({ includeVerifier: false });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await drainDue(ctx.jobs);
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "failed");
    assert.equal(run?.failureCategory, "VERIFICATION_UNAVAILABLE");
    assert.equal(run?.verificationOutcome, null);
    assert.equal(ctx.probe.invocationCount(), 1);
  });

  it("fails the process after two observer unavailable or timeout results", async () => {
    const unavailable = await setup({
      observeScript: ["unavailable", "unavailable"],
    });
    const first = await unavailable.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    await drainDue(unavailable.jobs);
    await releaseQueuedJobs();
    await drainDue(unavailable.jobs);
    const failedUnavailable = await unavailable.runs.get(first.runId);
    assert.equal(failedUnavailable?.phase, "failed");
    assert.equal(failedUnavailable?.failureCategory, "VERIFICATION_UNAVAILABLE");
    assert.notEqual(failedUnavailable?.verificationOutcome, "NOT_VERIFIED");
    const unavailableRow = await unavailable.verifications.getByRunId(first.runId);
    assert.equal(unavailableRow?.status, "failed");
    assert.equal(unavailableRow?.failureCategory, "OBSERVER_UNAVAILABLE");

    const timed = await setup({ observeScript: ["timeout", "timeout"] });
    const second = await timed.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(second.ok, true);
    if (!second.ok) {
      return;
    }
    await drainDue(timed.jobs);
    await releaseQueuedJobs();
    await drainDue(timed.jobs);
    const failedTimeout = await timed.runs.get(second.runId);
    assert.equal(failedTimeout?.failureCategory, "VERIFICATION_UNAVAILABLE");
    const timeoutRow = await timed.verifications.getByRunId(second.runId);
    assert.equal(timeoutRow?.failureCategory, "OBSERVER_TIMEOUT");
  });

  it("retries missing state once then returns a deterministic NOT_VERIFIED", async () => {
    const ctx = await setup({
      actions: [action({ arguments: { marker: "alpha", commit: false } })],
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await drainDue(ctx.jobs);
    const queued = await getDb()
      .select()
      .from(jobTable)
      .where(eq(jobTable.status, "queued"));
    assert.equal(queued.length, 1);
    await releaseQueuedJobs();
    await drainDue(ctx.jobs);
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.verificationOutcome, "NOT_VERIFIED");
    assert.equal(ctx.probe.invocationCount(), 1);
    assert.equal(ctx.modelCalls(), 1);
  });

  it("makes duplicate verification delivery idempotent", async () => {
    const ctx = await setup();
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await drainDue(ctx.jobs);
    await ctx.jobs.enqueue(WORKFORCE_RUN_STEP_JOB, {
      runId: created.runId,
      step: "verify",
    });
    await drainDue(ctx.jobs);
    const verification = await ctx.verifications.getByRunId(created.runId);
    assert.equal(verification?.status, "verified");
    assert.equal(ctx.probe.invocationCount(), 1);
    assert.equal((await ctx.runs.get(created.runId))?.verificationOutcome, "VERIFIED");
  });

  it("does not let concurrent verify workers create contradictory results", async () => {
    const ctx = await setup();
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    await Promise.all([
      ctx.orchestrator.handleJob({ payload: { runId: created.runId, step: "verify" } }),
      ctx.orchestrator.handleJob({ payload: { runId: created.runId, step: "verify" } }),
    ]);
    const verification = await ctx.verifications.getByRunId(created.runId);
    assert.equal(verification?.status, "verified");
    assert.equal((await ctx.runs.get(created.runId))?.verificationOutcome, "VERIFIED");
    const rows = await getDb().select().from(verificationTable);
    assert.equal(rows.length, 1);
  });

  it("rejects cross-workspace, cross-Venture, and stale execution binding", async () => {
    const ctx = await setup();
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await ctx.jobs.processDue();
    const verification = await ctx.verifications.getByRunId(created.runId);
    assert.ok(verification);
    await getDb()
      .update(verificationTable)
      .set({ workspaceId: "ws-other" })
      .where(eq(verificationTable.id, verification.id));
    await drainDue(ctx.jobs);
    assert.equal((await ctx.runs.get(created.runId))?.failureCategory, "VERIFICATION_UNAVAILABLE");

    const ventureCtx = await setup();
    const ventureRun = await ventureCtx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(ventureRun.ok, true);
    if (!ventureRun.ok) {
      return;
    }
    await ventureCtx.jobs.processDue();
    const ventureVerification = await ventureCtx.verifications.getByRunId(ventureRun.runId);
    assert.ok(ventureVerification);
    await getDb()
      .update(verificationTable)
      .set({ ventureId: "venture-other" })
      .where(eq(verificationTable.id, ventureVerification.id));
    await drainDue(ventureCtx.jobs);
    assert.equal(
      (await ventureCtx.runs.get(ventureRun.runId))?.failureCategory,
      "VERIFICATION_UNAVAILABLE",
    );

    const execCtx = await setup();
    const execRun = await execCtx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(execRun.ok, true);
    if (!execRun.ok) {
      return;
    }
    await execCtx.jobs.processDue();
    const execVerification = await execCtx.verifications.getByRunId(execRun.runId);
    assert.ok(execVerification);
    await getDb()
      .update(verificationTable)
      .set({ executionId: "exec-stale" })
      .where(eq(verificationTable.id, execVerification.id));
    await drainDue(execCtx.jobs);
    assert.equal(
      (await execCtx.runs.get(execRun.runId))?.failureCategory,
      "VERIFICATION_UNAVAILABLE",
    );
  });

  it("does not duplicate a succeeded execution after crash, and completes from persisted verification", async () => {
    const url = await fileDatabase();
    const first = await setup({ databaseUrl: url });
    const created = await first.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await first.jobs.processDue();
    const mid = await first.runs.get(created.runId);
    assert.equal(mid?.phase, "verifying");
    assert.ok(mid?.executionId);
    await first.jobs.processDue();
    await first.runs.patch(created.runId, {
      phase: "verifying",
      completionKind: null,
      completedAt: null,
    });

    const second = await setup({ databaseUrl: url, hydrateOnly: true });
    await second.orchestrator.recover();
    await drainDue(second.jobs);
    const recovered = await second.runs.get(created.runId);
    assert.equal(recovered?.phase, "completed");
    assert.equal(recovered?.verificationOutcome, "VERIFIED");
    assert.equal(second.probe.invocationCount(), 0);
    const executions = await getDb().select().from(executionTable);
    assert.equal(executions.filter((row) => row.status === "succeeded").length, 1);
  });

  it("records system verification audit without evidence JSON", async () => {
    const ctx = await setup();
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId,
      workspaceId,
      ventureId,
      objective: "probe once",
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await drainDue(ctx.jobs);
    const events = await ctx.audit.list();
    const actions = events.map((event) => event.action);
    assert.equal(actions.includes("workforce.verification.started"), true);
    assert.equal(actions.includes("workforce.verification.verified"), true);
    for (const event of events.filter((item) => item.action.startsWith("workforce.verification."))) {
      assert.equal(event.actor?.kind, "system");
      if (event.actor && "component" in event.actor) {
        assert.equal(event.actor.component, "workforce.verification");
      }
      assert.equal(JSON.stringify(event.metadata ?? {}).includes("observedKeys"), false);
      assert.equal("evidence" in (event.metadata ?? {}), false);
    }
  });
});
