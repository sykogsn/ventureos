import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { JobId, WorkforceRunId } from "@/contracts/ids";
import { WORKFORCE_APPROVAL_PERMISSION } from "@/core/workforce/approval";
import type { SessionUser } from "@/lib/auth/session-token";
import { createId } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "@/platform/persistence/repositories/sqlite";
import { workforceRuns as runTable } from "@/platform/persistence/schema";
import type { WorkforceRunInspection } from "@/platform/workforce/inspect";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import { PRODUCTION_WORKFORCE_BINDINGS } from "@/modules/workforce/production-bindings";
import {
  createWorkforceRunFromSession,
  inspectWorkforceRunFromSession,
  type WorkforceSessionEntryDeps,
} from "./session-entry";

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, "../..");
const userId = "user-operator" as UserId;
const memberId = "user-member" as UserId;
const workspaceId = "ws-home" as WorkspaceId;
const otherWorkspaceId = "ws-other" as WorkspaceId;
const ventureId = "venture-home" as VentureId;
const otherVentureId = "venture-other" as VentureId;

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
});

function session(id = userId): SessionUser {
  return { id, email: `${id}@ventureos.test`, name: "Operator" };
}

function permissions() {
  return createPermissionService(createDbMembershipStore());
}

async function grant(
  role: "owner" | "admin" | "member",
  id = userId,
  workspace = workspaceId,
) {
  await getPersistence().memberships.setRole({
    userId: id,
    workspaceId: workspace,
    role,
    createdAt: "2026-08-26T00:00:00.000Z",
  });
}

async function seedWorkspace(id: WorkspaceId, slug: string, name: string) {
  await ensureSchema();
  const store = getPersistence();
  if (!(await store.organisations.findById(id))) {
    await store.organisations.insert({
      id,
      name,
      slug,
      createdAt: "2026-08-26T00:00:00.000Z",
    });
  }
}

async function seedVenture(input: {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  name: string;
  slug: string;
}) {
  await seedWorkspace(input.workspaceId, input.slug, input.name);
  await getPersistence().ventures.insert({
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
    definitionId: "ventureos",
    definitionVersion: "0.4.0",
    lifecycle: "operating",
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
  });
}

async function seedHome() {
  await resetPersistenceLifecycle(":memory:");
  await seedVenture({
    workspaceId,
    ventureId,
    name: "Home Venture",
    slug: "home-venture",
  });
  await grant("owner");
}

function sessionDeps(
  input: Pick<WorkforceSessionEntryDeps, "createRun" | "inspect"> = {},
): WorkforceSessionEntryDeps {
  return {
    canOperate: (id, workspace) =>
      permissions().can({
        userId: id,
        permission: WORKFORCE_APPROVAL_PERMISSION,
        resource: { type: "workspace", id: workspace },
      }),
    createRun: input.createRun,
    inspect: input.inspect,
  };
}

describe("Workforce session run entry", () => {
  it("reuses venture.update and does not add a Workforce permission", async () => {
    assert.equal(WORKFORCE_APPROVAL_PERMISSION, "venture.update");
    const contracts = await readFile(join(webSrc, "contracts/permissions.ts"), "utf8");
    assert.doesNotMatch(contracts, /workforce\.create|workforce\.inspect|workforce\.run/);
  });

  it("lets an authorised human create a run in the session workspace and Venture", async () => {
    await seedHome();
    let called = 0;
    const runId = createId<WorkforceRunId>();
    const jobId = createId<JobId>();
    const result = await createWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId,
        agentInstanceId: "instance-1",
        objective: "Assess the supplied evidence pack.",
      },
      sessionDeps({
        createRun: async (input) => {
          called += 1;
          assert.equal(input.actor.kind, "human");
          assert.equal(input.actor.userId, userId);
          assert.equal(input.workspaceId, workspaceId);
          assert.equal(input.ventureId, ventureId);
          return { ok: true, runId, jobId };
        },
      }),
    );
    assert.equal(result.ok, true);
    assert.equal(called, 1);
    if (result.ok) {
      assert.equal(result.runId, runId);
    }
  });

  it("denies unauthenticated, missing workspace, and unauthorised members", async () => {
    await seedHome();
    await grant("member", memberId);
    let called = 0;
    const deps = sessionDeps({
      createRun: async () => {
        called += 1;
        return { ok: true, runId: createId<WorkforceRunId>(), jobId: createId<JobId>() };
      },
    });
    const unauthenticated = await createWorkforceRunFromSession(
      {
        session: null,
        activeWorkspaceId: workspaceId,
        ventureId,
        agentInstanceId: "instance-1",
        objective: "Assess.",
      },
      deps,
    );
    assert.equal(unauthenticated.ok, false);
    if (!unauthenticated.ok) {
      assert.equal(unauthenticated.failure, "UNAUTHENTICATED");
    }

    const missingWorkspace = await createWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: null,
        ventureId,
        agentInstanceId: "instance-1",
        objective: "Assess.",
      },
      deps,
    );
    assert.equal(missingWorkspace.ok, false);
    if (!missingWorkspace.ok) {
      assert.equal(missingWorkspace.failure, "WORKSPACE_REQUIRED");
    }

    const member = await createWorkforceRunFromSession(
      {
        session: session(memberId),
        activeWorkspaceId: workspaceId,
        ventureId,
        agentInstanceId: "instance-1",
        objective: "Assess.",
      },
      deps,
    );
    assert.equal(member.ok, false);
    if (!member.ok) {
      assert.equal(member.failure, "UNAUTHORISED");
    }
    assert.equal(called, 0);
  });

  it("does not trust a caller-claimed workspace that disagrees with the session", async () => {
    await seedHome();
    await seedVenture({
      workspaceId: otherWorkspaceId,
      ventureId: otherVentureId,
      name: "Other Venture",
      slug: "other-venture",
    });
    await grant("owner", userId, otherWorkspaceId);
    let called = 0;
    const result = await createWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        claimedWorkspaceId: otherWorkspaceId,
        ventureId,
        agentInstanceId: "instance-1",
        objective: "Assess.",
      },
      sessionDeps({
        createRun: async () => {
          called += 1;
          return { ok: true, runId: createId<WorkforceRunId>(), jobId: createId<JobId>() };
        },
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "SCOPE_MISMATCH");
    }
    assert.equal(called, 0);
  });

  it("denies createRun against a Venture outside the session workspace", async () => {
    await seedHome();
    await seedVenture({
      workspaceId: otherWorkspaceId,
      ventureId: otherVentureId,
      name: "Other Venture",
      slug: "other-venture",
    });
    let called = 0;
    const result = await createWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId: otherVentureId,
        agentInstanceId: "instance-1",
        objective: "Assess.",
      },
      sessionDeps({
        createRun: async () => {
          called += 1;
          return { ok: true, runId: createId<WorkforceRunId>(), jobId: createId<JobId>() };
        },
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "SCOPE_MISMATCH");
    }
    assert.equal(called, 0);
  });
});

describe("Workforce session inspect boundary", () => {
  function inspection(overrides: Partial<WorkforceRunInspection["run"]> = {}): WorkforceRunInspection {
    return {
      run: {
        id: "run-1",
        phase: "completed",
        completionKind: "executed",
        failureCategory: null,
        verificationOutcome: "VERIFIED",
        definitionVersion: "1",
        workspaceId,
        ventureId,
        agentInstanceId: "instance-1",
        capabilityId: "platform.identity",
        executionId: null,
        ...overrides,
      },
    };
  }

  it("lets an authorised human inspect a run in session scope", async () => {
    await seedHome();
    const result = await inspectWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId,
        runId: "run-1",
      },
      sessionDeps({
        inspect: async () => inspection(),
      }),
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.inspection.run.id, "run-1");
      assert.equal(result.inspection.run.workspaceId, workspaceId);
    }
  });

  it("denies unauthenticated inspect and does not load the run", async () => {
    let called = 0;
    const result = await inspectWorkforceRunFromSession(
      {
        session: null,
        activeWorkspaceId: workspaceId,
        ventureId,
        runId: "run-1",
      },
      sessionDeps({
        inspect: async () => {
          called += 1;
          return inspection();
        },
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "UNAUTHENTICATED");
    }
    assert.equal(called, 0);
  });

  it("denies inspect of another workspace or Venture run", async () => {
    await seedHome();
    await seedVenture({
      workspaceId: otherWorkspaceId,
      ventureId: otherVentureId,
      name: "Other Venture",
      slug: "other-venture",
    });
    await grant("owner", userId, otherWorkspaceId);

    const foreignWorkspace = await inspectWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId,
        runId: "run-foreign-ws",
      },
      sessionDeps({
        inspect: async () =>
          inspection({ workspaceId: otherWorkspaceId, ventureId: otherVentureId }),
      }),
    );
    assert.equal(foreignWorkspace.ok, false);
    if (!foreignWorkspace.ok) {
      assert.equal(foreignWorkspace.failure, "SCOPE_MISMATCH");
    }

    const foreignVenture = await inspectWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId,
        runId: "run-foreign-venture",
      },
      sessionDeps({
        inspect: async () => inspection({ ventureId: otherVentureId }),
      }),
    );
    assert.equal(foreignVenture.ok, false);
    if (!foreignVenture.ok) {
      assert.equal(foreignVenture.failure, "SCOPE_MISMATCH");
    }
  });

  it("returns NOT_FOUND when the run does not exist", async () => {
    await seedHome();
    const result = await inspectWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId,
        runId: "missing",
      },
      sessionDeps({
        inspect: async () => undefined,
      }),
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, "NOT_FOUND");
    }
  });

  it("does not expose evidence JSON when inspecting a persisted run", async () => {
    await seedHome();
    const runId = createId<WorkforceRunId>();
    const now = "2026-08-26T00:00:00.000Z";
    await getDb().insert(runTable).values({
      id: runId,
      jobId: null,
      workspaceId,
      ventureId,
      agentInstanceId: "instance-1",
      definitionId: "definition-1",
      definitionVersion: "1",
      objective: "secret-objective",
      phase: "completed",
      completionKind: "executed",
      failureCategory: null,
      sourceRequestId: runId,
      selectedCapabilityId: null,
      selectedActionIndex: null,
      selectedActionJson: null,
      argumentHash: null,
      fingerprintHash: null,
      executionId: null,
      approvalId: null,
      verificationOutcome: "VERIFIED",
      modelCallCount: 1,
      requestedByUserId: userId,
      createdAt: now,
      updatedAt: now,
      completedAt: now,
      evidenceJson: JSON.stringify([{ id: "ev.secret", excerpt: "care-data" }]),
      citationsJson: null,
    });

    const result = await inspectWorkforceRunFromSession(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId,
        runId,
      },
      sessionDeps(),
    );
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    const serialized = JSON.stringify(result.inspection);
    assert.equal(serialized.includes("care-data"), false);
    assert.equal(serialized.includes("ev.secret"), false);
    assert.equal(serialized.includes("secret-objective"), false);
    assert.equal(serialized.includes("evidenceJson"), false);
  });
});

describe("Workforce session entry isolation", () => {
  it("keeps session entry and actions Core-generic and Qualora-free", async () => {
    const entry = await readFile(join(here, "session-entry.ts"), "utf8");
    const actions = await readFile(join(here, "actions.ts"), "utf8");
    const service = await readFile(join(here, "service.ts"), "utf8");
    for (const source of [entry, actions, service]) {
      assert.doesNotMatch(source, /Qualora|Calviora|Farmora|CONFIRMED|DISMISSED/);
      assert.doesNotMatch(source, /modules\/qualora/);
    }
    const coreFiles = [
      "core/workforce/run.ts",
      "core/workforce/execution.ts",
      "core/workforce/authority.ts",
      "core/workforce/bindings.ts",
      "core/workforce/approval.ts",
    ];
    for (const relative of coreFiles) {
      const source = await readFile(join(webSrc, relative), "utf8");
      assert.doesNotMatch(source, /createWorkforceRunFromSession|inspectWorkforceRunFromSession/);
      assert.doesNotMatch(source, /getSession|getActiveWorkspaceId/);
    }
    assert.equal(PRODUCTION_WORKFORCE_BINDINGS.length, 1);
    assert.match(entry, /WORKFORCE_APPROVAL_PERMISSION/);
    assert.match(actions, /getSession/);
    assert.match(actions, /getActiveWorkspaceId/);
  });
});
