import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import { platformCapabilityRegistry } from "@/core/capability/catalog";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import { composeWorkforceBindings } from "@/core/workforce/bindings";
import { createWorkforceExecutionGate } from "@/core/workforce/execution";
import { createFakeModelPort } from "@/core/workforce/model";
import {
  createWorkforceRunOrchestrator,
  WORKFORCE_RUN_MAX_MODEL_CALLS,
  WORKFORCE_RUN_STEP_JOB,
} from "@/core/workforce/run";
import type {
  AgentWorkforceActor,
  ExecutorInvocation,
  HumanWorkforceActor,
  ModelRequest,
  ProposedAction,
} from "@/core/workforce/types";
import type { VentureLifecycle } from "@/core/venture-definition/lifecycle";
import { createAuditLog } from "@/platform/audit/log";
import { createId } from "@/platform/ids";
import { createJobOrchestrator } from "@/platform/jobs/orchestrator";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import { qualoraEvidenceAssessments as assessmentTable } from "@/platform/persistence/schema";
import { createWorkforceApprovalSatisfactionPort } from "@/platform/workforce/approval-store";
import { createWorkforceApprovalStore } from "@/platform/workforce/approval-store";
import { createWorkforceDefinitionRepository } from "@/platform/workforce/definition-repository";
import { createWorkforceExecutionStore } from "@/platform/workforce/execution-store";
import { inspectWorkforceRun } from "@/platform/workforce/inspect";
import { createWorkforceInstanceRepository } from "@/platform/workforce/instance-repository";
import { createWorkforceJobPort } from "@/platform/workforce/job-port";
import { createWorkforceRunStepHandler } from "@/platform/workforce/run-handler";
import { createWorkforceRunStore } from "@/platform/workforce/run-store";
import { createVentureScopePort } from "@/platform/workforce/venture-scope";
import { createWorkforceVerificationStore } from "@/platform/workforce/verification-store";
import { PRODUCTION_WORKFORCE_BINDINGS } from "@/modules/workforce/production-bindings";
import { activateQualoraEvidenceAnalyst } from "./activation";
import { QUALORA_EVIDENCE_ANALYST_DEFINITION } from "./definition";
import { createQualoraEvidenceAssessmentExecutor } from "./executor";
import {
  QUALORA_EVIDENCE_ANALYST_OBJECTIVE,
  SYNTHETIC_GAP_EVIDENCE,
  SYNTHETIC_REQUIREMENT_ID,
} from "./fixtures";
import { QUALORA_EVIDENCE_ASSESSMENT_BINDING } from "./binding";
import { qualoraEvidencePack } from "./request";
import { createQualoraEvidenceAssessmentStore } from "./store";
import {
  QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED,
  QUALORA_ASSESSMENT_STATUS_PROPOSED,
  QUALORA_AUDIT_RECORDED,
  QUALORA_EVIDENCE_ANALYST_DEFINITION_ID,
  QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID,
  QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
  QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION,
  QUALORA_PREDICATE_ID,
} from "./types";
import { createQualoraEvidenceAssessmentVerifier } from "./verifier";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");
const userId = "user-1" as UserId;
const workspaceId = "ws-qualora" as WorkspaceId;
const otherWorkspaceId = "ws-other" as WorkspaceId;
const ventureId = "venture-qualora" as VentureId;
const calvioraVentureId = "venture-calviora" as VentureId;
const farmoraVentureId = "venture-farmora" as VentureId;
const companyVentureId = "venture-company" as VentureId;
const unknownVentureId = "venture-retail" as VentureId;

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
});

function human(workspace = workspaceId, venture = ventureId): HumanWorkforceActor {
  return { kind: "human", userId, workspaceId: workspace, ventureId: venture };
}

function agent(instanceId: AgentInstanceId): AgentWorkforceActor {
  return {
    kind: "agent",
    agentInstanceId: instanceId,
    workspaceId,
    ventureId,
  };
}

function gapAction(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    capabilityId: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    intent: "record proposed evidence gap",
    arguments: {
      requirementId: SYNTHETIC_REQUIREMENT_ID,
      gapKind: "INSUFFICIENT_EVIDENCE",
      summary:
        "The supplied synthetic evidence does not include a completed checklist for the requirement.",
      citedEvidenceIds: "ev.synthetic.blank-log,ev.synthetic.procedure-file",
    },
    rationale: "Cited synthetic evidence does not support the requirement.",
    evidenceIds: ["ev.synthetic.procedure-file", "ev.synthetic.blank-log"],
    ...overrides,
  };
}

function mistakenGapOnSufficientPack(): ProposedAction {
  return gapAction({
    arguments: {
      requirementId: SYNTHETIC_REQUIREMENT_ID,
      gapKind: "INSUFFICIENT_EVIDENCE",
      summary: "The model proposed a gap against the supplied synthetic pack.",
      citedEvidenceIds: "ev.synthetic.completed-checklist",
    },
    evidenceIds: ["ev.synthetic.completed-checklist"],
  });
}

async function seedVenture(input: {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  definitionId: string;
  definitionVersion: string;
  name: string;
  slug: string;
  lifecycle?: VentureLifecycle;
}) {
  await ensureSchema();
  const store = getPersistence();
  const existingWorkspace = await store.organisations.findById(input.workspaceId);
  if (!existingWorkspace) {
    await store.organisations.insert({
      id: input.workspaceId,
      name: input.name,
      slug: input.slug,
      createdAt: "2026-08-26T00:00:00.000Z",
    });
  }
  await store.ventures.insert({
    id: input.ventureId,
    workspaceId: input.workspaceId,
    name: input.name,
    slug: input.slug,
    stage: "Seed",
    href: `/ventures/hq/${input.slug}`,
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
    definitionId: input.definitionId,
    definitionVersion: input.definitionVersion,
    lifecycle: input.lifecycle ?? "operating",
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
  });
}

async function seedQualora() {
  await resetPersistenceLifecycle(":memory:");
  await seedVenture({
    workspaceId,
    ventureId,
    definitionId: "qualora",
    definitionVersion: "0.4.0",
    name: "Qualora One",
    slug: "qualora-one",
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

async function setupQualoraRun(options: {
  actions?: ProposedAction[];
  pack?: "gap" | "sufficient";
  capture?: { requests: ModelRequest[] };
} = {}) {
  await seedQualora();
  const activated = await activateQualoraEvidenceAnalyst({ workspaceId, ventureId });
  assert.equal(activated.ok, true);
  if (!activated.ok) {
    throw new Error("activation failed");
  }

  const definitions = createWorkforceDefinitionRepository();
  const instances = createWorkforceInstanceRepository();
  const composed = composeWorkforceBindings(
    PRODUCTION_WORKFORCE_BINDINGS,
    platformCapabilityRegistry,
  );
  const runs = createWorkforceRunStore();
  const approvals = createWorkforceApprovalStore();
  const verifications = createWorkforceVerificationStore();
  const jobs = createJobOrchestrator();
  const audit = createAuditLog();
  let modelCalls = 0;
  const pack = qualoraEvidencePack(options.pack ?? "gap");
  const payload = {
    summary: "assessed",
    explanation: "bounded",
    findings: [],
    uncertainties: [],
    proposedActions: options.actions ?? (options.pack === "sufficient" ? [] : [gapAction()]),
  };
  const model = createFakeModelPort((request: ModelRequest) => {
    modelCalls += 1;
    options.capture?.requests.push(request);
    return payload;
  });
  const execution = createWorkforceExecutionGate({
    definitions,
    instances,
    capabilities: platformCapabilityRegistry,
    scope: createVentureScopePort(),
    executors: composed.executors,
    implementations: composed.implementations,
    store: createWorkforceExecutionStore(),
    approvals: createWorkforceApprovalSatisfactionPort(approvals),
  });
  const orchestrator = createWorkforceRunOrchestrator({
    definitions,
    instances,
    capabilities: platformCapabilityRegistry,
    scope: createVentureScopePort(),
    model,
    executors: composed.executors,
    verifiers: composed.verifiers,
    implementations: composed.implementations,
    execution,
    runs,
    approvals,
    verifications,
    jobs: createWorkforceJobPort(jobs),
    canApprove: async () => true,
    audit,
  });
  jobs.register(WORKFORCE_RUN_STEP_JOB, createWorkforceRunStepHandler(orchestrator));
  return {
    orchestrator,
    jobs,
    runs,
    verifications,
    audit,
    instanceId: activated.instanceId,
    pack,
    modelCalls: () => modelCalls,
    assessments: createQualoraEvidenceAssessmentStore(),
  };
}

function invocation(
  overrides: Partial<ExecutorInvocation> & { agentInstanceId: AgentInstanceId },
): ExecutorInvocation {
  return {
    executionId: "exec-1",
    actor: agent(overrides.agentInstanceId),
    workspaceId,
    ventureId,
    capabilityId: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    arguments: gapAction().arguments,
    externalIdempotencyKey: "core-key-1",
    sourceRequestId: "run-1",
    ...overrides,
  };
}

describe("Qualora Evidence Analyst definition", () => {
  it("names the approved role, capability, and execute-only gap creation", () => {
    assert.equal(QUALORA_EVIDENCE_ANALYST_DEFINITION.role, "Qualora Evidence Analyst");
    assert.deepEqual(QUALORA_EVIDENCE_ANALYST_DEFINITION.capabilityAllowList, [
      QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    ]);
    assert.equal(QUALORA_EVIDENCE_ANALYST_DEFINITION.autonomyCeiling, "execute");
    assert.equal(QUALORA_EVIDENCE_ANALYST_DEFINITION.approvalBoundary, "");
    assert.match(
      QUALORA_EVIDENCE_ANALYST_DEFINITION.responsibilities.join(" "),
      /does not determine regulatory truth/i,
    );
    assert.doesNotMatch(
      QUALORA_EVIDENCE_ANALYST_DEFINITION.responsibilities.join(" "),
      /CQC approved|COMPLIANT|VERIFIED COMPLIANCE/i,
    );
  });

  it("keeps Qualora uses of the capability and leaves Calviora and Farmora unchanged", () => {
    const qualora = platformVentureRegistry.resolve("qualora");
    const calviora = platformVentureRegistry.resolve("calviora");
    const farmora = platformVentureRegistry.resolve("farmora");
    assert.equal(qualora.version, "0.4.0");
    assert.equal(
      qualora.capabilityProfile.uses.includes(QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID),
      true,
    );
    assert.equal(
      calviora.capabilityProfile.uses.includes(QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID),
      false,
    );
    assert.equal(
      farmora.capabilityProfile.uses.includes(QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID),
      false,
    );
    assert.equal(QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID.startsWith("qualora."), false);
  });
});

describe("Qualora Evidence Analyst activation", () => {
  it("requires an explicit Qualora Venture and does not auto-create on launch", async () => {
    await seedQualora();
    const first = await activateQualoraEvidenceAnalyst({ workspaceId, ventureId });
    const second = await activateQualoraEvidenceAnalyst({ workspaceId, ventureId });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.instanceId, second.instanceId);
    assert.equal(second.reused, true);

    const products = await readFile(join(webSrc, "modules/ventures/launch/products.ts"), "utf8");
    assert.doesNotMatch(products, /activateQualoraEvidenceAnalyst|Evidence Analyst/);
  });

  it("refuses Calviora, Farmora, company, and unknown Ventures", async () => {
    await resetPersistenceLifecycle(":memory:");
    await seedVenture({
      workspaceId,
      ventureId: calvioraVentureId,
      definitionId: "calviora",
      definitionVersion: "0.1.0",
      name: "Calviora Herd",
      slug: "calviora-herd",
    });
    await seedVenture({
      workspaceId,
      ventureId: farmoraVentureId,
      definitionId: "farmora",
      definitionVersion: "0.1.0",
      name: "Farmora Fields",
      slug: "farmora-fields",
    });
    await seedVenture({
      workspaceId,
      ventureId: companyVentureId,
      definitionId: "ventureos.company",
      definitionVersion: "1.0.0",
      name: "Company",
      slug: "company",
    });
    await seedVenture({
      workspaceId,
      ventureId: unknownVentureId,
      definitionId: "retail.future",
      definitionVersion: "0.1.0",
      name: "Retail",
      slug: "retail",
    });

    assert.equal(
      (await activateQualoraEvidenceAnalyst({ workspaceId, ventureId: calvioraVentureId }))
        .ok,
      false,
    );
    assert.equal(
      (await activateQualoraEvidenceAnalyst({ workspaceId, ventureId: farmoraVentureId }))
        .ok,
      false,
    );
    assert.equal(
      (await activateQualoraEvidenceAnalyst({ workspaceId, ventureId: companyVentureId }))
        .ok,
      false,
    );
    assert.equal(
      (await activateQualoraEvidenceAnalyst({ workspaceId, ventureId: unknownVentureId }))
        .ok,
      false,
    );
  });
});

describe("Qualora evidence-assessment executor", () => {
  it("rejects unsupported arguments including SUPPORTED and extra keys", () => {
    const executor = createQualoraEvidenceAssessmentExecutor();
    assert.equal(executor.parseArguments({ gapKind: "SUPPORTED" }).ok, false);
    assert.equal(executor.parseArguments({ gapKind: "COMPLIANT" }).ok, false);
    assert.equal(
      executor.parseArguments({
        requirementId: SYNTHETIC_REQUIREMENT_ID,
        gapKind: "INSUFFICIENT_EVIDENCE",
        summary: "ok",
        citedEvidenceIds: "ev.1",
        workspaceId: "ws-injected",
      }).ok,
      false,
    );
  });

  it("creates one proposed assessment and reuses duplicate delivery", async () => {
    await seedQualora();
    const activated = await activateQualoraEvidenceAnalyst({ workspaceId, ventureId });
    assert.equal(activated.ok, true);
    if (!activated.ok) {
      return;
    }
    const runs = createWorkforceRunStore();
    const runId = createId<WorkforceRunId>();
    const pack = qualoraEvidencePack("gap");
    await runs.insert({
      id: runId,
      workspaceId,
      ventureId,
      agentInstanceId: activated.instanceId,
      definitionId: QUALORA_EVIDENCE_ANALYST_DEFINITION_ID as never,
      definitionVersion: "1",
      objective: QUALORA_EVIDENCE_ANALYST_OBJECTIVE,
      phase: "queued",
      sourceRequestId: runId,
      modelCallCount: 0,
      requestedByUserId: userId,
      evidence: pack.evidence,
      citations: pack.citations,
    });
    const store = createQualoraEvidenceAssessmentStore();
    const executor = createQualoraEvidenceAssessmentExecutor({ store });
    const request = invocation({
      agentInstanceId: activated.instanceId,
      sourceRequestId: runId,
    });
    const first = await executor.execute(request);
    const second = await executor.execute(request);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    const rows = await store.listByVenture({ workspaceId, ventureId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, QUALORA_ASSESSMENT_STATUS_PROPOSED);
    assert.equal(rows[0]?.provenance, QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED);
    assert.equal(first.receipt?.externalReference, rows[0]?.id);
  });

  it("refuses non-Qualora Ventures, foreign workspaces, and unknown evidence ids", async () => {
    await seedQualora();
    const activated = await activateQualoraEvidenceAnalyst({ workspaceId, ventureId });
    assert.equal(activated.ok, true);
    if (!activated.ok) {
      return;
    }
    const runs = createWorkforceRunStore();
    const runId = createId<WorkforceRunId>();
    const pack = qualoraEvidencePack("gap");
    await runs.insert({
      id: runId,
      workspaceId,
      ventureId,
      agentInstanceId: activated.instanceId,
      definitionId: QUALORA_EVIDENCE_ANALYST_DEFINITION_ID as never,
      definitionVersion: "1",
      objective: QUALORA_EVIDENCE_ANALYST_OBJECTIVE,
      phase: "queued",
      sourceRequestId: runId,
      modelCallCount: 0,
      requestedByUserId: userId,
      evidence: pack.evidence,
      citations: pack.citations,
    });
    const store = createQualoraEvidenceAssessmentStore();

    const calviora = createQualoraEvidenceAssessmentExecutor({
      store,
      loadVentureDefinitionId: async () => "calviora",
    });
    assert.equal(
      (
        await calviora.execute(
          invocation({ agentInstanceId: activated.instanceId, sourceRequestId: runId }),
        )
      ).ok,
      false,
    );

    const farmora = createQualoraEvidenceAssessmentExecutor({
      store,
      loadVentureDefinitionId: async () => "farmora",
    });
    assert.equal(
      (
        await farmora.execute(
          invocation({ agentInstanceId: activated.instanceId, sourceRequestId: runId }),
        )
      ).ok,
      false,
    );

    const unknown = createQualoraEvidenceAssessmentExecutor({
      store,
      loadVentureDefinitionId: async () => "retail.future",
    });
    assert.equal(
      (
        await unknown.execute(
          invocation({ agentInstanceId: activated.instanceId, sourceRequestId: runId }),
        )
      ).ok,
      false,
    );

    const scoped = createQualoraEvidenceAssessmentExecutor({ store });
    assert.equal(
      (
        await scoped.execute(
          invocation({
            agentInstanceId: activated.instanceId,
            sourceRequestId: runId,
            workspaceId: otherWorkspaceId,
          }),
        )
      ).ok,
      false,
    );
    assert.equal(
      (
        await scoped.execute(
          invocation({
            agentInstanceId: activated.instanceId,
            sourceRequestId: runId,
            arguments: {
              ...gapAction().arguments,
              citedEvidenceIds: "ev.invented",
            },
          }),
        )
      ).ok,
      false,
    );
    assert.equal((await store.listByVenture({ workspaceId, ventureId })).length, 0);
    assert.equal(
      (await store.listByVenture({ workspaceId: otherWorkspaceId, ventureId })).length,
      0,
    );
  });
});

describe("Qualora evidence-assessment verifier", () => {
  it("verifies independently observed proposed state and not executor receipts", async () => {
    await seedQualora();
    const store = createQualoraEvidenceAssessmentStore();
    const verifier = createQualoraEvidenceAssessmentVerifier({ store });
    const bound = verifier.bindPredicate({
      requirementId: SYNTHETIC_REQUIREMENT_ID,
      gapKind: "INSUFFICIENT_EVIDENCE",
      citedEvidenceIds: "ev.synthetic.blank-log,ev.synthetic.procedure-file",
    });
    assert.equal(bound.ok, true);
    if (!bound.ok) {
      return;
    }
    assert.equal(bound.predicate.id, QUALORA_PREDICATE_ID);
    const missing = await verifier.observe({
      runId: "run-1",
      executionId: "exec-1",
      workspaceId,
      ventureId,
      agentInstanceId: "instance-1",
      capabilityId: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
      predicateFingerprint: bound.predicate.fingerprint,
      sourceRequestId: "run-1",
      sourceActionIndex: 0,
    });
    assert.equal(missing.status, "missing");
    assert.equal(verifier.apply(bound.predicate, missing).outcome, "NOT_VERIFIED");
    assert.equal(
      verifier.apply(bound.predicate, {
        status: "observed",
        observedAt: "2026-08-26T00:00:00.000Z",
        values: {
          requirementId: SYNTHETIC_REQUIREMENT_ID,
          gapKind: "INSUFFICIENT_EVIDENCE",
          citedEvidenceIds: "ev.synthetic.blank-log,ev.synthetic.procedure-file",
          receipt: "not-proof",
        },
      }).outcome,
      "VERIFIED",
    );
    const source = await readFile(join(here, "verifier.ts"), "utf8");
    assert.match(source, /does not mean the AI/);
    assert.match(source, /independently/);
  });
});

describe("Qualora Evidence Analyst end-to-end", () => {
  it("proposes one durable unconfirmed gap assessment and independently verifies state", async () => {
    const capture: { requests: ModelRequest[] } = { requests: [] };
    const ctx = await setupQualoraRun({ capture });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId: ctx.instanceId,
      workspaceId,
      ventureId,
      objective: QUALORA_EVIDENCE_ANALYST_OBJECTIVE,
      evidence: ctx.pack.evidence,
      citations: ctx.pack.citations,
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await drainDue(ctx.jobs);
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.completionKind, "executed");
    assert.equal(run?.verificationOutcome, "VERIFIED");
    assert.equal(run?.modelCallCount, 1);
    assert.equal(ctx.modelCalls(), 1);
    assert.equal(WORKFORCE_RUN_MAX_MODEL_CALLS, 1);
    assert.equal(capture.requests[0]?.evidence.length, SYNTHETIC_GAP_EVIDENCE.length);
    assert.equal(
      capture.requests[0]?.context.citations.some(
        (item) => item.sourceId === SYNTHETIC_REQUIREMENT_ID,
      ),
      true,
    );

    const rows = await ctx.assessments.listByVenture({ workspaceId, ventureId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, QUALORA_ASSESSMENT_STATUS_PROPOSED);
    assert.equal(rows[0]?.provenance, QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED);
    assert.doesNotMatch(JSON.stringify(rows[0]), /SUPPORTED|COMPLIANT|CQC APPROVED/);

    const inspection = await inspectWorkforceRun(created.runId);
    assert.equal(inspection?.execution?.implementationId, QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID);
    assert.equal(
      inspection?.execution?.implementationVersion,
      QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION,
    );
    assert.equal(inspection?.execution?.externalReference, rows[0]?.id);
    assert.equal(inspection?.run.verificationOutcome, "VERIFIED");
    const serialized = JSON.stringify(inspection);
    assert.equal(serialized.includes(SYNTHETIC_GAP_EVIDENCE[0]!.excerpt), false);
    assert.equal(serialized.includes(rows[0]!.summary), false);

    const events = await ctx.audit.list();
    const recorded = events.filter((event) => event.action === QUALORA_AUDIT_RECORDED);
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0]?.metadata?.assessmentId, rows[0]?.id);
    assert.equal(JSON.stringify(recorded[0]?.metadata ?? {}).includes("completed checklist"), false);

    assert.equal(run?.verificationOutcome === "VERIFIED", true);
    assert.notEqual(run?.verificationOutcome, "judgement-correct");
  });

  it("NO_ACTION_SEMANTICS: completing without a proposed action does not persist compliance", async () => {
    const ctx = await setupQualoraRun({ pack: "sufficient", actions: [] });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId: ctx.instanceId,
      workspaceId,
      ventureId,
      objective: QUALORA_EVIDENCE_ANALYST_OBJECTIVE,
      evidence: ctx.pack.evidence,
      citations: ctx.pack.citations,
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await drainDue(ctx.jobs);
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.phase, "completed");
    assert.equal(run?.completionKind, "no_action");
    assert.equal(run?.verificationOutcome, null);
    assert.equal((await ctx.assessments.listByVenture({ workspaceId, ventureId })).length, 0);
    const raw = await getDb().select().from(assessmentTable);
    assert.equal(raw.length, 0);
    assert.notEqual(run?.completionKind, "compliant");
    assert.equal(JSON.stringify(run).includes("COMPLIANT"), false);
    assert.equal(JSON.stringify(run).includes("SATISFIED"), false);
    assert.equal(JSON.stringify(run).includes("VERIFIED_COMPLIANCE"), false);
  });

  it("VERIFIED_SEMANTICS: verification observes execution state, not regulatory judgement", async () => {
    const ctx = await setupQualoraRun({
      pack: "sufficient",
      actions: [mistakenGapOnSufficientPack()],
    });
    const created = await ctx.orchestrator.createRun({
      actor: human(),
      agentInstanceId: ctx.instanceId,
      workspaceId,
      ventureId,
      objective: QUALORA_EVIDENCE_ANALYST_OBJECTIVE,
      evidence: ctx.pack.evidence,
      citations: ctx.pack.citations,
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    await drainDue(ctx.jobs);
    const run = await ctx.runs.get(created.runId);
    assert.equal(run?.verificationOutcome, "VERIFIED");
    const rows = await ctx.assessments.listByVenture({ workspaceId, ventureId });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, QUALORA_ASSESSMENT_STATUS_PROPOSED);
    assert.notEqual(run?.verificationOutcome, "CQC_AGREED");
    assert.equal(rows[0]?.provenance, QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED);
  });
});

describe("Sprint 9 production boundary and isolation", () => {
  it("registers exactly the Qualora production binding and keeps Core Venture-agnostic", async () => {
    assert.equal(PRODUCTION_WORKFORCE_BINDINGS.length, 1);
    assert.equal(
      PRODUCTION_WORKFORCE_BINDINGS[0]?.bindingId,
      QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID,
    );
    assert.equal(
      PRODUCTION_WORKFORCE_BINDINGS[0]?.capabilityId,
      QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    );
    assert.equal(
      QUALORA_EVIDENCE_ASSESSMENT_BINDING.executor.id,
      QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    );
    assert.equal(
      QUALORA_EVIDENCE_ASSESSMENT_BINDING.verifier.id,
      QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    );

    const coreFiles = [
      "core/workforce/bindings.ts",
      "core/workforce/run.ts",
      "core/workforce/execution.ts",
      "core/workforce/executors.ts",
      "core/workforce/verifiers.ts",
      "core/workforce/authority.ts",
      "platform/workforce/inspect.ts",
      "platform/ai/openai-adapter.ts",
    ];
    for (const relative of coreFiles) {
      const source = await readFile(join(webSrc, relative), "utf8");
      assert.doesNotMatch(source, /modules\/qualora/);
      assert.doesNotMatch(source, /Qualora Evidence Analyst/);
    }

    const service = await readFile(join(webSrc, "modules/workforce/service.ts"), "utf8");
    assert.doesNotMatch(service, /Qualora|Calviora|Farmora/);
    assert.match(service, /PRODUCTION_WORKFORCE_BINDINGS/);

    const production = await readFile(
      join(webSrc, "modules/workforce/production-bindings.ts"),
      "utf8",
    );
    assert.match(production, /QUALORA_EVIDENCE_ASSESSMENT_BINDING/);
    assert.doesNotMatch(production, /execution-probe/);
    assert.doesNotMatch(production, /Calviora|Farmora/);
  });

  it("still allows a future Venture binding to compose without Core Qualora branching", () => {
    const composed = composeWorkforceBindings(
      PRODUCTION_WORKFORCE_BINDINGS,
      platformCapabilityRegistry,
    );
    assert.equal(
      composed.executors.get(QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID)?.id,
      QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    );
    assert.equal(composed.executors.get("retail.inventory-count"), undefined);
    assert.equal(composed.implementations.get("workforce.execution-probe"), undefined);
  });
});
