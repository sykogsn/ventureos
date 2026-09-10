import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import { canonicalizeRefrigerantCode } from "./validation";
import type { FrigoraScope } from "./types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const NOW = "2026-09-09T00:00:00.000Z";
const ARRIVED = "2026-09-09T10:00:00.000Z";
const USED = "2026-09-09T10:30:00.000Z";

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

function ventureRow(input: {
  id: VentureId;
  workspaceId: WorkspaceId;
  slug: string;
  definitionId?: string;
  definitionVersion?: string;
}): PersistedVenture {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    name: "Frigora F3.0",
    slug: input.slug,
    stage: "concept",
    href: `/ventures/${input.id}`,
    foundedAt: NOW,
    category: "Operations",
    owner: "founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Keep the cold chain honest.",
      category: "Operations",
      stage: "Idea",
      goal: "Admit catalogue identities.",
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
    createdAt: NOW,
    updatedAt: NOW,
    definitionId: input.definitionId ?? "frigora",
    definitionVersion: input.definitionVersion ?? "0.20.0",
    lifecycle: "operating",
  };
}

async function seed(options: {
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
} = {}) {
  const workspaceId = (options.workspaceId ?? "ws-f30") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-f30") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const store = getPersistence();
  if (!(await store.organisations.findById(workspaceId))) {
    await store.organisations.insert({
      id: workspaceId,
      name: "F3.0 Workspace",
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
  if (!(await store.ventures.findById(ventureId))) {
    await store.ventures.insert(
      ventureRow({ id: ventureId, workspaceId, slug: `venture-${ventureId}` }),
    );
  }
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

async function addMember(workspaceId: WorkspaceId, userId: UserId, role: Role = "member") {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role,
    createdAt: NOW,
  });
}

async function seedOpenVisit(
  service: ReturnType<typeof createFrigoraService>,
  scope: FrigoraScope,
  attendingUserId: UserId,
) {
  const customer = await service.createCustomer(scope, {
    code: "C-F30",
    displayName: "Customer",
  });
  const site = await service.createSite(scope, {
    customerId: customer.id,
    code: "S-F30",
    name: "Site",
  });
  const asset = await service.createAsset(scope, {
    siteId: site.id,
    tag: "A-F30",
    name: "Asset",
    assetKind: "cold_room",
    refrigerantType: "R404A",
  });
  const workOrder = await service.createWorkOrder(scope, {
    siteId: site.id,
    primaryAssetId: asset.id,
    workReference: "WO-F30-1",
    workKind: "reactive",
    reportedCondition: "Warm",
  });
  await service.assignWorkOrder(scope, workOrder.id, { userId: attendingUserId });
  const visit = await service.recordVisitArrival(scope, workOrder.id, {
    userId: attendingUserId,
    arrivedAt: ARRIVED,
  });
  return { customer, site, asset, workOrder, visit };
}

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  try {
    await run();
    assert.fail("expected FrigoraError");
  } catch (error) {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code);
  }
}

describe("F3.0 structured catalogues", () => {
  it("canonicalises refrigerant codes for uniqueness", () => {
    assert.equal(canonicalizeRefrigerantCode("r404a"), "R404A");
    assert.equal(canonicalizeRefrigerantCode(" R404a "), "R404A");
  });

  it("creates and lists venture-scoped part and refrigerant references", async () => {
    const owner = await seed();
    const part = await owner.service.createPartReference(owner.scope, {
      displayName: "Filter drier",
      defaultQuantityUnit: "each",
    });
    const refrigerant = await owner.service.createRefrigerantReference(owner.scope, {
      canonicalCode: "r404a",
      displayName: "R404A common blend",
    });
    assert.equal(part.status, "active");
    assert.equal(refrigerant.canonicalCode, "R404A");
    assert.equal((await owner.service.listActivePartReferences(owner.scope)).length, 1);
    assert.equal((await owner.service.listActiveRefrigerantReferences(owner.scope)).length, 1);
  });

  it("rejects duplicate refrigerant canonical codes ignoring case", async () => {
    const owner = await seed();
    await owner.service.createRefrigerantReference(owner.scope, {
      canonicalCode: "R410A",
      displayName: "R410A",
    });
    await expectCode(
      () =>
        owner.service.createRefrigerantReference(owner.scope, {
          canonicalCode: "r410a",
          displayName: "dup",
        }),
      "duplicate",
    );
  });

  it("requires venture.update for catalogue mutation and allows member read of active list", async () => {
    const owner = await seed();
    const memberId = "user-member" as UserId;
    await addMember(owner.workspaceId, memberId);
    const memberScope = {
      userId: memberId,
      workspaceId: owner.workspaceId,
      ventureId: owner.ventureId,
    } satisfies FrigoraScope;
    await expectCode(
      () =>
        owner.service.createPartReference(memberScope, {
          displayName: "Denied",
          defaultQuantityUnit: "each",
        }),
      "forbidden",
    );
    const created = await owner.service.createPartReference(owner.scope, {
      displayName: "Allowed",
      defaultQuantityUnit: "each",
    });
    const listed = await owner.service.listActivePartReferences(memberScope);
    assert.equal(listed.some((row) => row.id === created.id), true);
  });

  it("records PartUsage with active reference and stamps snapshot", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const part = await owner.service.createPartReference(owner.scope, {
      displayName: "Schrader core",
      defaultQuantityUnit: "each",
    });
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partReferenceId: part.id,
      quantity: 2,
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(usage.partReferenceId, part.id);
    assert.equal(usage.partDescription, "Schrader core");
    assert.equal(usage.quantityUnit, "each");
    assert.equal("unitCost" in usage, false);
    assert.equal("warehouseId" in usage, false);
  });

  it("records unlisted PartUsage without reference", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: " improvised clamp ",
      quantity: 1,
      quantityUnit: "each",
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(usage.partReferenceId, null);
    assert.equal(usage.partDescription, "improvised clamp");
  });

  it("records RefrigerantEvent with reference snapshot and unlisted path", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const refrigerant = await owner.service.createRefrigerantReference(owner.scope, {
      canonicalCode: "R32",
      displayName: "R32",
    });
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const linked = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantReferenceId: refrigerant.id,
      eventKind: "added",
      quantityKg: 1.5,
      occurredAt: USED,
      handledByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(linked.refrigerantReferenceId, refrigerant.id);
    assert.equal(linked.refrigerantType, "R32");
    const unlisted = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "CustomBlend",
      eventKind: "recovered",
      quantityKg: 0.2,
      occurredAt: USED,
      handledByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(unlisted.refrigerantReferenceId, null);
    assert.equal(unlisted.refrigerantType, "CustomBlend");
  });

  it("preserves historical snapshots after rename and retirement", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const part = await owner.service.createPartReference(owner.scope, {
      displayName: "Original name",
      defaultQuantityUnit: "each",
    });
    const refrigerant = await owner.service.createRefrigerantReference(owner.scope, {
      canonicalCode: "R407C",
      displayName: "R407C",
    });
    const { visit, asset } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partReferenceId: part.id,
      quantity: 1,
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
      assetId: asset.id,
    });
    const event = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantReferenceId: refrigerant.id,
      eventKind: "added",
      quantityKg: 1,
      occurredAt: USED,
      handledByUserId: engineerId,
      recordedByUserId: engineerId,
      assetId: asset.id,
    });
    await owner.service.updatePartReference(owner.scope, part.id, {
      displayName: "Renamed part",
    });
    await owner.service.retirePartReference(owner.scope, part.id);
    await owner.service.retireRefrigerantReference(owner.scope, refrigerant.id);
    const reloadedUsage = await owner.service.getPartUsage(owner.scope, usage.id);
    const reloadedEvent = await owner.service.getRefrigerantEvent(owner.scope, event.id);
    assert.equal(reloadedUsage?.partDescription, "Original name");
    assert.equal(reloadedEvent?.refrigerantType, "R407C");
    const activeParts = await owner.service.listActivePartReferences(owner.scope);
    assert.equal(activeParts.some((row) => row.id === part.id), false);
    const stillReadable = await owner.service.getPartReference(owner.scope, part.id);
    assert.equal(stillReadable?.status, "retired");
    const history = await owner.service.listAssetHistory(owner.scope, asset.id);
    const partEntry = history.find((entry) => entry.kind === "part_usage");
    const refrigerantEntry = history.find((entry) => entry.kind === "refrigerant");
    assert.ok(partEntry?.kind === "part_usage");
    assert.equal(partEntry.detail.partDescription, "Original name");
    assert.ok(refrigerantEntry?.kind === "refrigerant");
    assert.equal(refrigerantEntry.detail.refrigerantType, "R407C");
  });

  it("denies recording against retired references", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const part = await owner.service.createPartReference(owner.scope, {
      displayName: "Retired soon",
      defaultQuantityUnit: "each",
    });
    await owner.service.retirePartReference(owner.scope, part.id);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    await expectCode(
      () =>
        owner.service.recordPartUsage(owner.scope, visit.id, {
          partReferenceId: part.id,
          quantity: 1,
          usedAt: USED,
          usedByUserId: engineerId,
          recordedByUserId: engineerId,
        }),
      "invalid_input",
    );
  });

  it("keeps historical NULL-reference rows readable and isolates ventures", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const legacy = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: "Legacy free text",
      quantity: 1,
      quantityUnit: "each",
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(legacy.partReferenceId, null);
    const other = await seed({
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: "user-other" as UserId,
    });
    const otherParts = await other.service.listPartReferences(other.scope);
    assert.equal(otherParts.length, 0);
  });

  it("admits F3.1 T&M at frigora@0.20.0 and SCHEMA_GENERATION 26", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.20.0");
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /F3\.0 structured parts and refrigerant catalogues/,
    );
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /F3\.1 Time & Materials customer charge/,
    );
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /without inventory/,
    );
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /invoice|quote|VAT|payroll/,
    );
    const dbSource = readFileSync(
      join(process.cwd(), "src/platform/persistence/db.ts"),
      "utf8",
    );
    assert.match(dbSource, /SCHEMA_GENERATION = 26/);
  });

  it("preserves added ≠ leaked and rejects leaked kind", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    await expectCode(
      () =>
        owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
          refrigerantType: "R404A",
          eventKind: "leaked" as "added",
          quantityKg: 1,
          occurredAt: USED,
          handledByUserId: engineerId,
          recordedByUserId: engineerId,
        }),
      "invalid_kind",
    );
  });
});
