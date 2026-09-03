import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { getPlatform } from "@/platform/kernel";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { StoredObjectError } from "@/platform/storage/errors";
import { findStoredObjectById } from "@/platform/storage/metadata";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import { createFrigoraStore, type FrigoraStore } from "./store";
import {
  FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS,
  FRIGORA_VISIT_EVIDENCE_CATEGORIES,
  type FrigoraScope,
  type FrigoraVisitEvidence,
  type FrigoraVisitEvidenceCategory,
} from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const JPEG_BODY = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

after(() => {
  getPlatform().scheduler.stopAll();
});

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
      definitionVersion: options.definitionVersion ?? "0.16.0",
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
    definitionVersion: "0.16.0",
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

async function seedOpenVisit(
  service: ReturnType<typeof createFrigoraService>,
  scope: FrigoraScope,
  attendeeId: UserId,
) {
  const hierarchy = await seedHierarchy(service, scope);
  const visit = await service.recordVisitArrival(scope, hierarchy.workOrder.id, {
    userId: attendeeId,
    arrivedAt: ARRIVED,
  });
  return { ...hierarchy, visit };
}

async function addMember(workspaceId: WorkspaceId, userId: UserId) {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
}

function fileInput(
  overrides: Partial<{
    category: FrigoraVisitEvidenceCategory;
    description: string | null;
    userId: UserId;
    assetId: string | null;
    originalFilename: string;
    mimeType: string;
    body: Uint8Array;
  }> = {},
) {
  return {
    body: overrides.body ?? JPEG_BODY,
    originalFilename: overrides.originalFilename ?? "panel-photo.jpg",
    mimeType: overrides.mimeType ?? "image/jpeg",
    category: overrides.category ?? "TECHNICAL",
    description: overrides.description ?? null,
    userId: overrides.userId ?? ("user-attendee" as UserId),
    assetId: overrides.assetId,
  };
}

function assertEvidenceShape(row: FrigoraVisitEvidence) {
  assert.equal(typeof row.id, "string");
  assert.equal(typeof row.workspaceId, "string");
  assert.equal(typeof row.ventureId, "string");
  assert.equal(typeof row.visitId, "string");
  assert.equal(typeof row.workOrderId, "string");
  assert.equal(typeof row.storedObjectId, "string");
  assert.equal(typeof row.category, "string");
  assert.equal(typeof row.capturedAt, "string");
  assert.equal(typeof row.recordedByUserId, "string");
  assert.equal(typeof row.createdAt, "string");
  assert.equal(typeof row.originalFilename, "string");
  assert.equal(typeof row.mimeType, "string");
  assert.equal(typeof row.sizeBytes, "number");
  assert.equal("updatedAt" in row, false);
  assert.equal("evidenceId" in row, false);
  assert.equal("verified" in row, false);
  assert.equal("approved" in row, false);
}

describe("Frigora visit evidence (F2.0)", () => {
  it("records every category, validates OTHER description, and supports multiple evidence per visit", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, asset } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    for (const category of FRIGORA_VISIT_EVIDENCE_CATEGORIES) {
      if (category === "OTHER") {
        await expectCode(
          () =>
            owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
              ...fileInput({ category, description: null, userId: attendeeId }),
            }),
          "invalid_input",
        );
        const other = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
          ...fileInput({
            category,
            description: "Unlisted site signage",
            userId: attendeeId,
          }),
        });
        assert.equal(other.category, "OTHER");
        assert.equal(other.description, "Unlisted site signage");
      } else {
        const row = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
          ...fileInput({ category, userId: attendeeId }),
        });
        assertEvidenceShape(row);
        assert.equal(row.category, category);
        assert.equal(row.assetId, asset.id);
        assert.equal(row.originalFilename, "panel-photo.jpg");
        assert.equal(row.mimeType, "image/jpeg");
        assert.equal(row.sizeBytes, JPEG_BODY.length);
      }
    }

    const listed = await owner.service.listVisitEvidenceByVisit(owner.scope, visit.id);
    assert.equal(listed.length, FRIGORA_VISIT_EVIDENCE_CATEGORIES.length);
  });

  it("enforces permanent StoredObjectId uniqueness even after soft removal", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const row = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId }),
    });
    const otherVisit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-28T12:00:00.000Z",
    });
    await expectCode(
      () =>
        owner.service.linkVisitEvidence(owner.scope, otherVisit.id, {
          storedObjectId: row.storedObjectId,
          category: "TECHNICAL",
          userId: attendeeId,
        }),
      "duplicate",
    );

    await owner.service.removeVisitEvidence(owner.scope, row.id);
    const tombstoned = await owner.service.getVisitEvidence(owner.scope, row.id);
    assert.ok(tombstoned?.removedAt);
    const stillLinked = await createFrigoraStore().findVisitEvidenceByStoredObjectId(
      owner.ventureId,
      row.storedObjectId,
    );
    assert.equal(stillLinked?.id, row.id);

    await expectCode(
      () =>
        owner.service.linkVisitEvidence(owner.scope, otherVisit.id, {
          storedObjectId: row.storedObjectId,
          category: "TECHNICAL",
          userId: attendeeId,
        }),
      "not_found",
    );
  });

  it("isolates workspace and venture tenancy and rejects cross-linkage", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, workOrder, asset, customer } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const row = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId }),
    });

    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-frigora",
      }),
    );
    assert.deepEqual(
      await owner.service.listVisitEvidenceByVisit(
        { ...owner.scope, ventureId: otherVenture },
        visit.id,
      ),
      [],
    );

    const outsider = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-cross" as VentureId,
      userId: "user-other" as UserId,
    });
    assert.deepEqual(
      await outsider.service.listVisitEvidenceByVisit(outsider.scope, visit.id),
      [],
    );

    const otherSite = await owner.service.createSite(owner.scope, {
      customerId: customer.id,
      code: "OTHER-SITE",
      name: "Other site",
    });
    const wrongAsset = await owner.service.createAsset(owner.scope, {
      siteId: otherSite.id,
      tag: "FZ-999",
      name: "Other unit",
    });
    await expectCode(
      () =>
        owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
          ...fileInput({ userId: attendeeId, assetId: wrongAsset.id }),
        }),
      "invalid_input",
    );

    const stored = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId, assetId: asset.id, originalFilename: "scoped.jpg" }),
    });
    assert.equal(stored.assetId, asset.id);
    assert.equal(stored.visitId, visit.id);
    assert.notEqual(stored.id, row.id);
    assert.notEqual(otherSite.id, workOrder.siteId);
  });

  it("rejects StoredObject workspace or venture mismatch on link", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const otherVenture = "ven-alt" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({ id: otherVenture, workspaceId: owner.workspaceId, slug: "alt-frigora" }),
    );
    const otherScope = { ...owner.scope, ventureId: otherVenture };
    const otherVisitCtx = await seedOpenVisit(owner.service, otherScope, attendeeId);

    const foreign = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId, originalFilename: "foreign.jpg" }),
    });

    await expectCode(
      () =>
        owner.service.linkVisitEvidence(otherScope, otherVisitCtx.visit.id, {
          storedObjectId: foreign.storedObjectId,
          category: "TECHNICAL",
          userId: attendeeId,
        }),
      "forbidden",
    );
  });

  it("allows owner write and member read but denies member write", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const memberId = "user-member" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, memberId);
    const { visit, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const row = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId }),
    });

    const memberScope = { ...owner.scope, userId: memberId };
    const memberListed = await owner.service.listVisitEvidenceByVisit(memberScope, visit.id);
    assert.equal(memberListed.length, 1);
    assert.equal(memberListed[0]?.id, row.id);

    await expectCode(
      () =>
        owner.service.recordVisitEvidenceWithFile(memberScope, visit.id, {
          ...fileInput({ userId: memberId, originalFilename: "member.jpg" }),
        }),
      "forbidden",
    );

    await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: memberId,
    });
    await expectCode(
      () =>
        owner.service.recordVisitEvidenceWithFile(memberScope, visit.id, {
          ...fileInput({ userId: memberId, originalFilename: "assigned-member.jpg" }),
        }),
      "forbidden",
    );
  });

  it("records and removes only while visit is open", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const row = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId }),
    });

    await owner.service.recordVisitDeparture(owner.scope, visit.id, { departedAt: DEPARTED });

    await expectCode(
      () =>
        owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
          ...fileInput({ userId: attendeeId, originalFilename: "after-depart.jpg" }),
        }),
      "invalid_status",
    );
    await expectCode(
      () => owner.service.removeVisitEvidence(owner.scope, row.id),
      "invalid_status",
    );

    const departedListed = await owner.service.listVisitEvidenceByVisit(owner.scope, visit.id);
    assert.equal(departedListed.length, 1);
    assert.equal(departedListed[0]?.id, row.id);

    const cancelVisit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-28T12:00:00.000Z",
    });
    await owner.service.cancelVisit(owner.scope, cancelVisit.id);
    await expectCode(
      () =>
        owner.service.recordVisitEvidenceWithFile(owner.scope, cancelVisit.id, {
          ...fileInput({ userId: attendeeId }),
        }),
      "invalid_status",
    );
  });

  it("handles storage failure, insert compensation, and missing bytes on remove", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    await assert.rejects(
      () =>
        owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
          ...fileInput({
            userId: attendeeId,
            mimeType: "application/javascript",
            body: JPEG_BODY,
          }),
        }),
      (error: unknown) => error instanceof StoredObjectError,
    );

    const baseStore = createFrigoraStore();
    let insertCalls = 0;
    const failingStore: FrigoraStore = {
      ...baseStore,
      insertVisitEvidence: async (evidence) => {
        insertCalls += 1;
        if (insertCalls === 1) {
          throw new FrigoraError("invalid_input", "simulated insert failure");
        }
        return baseStore.insertVisitEvidence(evidence);
      },
    };
    const compensatingService = createFrigoraService({
      store: failingStore,
      permissions: createPermissionService(createDbMembershipStore()),
    });

    await expectCode(
      () =>
        compensatingService.recordVisitEvidenceWithFile(owner.scope, visit.id, {
          ...fileInput({ userId: attendeeId, originalFilename: "compensate.jpg" }),
        }),
      "invalid_input",
    );

    const recovered = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId, originalFilename: "recovered.jpg" }),
    });
    assert.equal(recovered.originalFilename, "recovered.jpg");

    const removed = await owner.service.removeVisitEvidence(owner.scope, recovered.id);
    assert.ok(removed.removedAt);
    const tombstonedObject = await findStoredObjectById(recovered.storedObjectId);
    assert.ok(tombstonedObject?.deletedAt);
  });

  it("does not add evidenceId to F0 truth entities and omits asset history events", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, asset, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId }),
    });

    const loadedVisit = await owner.service.getVisit(owner.scope, visit.id);
    const loadedWorkOrder = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const loadedAsset = await owner.service.getAsset(owner.scope, asset.id);
    assert.equal("evidenceId" in (loadedVisit ?? {}), false);
    assert.equal("evidenceId" in (loadedWorkOrder ?? {}), false);
    assert.equal("evidenceId" in (loadedAsset ?? {}), false);

    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    assert.equal(
      history.some((entry) => String(entry.kind).includes("evidence")),
      false,
    );
    assert.equal(FRIGORA_ASSET_OPERATIONAL_CONDITION_KINDS.includes("evidence" as never), false);
  });

  it("persists through restart with SCHEMA_GENERATION 22 and frigora@0.16.0", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const row = await owner.service.recordVisitEvidenceWithFile(owner.scope, visit.id, {
      ...fileInput({ userId: attendeeId }),
    });
    await ensureSchema();
    const loaded = await owner.service.getVisitEvidence(owner.scope, row.id);
    assert.equal(loaded?.id, row.id);
    assert.equal(loaded?.originalFilename, row.originalFilename);

    const dbPath = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));
    const schemaPath = fileURLToPath(
      new URL("../../platform/persistence/schema.ts", import.meta.url),
    );
    assert.match(readFileSync(dbPath, "utf8"), /SCHEMA_GENERATION = 22/);
    assert.match(readFileSync(schemaPath, "utf8"), /frigora_visit_evidence/);
    assert.match(
      readFileSync(schemaPath, "utf8"),
      /frigora_visit_evidence_venture_stored_object_idx/,
    );
    assert.equal(
      readFileSync(schemaPath, "utf8").includes("removed_at IS NULL"),
      false,
    );

    const frigora = platformVentureRegistry.resolve("frigora");
    assert.equal(frigora.version, "0.16.0");
    assert.match(frigora.description, /Visit evidence/i);
  });
});
