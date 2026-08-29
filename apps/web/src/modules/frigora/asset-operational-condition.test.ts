import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import type {
  FrigoraAssetOperationalConditionKind,
  FrigoraScope,
} from "./types";
import { FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const ASSERTED = "2026-08-28T10:30:00.000Z";
const LATER = "2026-08-28T12:00:00.000Z";
const EARLIER = "2026-08-28T09:00:00.000Z";

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

async function seed(options: {
  reset?: boolean;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
  definitionId?: string;
  definitionVersion?: string;
} = {}) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
  const workspaceId = (options.workspaceId ?? "ws-frigora") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-frigora") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const store = getPersistence();
  if (!(await store.organisations.findById(workspaceId))) {
    await store.organisations.insert({
      id: workspaceId,
      name: "Frigora Workspace",
      slug: `ws-${workspaceId}`,
      createdAt: NOW,
    });
  }
  await store.memberships.setRole({
    userId,
    workspaceId,
    role: options.role ?? "owner",
    createdAt: NOW,
  });
  await store.ventures.insert(
    ventureRow({
      id: ventureId,
      workspaceId,
      slug: `venture-${ventureId}`,
      definitionId: options.definitionId ?? "frigora",
      definitionVersion: options.definitionVersion ?? "0.14.0",
    }),
  );
  return {
    workspaceId,
    ventureId,
    userId,
    scope: { userId, workspaceId, ventureId } satisfies FrigoraScope,
    service: createFrigoraService({
      permissions: createPermissionService(createDbMembershipStore()),
    }),
  };
}

function ventureRow(overrides: Partial<PersistedVenture> = {}): PersistedVenture {
  return {
    id: "ven-frigora" as VentureId,
    workspaceId: "ws-frigora" as WorkspaceId,
    name: "Frigora One",
    slug: "frigora-one",
    stage: "Idea",
    href: "/ventures/hq/frigora-one",
    foundedAt: NOW,
    category: "Operations",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Keep the cold chain honest.",
      category: "Operations",
      stage: "Idea",
      goal: "Admit operational identity.",
      posture: "human-led",
      risk: "focused",
      motion: "Serve refrigeration sites.",
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
    definitionId: "frigora",
    definitionVersion: "0.14.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code, error.message);
    return true;
  });
}

async function addMember(workspaceId: WorkspaceId, userId: UserId) {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
}

async function seedHierarchy(
  service: ReturnType<typeof createFrigoraService>,
  scope: FrigoraScope,
) {
  const customer = await service.createCustomer(scope, {
    code: "FUELCO",
    displayName: "FuelCo",
  });
  const site = await service.createSite(scope, {
    customerId: customer.id,
    code: "SANDTON-N",
    name: "Sandton North",
  });
  const asset = await service.createAsset(scope, {
    siteId: site.id,
    tag: "FZ-118",
    name: "Display freezer",
    refrigerantType: "R404A",
    designTargetCelsius: -18,
  });
  const workOrder = await service.createWorkOrder(scope, {
    siteId: site.id,
    workReference: "WO-1864",
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "display freezer warm",
  });
  return { customer, site, asset, workOrder };
}

function recordInput(
  assetId: string,
  overrides: Partial<{
    conditionKind: FrigoraAssetOperationalConditionKind;
    notes: string | null;
    visitId: string | null;
    workOrderId: string | null;
    assertedAt: string;
    assertedByUserId: UserId;
    recordedByUserId: UserId;
  }> = {},
) {
  return {
    assetId,
    conditionKind: overrides.conditionKind ?? ("non_operational" as const),
    notes: overrides.notes === undefined ? "Left isolated" : overrides.notes,
    visitId: overrides.visitId,
    workOrderId: overrides.workOrderId,
    assertedAt: overrides.assertedAt ?? ASSERTED,
    assertedByUserId: overrides.assertedByUserId ?? ("user-asserter" as UserId),
    recordedByUserId: overrides.recordedByUserId ?? ("user-recorder" as UserId),
  };
}

describe("Frigora asset operational condition (F0.14)", () => {
  it("records all locked condition kinds and rejects invalid kinds", async () => {
    const owner = await seed();
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    for (const [index, conditionKind] of FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS.entries()) {
      const row = await owner.service.recordAssetOperationalCondition(
        owner.scope,
        recordInput(asset.id, {
          conditionKind,
          assertedAt: `2026-08-28T10:3${index}:00.000Z`,
        }),
      );
      assert.equal(row.conditionKind, conditionKind);
      assert.equal(row.assetId, asset.id);
      assert.equal(row.visitId, null);
      assert.equal(row.workOrderId, null);
      assert.equal(row.updatedAt, row.createdAt);
    }
    await expectCode(
      () =>
        owner.service.recordAssetOperationalCondition(owner.scope, {
          ...recordInput(asset.id),
          conditionKind: "awaiting_parts" as FrigoraAssetOperationalConditionKind,
        }),
      "invalid_kind",
    );
  });

  it("requires asset and workspace members for dual provenance", async () => {
    const owner = await seed();
    const asserterId = "user-asserter" as UserId;
    await addMember(owner.workspaceId, asserterId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    await expectCode(
      () =>
        owner.service.recordAssetOperationalCondition(
          owner.scope,
          recordInput(asset.id, { recordedByUserId: "user-missing" as UserId }),
        ),
      "not_found",
    );
    await expectCode(
      () =>
        owner.service.recordAssetOperationalCondition(owner.scope, {
          ...recordInput(asset.id),
          assetId: "asset-missing",
        }),
      "not_found",
    );
  });

  it("supports asset-only and validated contextual combinations without provenance backfill", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset, workOrder, site, customer } = await seedHierarchy(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });

    const assetOnly = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { notes: null }),
    );
    assert.equal(assetOnly.visitId, null);
    assert.equal(assetOnly.workOrderId, null);
    assert.equal(assetOnly.notes, null);

    const withWo = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { workOrderId: workOrder.id, assertedAt: LATER }),
    );
    assert.equal(withWo.workOrderId, workOrder.id);
    assert.equal(withWo.visitId, null);

    const withVisit = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, {
        visitId: visit.id,
        assertedAt: "2026-08-28T10:45:00.000Z",
      }),
    );
    assert.equal(withVisit.visitId, visit.id);
    assert.equal(withVisit.workOrderId, null);

    const withBoth = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, {
        visitId: visit.id,
        workOrderId: workOrder.id,
        assertedAt: "2026-08-28T10:50:00.000Z",
      }),
    );
    assert.equal(withBoth.visitId, visit.id);
    assert.equal(withBoth.workOrderId, workOrder.id);

    const otherSite = await owner.service.createSite(owner.scope, {
      customerId: customer.id,
      code: "OTHER",
      name: "Other",
    });
    const otherAsset = await owner.service.createAsset(owner.scope, {
      siteId: otherSite.id,
      tag: "OTHER-1",
    });
    const otherWo = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-OTHER",
      workKind: "reactive",
      primaryAssetId: null,
      reportedCondition: "noise",
    });
    await expectCode(
      () =>
        owner.service.recordAssetOperationalCondition(
          owner.scope,
          recordInput(asset.id, { workOrderId: otherWo.id }),
        ),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordAssetOperationalCondition(
          owner.scope,
          recordInput(otherAsset.id, { workOrderId: workOrder.id }),
        ),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordAssetOperationalCondition(
          owner.scope,
          recordInput(asset.id, { visitId: visit.id, workOrderId: otherWo.id }),
        ),
      "invalid_input",
    );

    const cancelled = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-28T11:00:00.000Z",
    });
    await owner.service.cancelVisit(owner.scope, cancelled.id);
    await expectCode(
      () =>
        owner.service.recordAssetOperationalCondition(
          owner.scope,
          recordInput(asset.id, { visitId: cancelled.id }),
        ),
      "invalid_status",
    );
  });

  it("selects current condition by assertedAt then id and supports delayed recording", async () => {
    const owner = await seed();
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    assert.equal(await owner.service.getCurrentAssetOperationalCondition(owner.scope, asset.id), null);

    const delayed = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, {
        conditionKind: "operational",
        assertedAt: EARLIER,
      }),
    );
    const laterTruth = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, {
        conditionKind: "non_operational",
        assertedAt: LATER,
      }),
    );
    const current = await owner.service.getCurrentAssetOperationalCondition(owner.scope, asset.id);
    assert.equal(current?.id, laterTruth.id);
    assert.ok(delayed.createdAt >= delayed.assertedAt || delayed.assertedAt === EARLIER);

    const tieA = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, {
        conditionKind: "partially_operational",
        assertedAt: "2026-08-28T13:00:00.000Z",
      }),
    );
    const tieB = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, {
        conditionKind: "unknown",
        assertedAt: "2026-08-28T13:00:00.000Z",
      }),
    );
    const tiedCurrent = await owner.service.getCurrentAssetOperationalCondition(
      owner.scope,
      asset.id,
    );
    const expectedId = tieA.id > tieB.id ? tieA.id : tieB.id;
    assert.equal(tiedCurrent?.id, expectedId);

    const listed = await owner.service.listAssetOperationalConditionsByAsset(
      owner.scope,
      asset.id,
    );
    for (let index = 1; index < listed.length; index += 1) {
      const previous = listed[index - 1]!;
      const next = listed[index]!;
      assert.ok(previous.assertedAt <= next.assertedAt);
      if (previous.assertedAt === next.assertedAt) {
        assert.ok(previous.id <= next.id);
      }
    }
  });

  it("is append-only and preserves prior assertions", async () => {
    const owner = await seed();
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const first = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { conditionKind: "operational" }),
    );
    await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { conditionKind: "non_operational", assertedAt: LATER }),
    );
    const loaded = await owner.service.getAssetOperationalCondition(owner.scope, first.id);
    assert.deepEqual(loaded, first);
    assert.equal("updateAssetOperationalCondition" in owner.service, false);
    assert.equal("deleteAssetOperationalCondition" in owner.service, false);
    assert.equal("archiveAssetOperationalCondition" in owner.service, false);
  });

  it("allows reads and new assertions on decommissioned assets without mutating status", async () => {
    const owner = await seed();
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const prior = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { conditionKind: "operational" }),
    );
    const decommissioned = await owner.service.decommissionAsset(owner.scope, asset.id);
    assert.equal(decommissioned.status, "decommissioned");
    const after = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { conditionKind: "non_operational", assertedAt: LATER }),
    );
    const loadedAsset = await owner.service.getAsset(owner.scope, asset.id);
    assert.equal(loadedAsset?.status, "decommissioned");
    assert.equal(
      (await owner.service.getAssetOperationalCondition(owner.scope, prior.id))?.id,
      prior.id,
    );
    assert.equal(
      (await owner.service.getCurrentAssetOperationalCondition(owner.scope, asset.id))?.id,
      after.id,
    );
  });

  it("does not mutate sibling truths and does not infer condition from them", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset, workOrder } = await seedHierarchy(owner.service, owner.scope);
    const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: ARRIVED,
    });
    await owner.service.recordFieldCapture(owner.scope, visit.id, {
      captureKind: "measurement",
      captureCode: "temperature",
      valueNumeric: -5,
      valueUnit: "celsius",
      observedAt: ASSERTED,
      userId: attendeeId,
      assetId: asset.id,
    });
    await owner.service.recordTechnicalFinding(owner.scope, visit.id, {
      findingKind: "confirmed_fault",
      description: "Compressor failed",
      assertedAt: ASSERTED,
      userId: attendeeId,
      assetId: asset.id,
    });
    await owner.service.recordCorrectiveAction(owner.scope, visit.id, {
      description: "Isolated supply",
      performedAt: ASSERTED,
      performedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    await owner.service.recordVisitOutcome(owner.scope, visit.id, {
      description: "Unit left out of service",
      outcomeAt: ASSERTED,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    await owner.service.recordRecommendedAction(owner.scope, visit.id, {
      description: "Replace compressor",
      recommendedAt: ASSERTED,
      recommendedByUserId: attendeeId,
      recordedByUserId: attendeeId,
      assetId: asset.id,
    });
    assert.equal(await owner.service.getCurrentAssetOperationalCondition(owner.scope, asset.id), null);

    const beforeWo = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const beforeVisit = await owner.service.getVisit(owner.scope, visit.id);
    const beforeAsset = await owner.service.getAsset(owner.scope, asset.id);
    const recommendationsBefore = (
      await getPersistence().recommendations.listForWorkspace(owner.workspaceId)
    ).length;
    await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { conditionKind: "non_operational" }),
    );
    assert.deepEqual(await owner.service.getWorkOrder(owner.scope, workOrder.id), beforeWo);
    assert.deepEqual(await owner.service.getVisit(owner.scope, visit.id), beforeVisit);
    assert.equal((await owner.service.getAsset(owner.scope, asset.id))?.status, beforeAsset?.status);
    assert.equal(
      (await getPersistence().recommendations.listForWorkspace(owner.workspaceId)).length,
      recommendationsBefore,
    );
  });

  it("projects operational_condition into asset history with locked mapping", async () => {
    const owner = await seed();
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const condition = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { conditionKind: "partially_operational", notes: "Limited cooling" }),
    );
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const entry = history.find((item) => item.kind === "operational_condition");
    assert.ok(entry);
    assert.equal(entry.sourceId, condition.id);
    assert.equal(entry.occurredAt, condition.assertedAt);
    assert.equal(entry.recordedAt, condition.createdAt);
    assert.equal(entry.actorUserId, condition.assertedByUserId);
    assert.equal(entry.recordedByUserId, condition.recordedByUserId);
    if (entry.kind === "operational_condition") {
      assert.equal(entry.detail.conditionKind, "partially_operational");
      assert.equal(entry.detail.notes, "Limited cooling");
    }
  });

  it("enforces authorization and tenant isolation", async () => {
    const owner = await seed();
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    const memberId = "user-member" as UserId;
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    await addMember(owner.workspaceId, memberId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const row = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id),
    );
    await expectCode(
      () =>
        owner.service.recordAssetOperationalCondition(
          { ...owner.scope, userId: "user-outsider" as UserId },
          recordInput(asset.id),
        ),
      "forbidden",
    );
    const memberRead = await owner.service.listAssetOperationalConditionsByAsset(
      { ...owner.scope, userId: memberId },
      asset.id,
    );
    assert.equal(memberRead[0]?.id, row.id);

    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other",
      }),
    );
    assert.deepEqual(
      await owner.service.listAssetOperationalConditionsByAsset(
        { ...owner.scope, ventureId: otherVenture },
        asset.id,
      ),
      [],
    );
    assert.equal(
      await owner.service.getAssetOperationalCondition(
        { ...owner.scope, ventureId: otherVenture },
        row.id,
      ),
      null,
    );

    const { scope, service } = await seed({
      reset: false,
      ventureId: "ven-company" as VentureId,
      definitionId: "ventureos.company",
    });
    await expectCode(
      () => service.recordAssetOperationalCondition(scope, recordInput(asset.id)),
      "not_frigora",
    );
  });

  it("persists through restart and keeps SCHEMA_GENERATION at 19", async () => {
    const owner = await seed();
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const row = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id),
    );
    await ensureSchema();
    const loaded = await owner.service.getAssetOperationalCondition(owner.scope, row.id);
    assert.equal(loaded?.id, row.id);

    const dbPath = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));
    const schemaPath = fileURLToPath(new URL("../../platform/persistence/schema.ts", import.meta.url));
    assert.match(readFileSync(dbPath, "utf8"), /SCHEMA_GENERATION = 19/);
    assert.match(readFileSync(schemaPath, "utf8"), /frigora_asset_operational_conditions/);
    assert.equal(readFileSync(schemaPath, "utf8").includes("frigora_asset_history"), false);
  });

  it("admits frigora@0.14.0 and remains compatible with persisted 0.13.0", async () => {
    const frigora = platformVentureRegistry.resolve("frigora");
    assert.equal(frigora.version, "0.14.0");
    assert.match(frigora.description, /Asset operational condition/);
    assert.match(frigora.description, /parts catalogue/);

    const owner = await seed({ definitionVersion: "0.13.0" });
    const asserterId = "user-asserter" as UserId;
    const recorderId = "user-recorder" as UserId;
    await addMember(owner.workspaceId, asserterId);
    await addMember(owner.workspaceId, recorderId);
    const { asset } = await seedHierarchy(owner.service, owner.scope);
    const row = await owner.service.recordAssetOperationalCondition(
      owner.scope,
      recordInput(asset.id, { conditionKind: "operational" }),
    );
    assert.equal(row.conditionKind, "operational");
  });
});
