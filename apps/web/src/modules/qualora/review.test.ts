import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId, WorkforceRunId } from "@/contracts/ids";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { VentureLifecycle } from "@/core/venture-definition/lifecycle";
import type {
  AgentWorkforceActor,
  HumanWorkforceActor,
  SystemWorkforceActor,
} from "@/core/workforce/types";
import { createAuditLog } from "@/platform/audit/log";
import { createId } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import {
  qualoraEvidenceAssessments as assessmentTable,
  workforceRuns as runTable,
  workforceVerifications as verificationTable,
} from "@/platform/persistence/schema";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import { PRODUCTION_WORKFORCE_BINDINGS } from "@/modules/workforce/production-bindings";
import { QUALORA_EVIDENCE_ANALYST_DEFINITION } from "./definition";
import { fingerprintQualoraEvidenceAssessment } from "./fingerprint";
import { SYNTHETIC_REQUIREMENT_ID } from "./fixtures";
import {
  authoriseReviewer,
  reviewQualoraEvidenceAssessment,
} from "./review";
import { createQualoraEvidenceAssessmentReviewStore } from "./review-store";
import { createQualoraEvidenceAssessmentStore } from "./store";
import {
  QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED,
  QUALORA_ASSESSMENT_STATUS_PROPOSED,
  QUALORA_AUDIT_REVIEWED,
  QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
  QUALORA_REVIEW_PERMISSION,
  QUALORA_VENTURE_DEFINITION_ID,
} from "./types";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");
const userId = "user-reviewer" as UserId;
const memberId = "user-member" as UserId;
const workspaceId = "ws-qualora" as WorkspaceId;
const otherWorkspaceId = "ws-other" as WorkspaceId;
const ventureId = "venture-qualora" as VentureId;
const otherVentureId = "venture-other" as VentureId;
const calvioraVentureId = "venture-calviora" as VentureId;
const farmoraVentureId = "venture-farmora" as VentureId;
const instanceId = "instance-analyst" as AgentInstanceId;

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

function human(id = userId): HumanWorkforceActor {
  return { kind: "human", userId: id, workspaceId, ventureId };
}

function agent(): AgentWorkforceActor {
  return {
    kind: "agent",
    agentInstanceId: instanceId,
    workspaceId,
    ventureId,
  };
}

function system(): SystemWorkforceActor {
  return { kind: "system", component: "qualora-review", workspaceId };
}

function permissions() {
  return createPermissionService(createDbMembershipStore());
}

async function grant(role: "owner" | "admin" | "member", id = userId, workspace = workspaceId) {
  await getPersistence().memberships.setRole({
    userId: id,
    workspaceId: workspace,
    role,
    createdAt: "2026-08-26T00:00:00.000Z",
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
  if (!(await store.organisations.findById(input.workspaceId))) {
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

async function seedQualora(databaseUrl?: string) {
  await resetPersistenceLifecycle(databaseUrl ?? ":memory:");
  await seedVenture({
    workspaceId,
    ventureId,
    definitionId: QUALORA_VENTURE_DEFINITION_ID,
    definitionVersion: "0.4.0",
    name: "Qualora One",
    slug: "qualora-one",
  });
  await grant("owner");
}

async function insertAssessment(
  overrides: {
    workspaceId?: WorkspaceId;
    ventureId?: VentureId;
    summary?: string;
  } = {},
) {
  const assessments = createQualoraEvidenceAssessmentStore();
  const written = await assessments.insert({
    workspaceId: overrides.workspaceId ?? workspaceId,
    ventureId: overrides.ventureId ?? ventureId,
    requirementId: SYNTHETIC_REQUIREMENT_ID,
    sourceRunId: createId<WorkforceRunId>(),
    sourceAgentInstanceId: instanceId,
    executionIdempotencyKey: createId(),
    gapKind: "INSUFFICIENT_EVIDENCE",
    summary:
      overrides.summary ??
      "The supplied synthetic evidence does not include a completed checklist.",
    citedEvidenceIds: ["ev.synthetic.blank-log", "ev.synthetic.procedure-file"],
  });
  assert.equal(written.kind, "created");
  return written.record;
}

async function review(
  assessment: Awaited<ReturnType<typeof insertAssessment>>,
  input: Parameters<typeof reviewQualoraEvidenceAssessment>[0] extends infer T
    ? Partial<T> & { actor?: Parameters<typeof reviewQualoraEvidenceAssessment>[0]["actor"] }
    : never,
) {
  const audit = createAuditLog();
  const result = await reviewQualoraEvidenceAssessment(
    {
      actor: input.actor ?? human(),
      assessmentId: input.assessmentId ?? assessment.id,
      workspaceId: input.workspaceId ?? workspaceId,
      ventureId: input.ventureId ?? ventureId,
      fingerprint: input.fingerprint ?? fingerprintQualoraEvidenceAssessment(assessment),
      decision: input.decision ?? "CONFIRMED",
      rationale: input.rationale,
    },
    {
      canReview: (id, workspace) =>
        permissions().can({
          userId: id,
          permission: QUALORA_REVIEW_PERMISSION,
          resource: { type: "workspace", id: workspace },
        }),
      audit,
    },
  );
  return { result, audit };
}

describe("Qualora human review authorisation", () => {
  it("reuses venture.update and does not add a review permission", async () => {
    assert.equal(QUALORA_REVIEW_PERMISSION, "venture.update");
    const contracts = await readFile(join(webSrc, "contracts/permissions.ts"), "utf8");
    assert.doesNotMatch(contracts, /assurance\.review|qualora\.review/);
    assert.equal(authoriseReviewer(undefined).ok, false);
    assert.equal(authoriseReviewer(agent()).ok, false);
    assert.equal(authoriseReviewer(system()).ok, false);
    const deniedAgent = authoriseReviewer(agent());
    const deniedSystem = authoriseReviewer(system());
    if (!deniedAgent.ok) {
      assert.equal(deniedAgent.reason, "AGENT_CANNOT_REVIEW");
    }
    if (!deniedSystem.ok) {
      assert.equal(deniedSystem.reason, "SYSTEM_CANNOT_REVIEW");
    }
    assert.equal(authoriseReviewer(human()).ok, true);
  });
});

describe("Qualora human review of proposed assessments", () => {
  it("lets an authorised human CONFIRM the exact proposed assessment", async () => {
    await seedQualora();
    const assessment = await insertAssessment();
    const { result } = await review(assessment, { decision: "CONFIRMED" });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.review.decision, "CONFIRMED");
    assert.equal(result.review.reviewerUserId, userId);
    assert.equal(result.review.assessmentId, assessment.id);
    const stored = await createQualoraEvidenceAssessmentStore().getById(assessment.id);
    assert.equal(stored?.status, QUALORA_ASSESSMENT_STATUS_PROPOSED);
    assert.equal(stored?.provenance, QUALORA_ASSESSMENT_PROVENANCE_AI_GENERATED);
  });

  it("lets an authorised human DISMISS the exact proposed assessment without deleting it", async () => {
    await seedQualora();
    const assessment = await insertAssessment();
    const { result } = await review(assessment, { decision: "DISMISSED" });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.review.decision, "DISMISSED");
    const stored = await createQualoraEvidenceAssessmentStore().getById(assessment.id);
    assert.equal(stored?.id, assessment.id);
    assert.equal(stored?.summary, assessment.summary);
    assert.equal(stored?.status, QUALORA_ASSESSMENT_STATUS_PROPOSED);
    const rows = await getDb().select().from(assessmentTable);
    assert.equal(rows.length, 1);
  });

  it("denies unauthenticated, unauthorised, agent, and system reviewers", async () => {
    await seedQualora();
    await grant("member", memberId);
    const assessment = await insertAssessment();
    const fingerprint = fingerprintQualoraEvidenceAssessment(assessment);
    const unauthenticated = await reviewQualoraEvidenceAssessment({
      assessmentId: assessment.id,
      workspaceId,
      ventureId,
      fingerprint,
      decision: "CONFIRMED",
    });
    assert.equal(unauthenticated.ok, false);
    if (!unauthenticated.ok) {
      assert.equal(unauthenticated.failure, "UNAUTHENTICATED");
    }
    const { result: member } = await review(assessment, { actor: human(memberId) });
    assert.equal(member.ok, false);
    if (!member.ok) {
      assert.equal(member.failure, "UNAUTHORISED");
    }
    const { result: agentDenied } = await review(assessment, { actor: agent() });
    assert.equal(agentDenied.ok, false);
    if (!agentDenied.ok) {
      assert.equal(agentDenied.failure, "AGENT_CANNOT_REVIEW");
    }
    const { result: systemDenied } = await review(assessment, { actor: system() });
    assert.equal(systemDenied.ok, false);
    if (!systemDenied.ok) {
      assert.equal(systemDenied.failure, "SYSTEM_CANNOT_REVIEW");
    }
  });

  it("denies wrong workspace, wrong Venture, and another tenant assessment", async () => {
    await seedQualora();
    await seedVenture({
      workspaceId: otherWorkspaceId,
      ventureId: otherVentureId,
      definitionId: QUALORA_VENTURE_DEFINITION_ID,
      definitionVersion: "0.4.0",
      name: "Other Qualora",
      slug: "other-qualora",
    });
    await grant("owner", userId, otherWorkspaceId);
    const assessment = await insertAssessment();
    const foreign = await insertAssessment({
      workspaceId: otherWorkspaceId,
      ventureId: otherVentureId,
    });
    const { result: wrongWorkspace } = await review(assessment, {
      workspaceId: otherWorkspaceId,
    });
    assert.equal(wrongWorkspace.ok, false);
    if (!wrongWorkspace.ok) {
      assert.equal(wrongWorkspace.failure, "SCOPE_MISMATCH");
    }
    const { result: wrongVenture } = await review(assessment, {
      ventureId: otherVentureId,
    });
    assert.equal(wrongVenture.ok, false);
    if (!wrongVenture.ok) {
      assert.equal(wrongVenture.failure, "SCOPE_MISMATCH");
    }
    const { result: otherTenant } = await review(foreign, {
      workspaceId,
      ventureId,
    });
    assert.equal(otherTenant.ok, false);
    if (!otherTenant.ok) {
      assert.equal(otherTenant.failure, "SCOPE_MISMATCH");
    }
  });

  it("denies a stale fingerprint against the exact assessment binding", async () => {
    await seedQualora();
    const assessment = await insertAssessment();
    const { result } = await review(assessment, { fingerprint: "not-the-assessment" });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "STALE_ASSESSMENT");
    }
  });

  it("treats duplicate identical CONFIRM and DISMISS as idempotent", async () => {
    await seedQualora();
    const confirmed = await insertAssessment();
    const firstConfirm = await review(confirmed, { decision: "CONFIRMED" });
    const secondConfirm = await review(confirmed, { decision: "CONFIRMED" });
    assert.equal(firstConfirm.result.ok, true);
    assert.equal(secondConfirm.result.ok, true);
    if (firstConfirm.result.ok && secondConfirm.result.ok) {
      assert.equal(secondConfirm.result.reused, true);
      assert.equal(firstConfirm.result.review.id, secondConfirm.result.review.id);
    }

    const dismissed = await insertAssessment();
    const firstDismiss = await review(dismissed, { decision: "DISMISSED" });
    const secondDismiss = await review(dismissed, { decision: "DISMISSED" });
    assert.equal(firstDismiss.result.ok, true);
    assert.equal(secondDismiss.result.ok, true);
    if (firstDismiss.result.ok && secondDismiss.result.ok) {
      assert.equal(secondDismiss.result.reused, true);
      assert.equal(firstDismiss.result.review.id, secondDismiss.result.review.id);
    }
  });

  it("does not let a conflicting second decision silently overwrite the first", async () => {
    await seedQualora();
    const assessment = await insertAssessment();
    const first = await review(assessment, { decision: "CONFIRMED" });
    const second = await review(assessment, { decision: "DISMISSED" });
    assert.equal(first.result.ok, true);
    assert.equal(second.result.ok, false);
    if (!second.result.ok) {
      assert.equal(second.result.failure, "CONFLICT");
    }
    const stored = await createQualoraEvidenceAssessmentReviewStore().getByAssessmentId(
      assessment.id,
    );
    assert.equal(stored?.decision, "CONFIRMED");
  });

  it("survives persistence restart with the reviewer identity", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "vos-review-"));
    const path = join(tempDir, "ventureos.db").replaceAll("\\", "/");
    await seedQualora(`file:${path}`);
    const assessment = await insertAssessment();
    const first = await review(assessment, { decision: "CONFIRMED" });
    assert.equal(first.result.ok, true);
    if (!first.result.ok) {
      return;
    }
    await resetPersistenceLifecycle(`file:${path}`);
    const restored = await createQualoraEvidenceAssessmentReviewStore().getByAssessmentId(
      assessment.id,
    );
    assert.equal(restored?.decision, "CONFIRMED");
    assert.equal(restored?.reviewerUserId, userId);
    assert.equal(restored?.id, first.result.review.id);
    const original = await createQualoraEvidenceAssessmentStore().getById(assessment.id);
    assert.equal(original?.status, QUALORA_ASSESSMENT_STATUS_PROPOSED);
  });

  it("records a bounded human audit event without evidence excerpts", async () => {
    await seedQualora();
    const assessment = await insertAssessment({
      summary: "Synthetic pack does not include a completed checklist.",
    });
    const { result, audit } = await review(assessment, { decision: "CONFIRMED" });
    assert.equal(result.ok, true);
    const events = (await audit.list()).filter(
      (event) => event.action === QUALORA_AUDIT_REVIEWED,
    );
    assert.equal(events.length, 1);
    assert.equal(events[0]?.actor?.kind, "human");
    assert.equal(events[0]?.metadata?.assessmentId, assessment.id);
    assert.equal(events[0]?.metadata?.decision, "CONFIRMED");
    const payload = JSON.stringify(events[0]);
    assert.equal(payload.includes("completed checklist"), false);
    assert.equal(payload.includes("ev.synthetic"), false);
  });

  it("does not treat CONFIRMED as VERIFIED or as a compliance verdict", async () => {
    await seedQualora();
    const assessment = await insertAssessment();
    const { result } = await review(assessment, { decision: "CONFIRMED" });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.notEqual(result.review.decision, "VERIFIED");
    assert.notEqual(result.review.decision, "COMPLIANT");
    assert.notEqual(result.review.decision, "NON_COMPLIANT");
    const verifications = await getDb().select().from(verificationTable);
    const runs = await getDb().select().from(runTable);
    assert.equal(verifications.length, 0);
    assert.equal(runs.length, 0);
    const stored = await createQualoraEvidenceAssessmentStore().getById(assessment.id);
    assert.equal(stored?.status, QUALORA_ASSESSMENT_STATUS_PROPOSED);
    assert.equal(JSON.stringify(result.review).includes("COMPLIANT"), false);
  });

  it("initialises schema generation 9 without destroying proposed assessments", async () => {
    await seedQualora();
    const assessment = await insertAssessment();
    await ensureSchema();
    const rows = await getDb().select().from(assessmentTable);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, assessment.id);
    assert.equal(rows[0]?.status, QUALORA_ASSESSMENT_STATUS_PROPOSED);
  });
});

describe("Sprint 10 isolation and non-expansion", () => {
  it("does not let the Evidence Analyst invoke human review through Workforce execution", async () => {
    assert.deepEqual(QUALORA_EVIDENCE_ANALYST_DEFINITION.capabilityAllowList, [
      QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    ]);
    const argumentsSource = await readFile(join(here, "arguments.ts"), "utf8");
    assert.doesNotMatch(argumentsSource, /CONFIRMED|DISMISSED|review/);
    const executor = await readFile(join(here, "executor.ts"), "utf8");
    assert.doesNotMatch(executor, /reviewQualoraEvidenceAssessment|CONFIRMED|DISMISSED/);
    assert.equal(PRODUCTION_WORKFORCE_BINDINGS.length, 1);
    assert.equal(
      PRODUCTION_WORKFORCE_BINDINGS[0]?.capabilityId,
      QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    );
  });

  it("does not call ModelPort for human review", async () => {
    const reviewSource = await readFile(join(here, "review.ts"), "utf8");
    const actionSource = await readFile(join(here, "actions.ts"), "utf8");
    assert.doesNotMatch(reviewSource, /ModelPort|model\.invoke|createOpenAIModelPort/);
    assert.doesNotMatch(actionSource, /ModelPort|model\.invoke|createOpenAIModelPort/);
    assert.match(actionSource, /getSession/);
  });

  it("leaves Calviora and Farmora unaffected and refuses their Ventures", async () => {
    const calviora = platformVentureRegistry.resolve("calviora");
    const farmora = platformVentureRegistry.resolve("farmora");
    assert.equal(
      calviora.capabilityProfile.uses.includes(QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID),
      false,
    );
    assert.equal(
      farmora.capabilityProfile.uses.includes(QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID),
      false,
    );
    await seedQualora();
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
    const planted = await insertAssessment({ ventureId: calvioraVentureId });
    const { result: calvioraReview } = await review(planted, {
      ventureId: calvioraVentureId,
      fingerprint: fingerprintQualoraEvidenceAssessment(planted),
    });
    assert.equal(calvioraReview.ok, false);
    if (!calvioraReview.ok) {
      assert.equal(calvioraReview.failure, "VENTURE_NOT_QUALORA");
    }
    const farmoraPlanted = await insertAssessment({ ventureId: farmoraVentureId });
    const { result: farmoraReview } = await review(farmoraPlanted, {
      ventureId: farmoraVentureId,
      fingerprint: fingerprintQualoraEvidenceAssessment(farmoraPlanted),
    });
    assert.equal(farmoraReview.ok, false);
    if (!farmoraReview.ok) {
      assert.equal(farmoraReview.failure, "VENTURE_NOT_QUALORA");
    }
  });

  it("keeps Workforce Core free of Qualora review semantics", async () => {
    const files = [
      "core/workforce/bindings.ts",
      "core/workforce/run.ts",
      "core/workforce/execution.ts",
      "core/workforce/executors.ts",
      "core/workforce/verifiers.ts",
      "core/workforce/authority.ts",
      "core/workforce/approval.ts",
    ];
    for (const relative of files) {
      const source = await readFile(join(webSrc, relative), "utf8");
      assert.doesNotMatch(source, /reviewQualoraEvidenceAssessment/);
      assert.doesNotMatch(source, /CONFIRMED|DISMISSED/);
      assert.doesNotMatch(source, /modules\/qualora/);
    }
    const storeSource = await readFile(join(here, "store.ts"), "utf8");
    assert.doesNotMatch(storeSource, /\.update\(|\.set\(/);
  });
});
