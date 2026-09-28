import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { beforeEach, describe, it } from "node:test";
import type { UserId, VentureId, WorkspaceId } from "../../../contracts";
import { ensureSchema, getDatabaseUrl } from "../db";
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
    lifecycle: "operating",
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

  it("preserves a Frigora definition ref instead of coercing to VentureOS Company", async () => {
    const store = getPersistence();
    await store.organisations.insert({
      id: workspaceId,
      name: "Alpha",
      slug: "alpha",
      createdAt: NOW,
    });
    await store.ventures.insert(
      ventureRow({ definitionId: "frigora", definitionVersion: "0.1.0" }),
    );
    const found = await store.ventures.findById(ventureId);
    assert.equal(found?.definitionId, "frigora");
    assert.equal(found?.definitionVersion, "0.1.0");
  });

  it("persists instance operating lifecycle separately from marketing stage", async () => {
    const store = getPersistence();
    await store.organisations.insert({
      id: workspaceId,
      name: "Alpha",
      slug: "alpha",
      createdAt: NOW,
    });
    await store.ventures.insert(ventureRow({ stage: "Seed", lifecycle: "operating" }));
    const found = await store.ventures.findById(ventureId);
    assert.equal(found?.stage, "Seed");
    assert.equal(found?.lifecycle, "operating");
    await store.ventures.update({
      ...found!,
      lifecycle: "sunset",
      updatedAt: NOW,
    });
    const sunset = await store.ventures.findById(ventureId);
    assert.equal(sunset?.lifecycle, "sunset");
    assert.equal(sunset?.stage, "Seed");
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

  it("lists only workspace membership rows in deterministic order", async () => {
    const store = getPersistence();
    const laterUser = "user-later" as UserId;
    const otherWorkspace = "ws-other" as WorkspaceId;
    await store.memberships.insert({
      workspaceId,
      userId: laterUser,
      role: "member",
      createdAt: "2026-08-20T00:00:00.000Z",
    });
    await store.memberships.insert({
      workspaceId,
      userId,
      role: "owner",
      createdAt: NOW,
    });
    await store.memberships.insert({
      workspaceId: otherWorkspace,
      userId: "user-other" as UserId,
      role: "owner",
      createdAt: "2026-08-18T00:00:00.000Z",
    });
    const listed = await store.memberships.listByWorkspace(workspaceId);
    assert.deepEqual(listed, [
      { workspaceId, userId, role: "owner", createdAt: NOW },
      {
        workspaceId,
        userId: laterUser,
        role: "member",
        createdAt: "2026-08-20T00:00:00.000Z",
      },
    ]);
    assert.equal(Object.keys(listed[0] ?? {}).some((key) => /password|secret|hash/i.test(key)), false);
  });
});

const OWNED_EPHEMERAL_BASENAME =
  /^vos-ephemeral-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.db$/;

function ephemeralFilePath(url: string) {
  assert.match(url, /^file:/);
  const filePath = resolve(url.slice("file:".length));
  assert.equal(resolve(dirname(filePath)).toLowerCase(), resolve(tmpdir()).toLowerCase());
  assert.match(basename(filePath), OWNED_EPHEMERAL_BASENAME);
  return filePath;
}

describe("ephemeral database lifecycle", () => {
  it("replaces configured memory databases and deletes only the previous owned file", async () => {
    const sourcePaths = [
      join(process.cwd(), "src/platform/persistence/db.ts"),
      join(process.cwd(), "src/platform/persistence/durability-client.ts"),
      join(process.cwd(), "src/platform/persistence/schema.ts"),
    ];
    const sourceBefore = sourcePaths.map((path) => readFileSync(path));
    const outside = mkdtempSync(join(tmpdir(), "vos-not-owned-"));
    const explicitDatabase = join(outside, "application.db");
    const lookalikeOutsideTemp = join(outside, `vos-ephemeral-${randomUUID()}.db`);
    const unrelatedInTemp = join(tmpdir(), `vos-unrelated-${randomUUID()}.txt`);
    writeFileSync(explicitDatabase, "");
    writeFileSync(lookalikeOutsideTemp, "keep-outside");
    writeFileSync(unrelatedInTemp, "keep-temp");
    const ownedPaths: string[] = [];

    try {
      await resetPersistenceLifecycle(":memory:");
      const firstUrl = getDatabaseUrl();
      const firstPath = ephemeralFilePath(firstUrl);
      ownedPaths.push(firstPath);
      await ensureSchema();
      assert.equal(existsSync(firstPath), true);
      const store = getPersistence();
      await store.organisations.insert({
        id: workspaceId,
        name: "Alpha",
        slug: "alpha",
        createdAt: NOW,
      });
      assert.equal((await store.organisations.findById(workspaceId))?.name, "Alpha");

      await resetPersistenceLifecycle(":memory:");
      const secondPath = ephemeralFilePath(getDatabaseUrl());
      ownedPaths.push(secondPath);
      assert.notEqual(secondPath, firstPath);
      assert.equal(existsSync(firstPath), false);
      await ensureSchema();
      assert.equal(await getPersistence().organisations.findById(workspaceId), null);

      for (let reset = 0; reset < 4; reset += 1) {
        await resetPersistenceLifecycle(":memory:");
        ownedPaths.push(ephemeralFilePath(getDatabaseUrl()));
        await ensureSchema();
      }
      const currentPath = ownedPaths[ownedPaths.length - 1];
      assert.ok(currentPath);
      const surviving = ownedPaths.filter((path) => existsSync(path));
      assert.deepEqual(surviving, [currentPath]);

      const retainedUrl = getDatabaseUrl();
      await resetPersistenceLifecycle(retainedUrl);
      assert.equal(getDatabaseUrl(), retainedUrl);
      assert.equal(existsSync(currentPath), true);

      await resetPersistenceLifecycle(`file:${explicitDatabase.replaceAll("\\", "/")}`);
      await ensureSchema();
      assert.equal(existsSync(explicitDatabase), true);
      assert.equal(existsSync(currentPath), true);
      await getPersistence().organisations.insert({
        id: workspaceId,
        name: "Kept",
        slug: "kept",
        createdAt: NOW,
      });
      await resetPersistenceLifecycle(":memory:");
      assert.equal(existsSync(explicitDatabase), true);
      assert.equal(existsSync(lookalikeOutsideTemp), true);
      assert.equal(readFileSync(lookalikeOutsideTemp, "utf8"), "keep-outside");
      assert.equal(existsSync(unrelatedInTemp), true);
      assert.equal(readFileSync(unrelatedInTemp, "utf8"), "keep-temp");
      sourcePaths.forEach((path, index) => {
        assert.deepEqual(readFileSync(path), sourceBefore[index]);
      });
    } finally {
      await resetPersistenceLifecycle(":memory:");
      for (const path of [explicitDatabase, lookalikeOutsideTemp, unrelatedInTemp, ...ownedPaths]) {
        try {
          if (existsSync(path)) unlinkSync(path);
        } catch {
          // Test-owned decoys can stay locked after the process client closes.
        }
      }
    }
  });
});

import { rmSync } from "node:fs";
import { afterEach } from "node:test";
import { getClient } from "../db";
import type { IntelligenceCommit, IntelligenceWrite } from "./ports";

describe("AIF-02 durable repository", () => {
  let directory: string, url: string;
  const ws = "aif-repository";
  const metadata = (version: number): IntelligenceCommit => ({
    workspaceId: ws,
    expectedCatalogueVersion: version,
    recorderActorId: "actor",
    requiredPermission: "venture.update",
    reason: "Repository regression",
    evaluationTime: "2026-09-24T12:00:00.000Z",
  });
  const object = (
    id = "claim",
    revision = 0,
    kind: IntelligenceWrite["mutationKind"] = "CREATE",
    extra: Record<string, unknown> = {},
  ): IntelligenceWrite => ({
    objectId: id,
    originatingVentureId: "venture",
    objectType: "Claim",
    expectedObjectRevision: revision,
    mutationKind: kind,
    documentJson: JSON.stringify({
      id,
      type: "Claim",
      operatingScope: { workspaceId: ws, originatingVentureId: "venture" },
      validity: "ACTIVE",
      ...extra,
    }),
  });
  const repo = () => getPersistence().intelligence;
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), "vos-aif-repository-"));
    url = "file:" + join(directory, "test.db").replaceAll("\\", "/");
    await resetPersistenceLifecycle(url);
    await ensureSchema();
  });
  afterEach(async () => {
    await resetPersistenceLifecycle(":memory:");
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch (error) {
      // Windows may retain native SQLite statement handles after client.close().
      // The isolated fixture can remain in OS temp storage; test failures still propagate.
      if (
        process.platform !== "win32" ||
        (error as NodeJS.ErrnoException).code !== "EPERM"
      )
        throw error;
    }
  });
  it("creates version 1 and survives reopen with the identical latest projection", async () => {
    const result = await repo().commitMutation({
      ...metadata(0),
      write: object(),
    });
    assert.equal(result.version, 1);
    assert.equal(result.objects[0]!.currentRevision, 1);
    await resetPersistenceLifecycle(url);
    await ensureSchema();
    const reopened = await repo().loadCatalogue(ws);
    assert.equal(
      reopened.objects[0]!.documentJson,
      result.objects[0]!.documentJson,
    );
    assert.equal(
      reopened.objects[0]!.documentJson,
      reopened.revisions[0]!.documentJson,
    );
    assert.equal(
      reopened.objects[0]!.currentRevisionId,
      reopened.revisions[0]!.revisionId,
    );
    assert.equal(reopened.revisions[0]!.previousRevisionHash, null);
    assert.equal("delete" in repo(), false);
    assert.equal("hardDelete" in repo(), false);
  });
  it("appends amendments without overwriting history and returns ordered trace", async () => {
    const initial = await repo().commitMutation({
      ...metadata(0),
      write: object(),
    });
    await repo().commitMutation({
      ...metadata(1),
      write: object("claim", 1, "AMEND", { summary: "changed" }),
    });
    const trace = await repo().traceObject(ws, "claim");
    assert.deepEqual(
      trace.map((r) => r.revision),
      [1, 2],
    );
    assert.equal(trace[0]!.documentJson, initial.revisions[0]!.documentJson);
    assert.equal(trace[1]!.previousRevisionHash, trace[0]!.revisionHash);
    assert.equal(trace[1]!.previousRevisionId, trace[0]!.revisionId);
  });
  it("rejects a stale catalogue loaded by a second writer without a lost update", async () => {
    const a = await repo().loadCatalogue(ws),
      b = await repo().loadCatalogue(ws);
    await repo().commitMutation({ ...metadata(a.version), write: object() });
    await assert.rejects(
      repo().commitMutation({
        ...metadata(b.version),
        write: object("second"),
      }),
      /Catalogue version conflict/,
    );
    assert.equal((await repo().loadCatalogue(ws)).objects.length, 1);
  });
  it("rejects stale object revision independently of catalogue version", async () => {
    await repo().commitMutation({ ...metadata(0), write: object() });
    await assert.rejects(
      repo().commitMutation({
        ...metadata(1),
        write: object("claim", 0, "AMEND"),
      }),
      /Object revision conflict/,
    );
    assert.equal((await repo().loadCatalogue(ws)).version, 1);
  });
  it("atomically supersedes two objects at one catalogue version", async () => {
    await repo().commitMutation({ ...metadata(0), write: object() });
    const result = await repo().commitSupersession({
      ...metadata(1),
      successor: object("successor"),
      predecessor: object("claim", 1, "SUPERSEDE", {
        validity: "SUPERSEDED",
        supersededById: "successor",
      }),
    });
    assert.equal(result.version, 2);
    const pair = result.revisions.filter((r) => r.catalogueVersion === 2);
    assert.equal(pair.length, 2);
    assert.equal(pair[0]!.mutationId, pair[1]!.mutationId);
    assert.equal(pair[0]!.evaluationTime, pair[1]!.evaluationTime);
    assert.equal(
      (await repo().findCurrent(ws, "successor"))!.currentRevision,
      1,
    );
  });
  for (const operation of ["CREATE", "AMEND", "SUPERSEDE"] as const) {
    it(
      "rolls back " +
        operation +
        " after revision insertion when projection fails",
      async () => {
        if (operation !== "CREATE")
          await repo().commitMutation({ ...metadata(0), write: object() });
        const before = await repo().loadCatalogue(ws);
        const event = operation === "CREATE" ? "INSERT" : "UPDATE";
        await getClient().execute(
          "CREATE TRIGGER injected_projection_failure BEFORE " +
            event +
            " ON intelligence_objects BEGIN SELECT RAISE(ABORT, 'injected projection failure'); END",
        );
        if (operation === "SUPERSEDE") {
          await assert.rejects(
            repo().commitSupersession({
              ...metadata(1),
              successor: object("successor"),
              predecessor: object("claim", 1, "SUPERSEDE", {
                validity: "SUPERSEDED",
                supersededById: "successor",
              }),
            }),
            /injected projection failure/,
          );
        } else {
          await assert.rejects(
            repo().commitMutation({
              ...metadata(before.version),
              write: object("claim", before.version, operation),
            }),
            /injected projection failure/,
          );
        }
        assert.deepEqual(await repo().loadCatalogue(ws), before);
      },
    );
  }
  it("keeps retracted identities terminal even for raw repository amendments", async () => {
    await repo().commitMutation({ ...metadata(0), write: object() });
    await repo().commitMutation({
      ...metadata(1),
      write: object("claim", 1, "RETRACT", { validity: "RETRACTED" }),
    });
    await assert.rejects(
      repo().commitMutation({
        ...metadata(2),
        write: object("claim", 2, "AMEND"),
      }),
      /Terminal/,
    );
    assert.equal((await repo().traceObject(ws, "claim")).length, 2);
  });
  it("enforces row/payload ownership and workspace-scoped raw reads", async () => {
    await repo().commitMutation({ ...metadata(0), write: object() });
    assert.equal(await repo().findCurrent("other", "claim"), null);
    assert.deepEqual(await repo().traceObject("other", "claim"), []);
    await assert.rejects(
      repo().commitMutation({
        ...metadata(1),
        write: { ...object("new"), originatingVentureId: "wrong" },
      }),
      /identity mismatch/,
    );
    assert.equal((await repo().listCurrentForVenture(ws, "venture")).length, 1);
  });
  for (const [label, sql] of [
    [
      "current document",
      "UPDATE intelligence_objects SET document_json = '{}'",
    ],
    ["current hash", "UPDATE intelligence_objects SET document_hash = 'wrong'"],
    [
      "revision document",
      "UPDATE intelligence_revisions SET document_json = '{}'",
    ],
    [
      "previous link",
      "UPDATE intelligence_revisions SET previous_revision_hash = 'wrong' WHERE revision = 2",
    ],
    [
      "revision hash",
      "UPDATE intelligence_revisions SET revision_hash = 'wrong'",
    ],
    [
      "revision sequence",
      "DELETE FROM intelligence_revisions WHERE revision = 1",
    ],
    [
      "current pointer",
      "UPDATE intelligence_objects SET current_revision_id = 'wrong'",
    ],
  ]) {
    it("detects tampering of " + label, async () => {
      await repo().commitMutation({ ...metadata(0), write: object() });
      await repo().commitMutation({
        ...metadata(1),
        write: object("claim", 1, "AMEND"),
      });
      await getClient().execute(sql!);
      await assert.rejects(repo().traceObject(ws, "claim"), /integrity/);
    });
  }

  for (const configuredUrl of [":memory:", "file::memory:"]) {
    it("shares current platform ephemeral resolution for " + configuredUrl, async () => {
      await resetPersistenceLifecycle(configuredUrl);
      await ensureSchema();
      const resolved = getDatabaseUrl();
      assert.ok(resolved.startsWith("file:"));
      assert.ok(!resolved.includes(":memory:"));
      await repo().commitMutation({ ...metadata(0), write: object() });
      assert.equal(getDatabaseUrl(), resolved);
      const singleton = await getClient().execute("SELECT current_revision FROM intelligence_objects WHERE id = 'claim'");
      assert.equal(singleton.rows[0]?.current_revision, 1);
      assert.equal((await repo().loadCatalogue(ws)).version, 1);
      await assert.rejects(repo().commitMutation({ ...metadata(0), write: object("stale") }), /Catalogue version conflict/);
      assert.equal((await repo().loadCatalogue(ws)).objects.length, 1);
    });
  }
});
