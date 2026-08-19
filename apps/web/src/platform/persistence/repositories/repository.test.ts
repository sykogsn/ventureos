import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { UserId, VentureId, WorkspaceId } from "../../../contracts";
import { ensureSchema } from "../db";
import { createDbMembershipStore } from "../../permissions/membership-store";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "./sqlite";
import type { PersistedVenture } from "./ports";
import type { Recommendation } from "../../../core/recommendation";
import type { PolicyFinding } from "../../../core/policy";

const NOW = "2026-08-19T12:00:00.000Z";
const userId = "user-1" as UserId;
const workspaceId = "ws-1" as WorkspaceId;
const ventureId = "ven-1" as VentureId;

function ventureRow(overrides: Partial<PersistedVenture> = {}): PersistedVenture {
  return {
    id: ventureId,
    workspaceId,
    name: "North Star",
    slug: "north-star",
    stage: "Idea",
    href: "/ventures/hq/north-star",
    foundedAt: NOW,
    category: "SaaS",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Cadence.",
      category: "SaaS",
      stage: "Idea",
      goal: "MVP",
      posture: "human-led",
      risk: "focused",
      motion: "Sell the week.",
      cadence: "Weekly",
    },
    mission: {
      today: {
        title: "",
        ask: "",
        whyNow: "",
        ifDeferred: "",
        timeNeeded: "",
        actionLabel: "",
        actionHref: "/dashboard",
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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function recommendation(id: string, scope: string): Recommendation {
  return {
    id,
    ventureId: scope as VentureId,
    company: "North Star",
    companyHref: "/ventures/hq/north-star",
    title: "Record the call",
    summary: "A founder call is open.",
    recommendedAction: "Record the call.",
    reason: "The queue is waiting.",
    supportingEvidence: [],
    confidence: 0.8,
    confidenceLabel: "High",
    executiveConsensus: { alignment: 1, label: "unanimous", votes: [] },
    ownerExecutive: "founder",
    priority: "high",
    expectedImpact: "Unblocks the week.",
    estimatedEffort: "15m",
    actionLabel: "Record",
    actionHref: "/dashboard",
    isPrimary: true,
    briefing: true,
    originatingPolicyId: "pol-1",
    originatingPolicyTitle: "Founder cadence",
    policyOwner: "founder",
    policySeverity: "high",
    findingId: "find-1",
    finding: "An open call.",
  };
}

function finding(id: string): PolicyFinding {
  return {
    id,
    policyId: "pol-1",
    policyTitle: "Founder cadence",
    policyOwner: "founder",
    severity: "high",
    status: "watch",
    ventureId,
    company: "North Star",
    companyHref: "/ventures/hq/north-star",
    finding: "An open call.",
    reason: "The queue is waiting.",
    requiredAction: "Record the call.",
    title: "Record the call",
    actingRole: "founder",
    alliedRoles: [],
    briefing: true,
    expectedImpact: "Unblocks the week.",
    estimatedEffort: "15m",
    actionLabel: "Record",
    actionHref: "/dashboard",
    evidence: [],
  };
}

describe("persistence repositories", () => {
  beforeEach(async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
  });

  it("shares one database across repository facades in the same lifecycle", async () => {
    const first = getPersistence();
    await first.organisations.insert({
      id: workspaceId,
      name: "Alpha",
      slug: "alpha",
      createdAt: NOW,
    });
    const second = getPersistence();
    const row = await second.organisations.findById(workspaceId);
    assert.equal(row?.name, "Alpha");
    assert.equal(first.organisations, second.organisations);
  });

  it("recovers to an empty store after a lifecycle reset", async () => {
    const store = getPersistence();
    await store.organisations.insert({
      id: workspaceId,
      name: "Alpha",
      slug: "alpha",
      createdAt: NOW,
    });
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const recovered = getPersistence();
    assert.equal(await recovered.organisations.findById(workspaceId), null);
  });

  it("persists workspaces and lists them for a member", async () => {
    const store = getPersistence();
    await store.organisations.insert({
      id: workspaceId,
      name: "Alpha",
      slug: "alpha",
      createdAt: NOW,
    });
    await store.memberships.insert({
      workspaceId,
      userId,
      role: "owner",
      createdAt: NOW,
    });
    const listed = await store.organisations.listForUser(userId);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.slug, "alpha");
  });

  it("persists and updates a venture", async () => {
    const store = getPersistence();
    await store.organisations.insert({
      id: workspaceId,
      name: "Alpha",
      slug: "alpha",
      createdAt: NOW,
    });
    await store.ventures.insert(ventureRow());
    const found = await store.ventures.findBySlug(workspaceId, "north-star");
    assert.equal(found?.name, "North Star");
    await store.ventures.update(ventureRow({ name: "North Star OS", updatedAt: NOW }));
    const updated = await store.ventures.findById(ventureId);
    assert.equal(updated?.name, "North Star OS");
    assert.equal(await store.ventures.slugTaken(workspaceId, "north-star"), true);
  });

  it("replaces recommendations for a scope", async () => {
    const store = getPersistence();
    await store.recommendations.replaceForScope(
      workspaceId,
      ventureId,
      [recommendation("rec-1", ventureId)],
      NOW,
    );
    await store.recommendations.replaceForScope(
      workspaceId,
      ventureId,
      [recommendation("rec-2", ventureId)],
      NOW,
    );
    const items = await store.recommendations.listForWorkspace(workspaceId);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "rec-2");
  });

  it("removes recommendation scopes that disappear from a workspace snapshot", async () => {
    const store = getPersistence();
    await store.recommendations.replaceForScope(
      workspaceId,
      "gone",
      [recommendation("rec-old", "gone")],
      NOW,
    );
    await store.recommendations.replaceForWorkspace(
      workspaceId,
      [recommendation("rec-keep", ventureId)],
      NOW,
    );
    const items = await store.recommendations.listForWorkspace(workspaceId);
    assert.equal(items.length, 1);
    assert.equal(items[0]?.id, "rec-keep");
  });

  it("maps empty definition columns to the default VentureOS Company ref", async () => {
    const store = getPersistence();
    await store.organisations.insert({
      id: workspaceId,
      name: "Alpha",
      slug: "alpha",
      createdAt: NOW,
    });
    await store.ventures.insert(
      ventureRow({ definitionId: "", definitionVersion: "" }),
    );
    const found = await store.ventures.findById(ventureId);
    assert.equal(found?.definitionId, "ventureos.company");
    assert.equal(found?.definitionVersion, "1.0.0");
  });

  it("loads policy findings from the workspace snapshot", async () => {
    const store = getPersistence();
    await store.policies.upsertState({
      workspaceId,
      library: [],
      findings: [finding("find-snapshot")],
      updatedAt: NOW,
    });
    await store.policies.replaceFindings(workspaceId, [finding("find-rows")], NOW);
    const loaded = await store.policies.loadState(workspaceId);
    assert.equal(loaded?.findings[0]?.id, "find-snapshot");
  });

  it("recovers policy findings from denormalized rows when the snapshot is empty", async () => {
    const store = getPersistence();
    await store.policies.upsertState({
      workspaceId,
      library: [],
      findings: [],
      updatedAt: NOW,
    });
    await store.policies.replaceFindings(workspaceId, [finding("find-legacy")], NOW);
    const loaded = await store.policies.loadState(workspaceId);
    assert.equal(loaded?.findings[0]?.id, "find-legacy");
  });

  it("persists membership through the membership repository used by permissions", async () => {
    const store = getPersistence();
    const memberships = createDbMembershipStore();
    await memberships.setRole(userId, workspaceId, "owner");
    assert.equal(await memberships.getRole(userId, workspaceId), "owner");
    await memberships.setRole(userId, workspaceId, "admin");
    assert.equal(await store.memberships.getRole(userId, workspaceId), "admin");
  });
});
