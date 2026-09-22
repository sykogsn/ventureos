import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import {
  formatZarCents,
  labourChargeCents,
  roundChargeCents,
} from "./time-materials";
import type { FrigoraScope } from "./types";

const NOW = "2026-09-10T00:00:00.000Z";
const ARRIVED = "2026-09-10T10:00:00.000Z";
const USED = "2026-09-10T10:30:00.000Z";
const DEPARTED = "2026-09-10T11:00:00.000Z";

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
    name: "Frigora F3.1",
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
      goal: "Admit time and materials customer charge.",
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
    definitionVersion: input.definitionVersion ?? "0.21.0",
    lifecycle: "operating",
  };
}

async function seed(options: {
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
} = {}) {
  const workspaceId = (options.workspaceId ?? "ws-f31") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-f31") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const store = getPersistence();
  if (!(await store.organisations.findById(workspaceId))) {
    await store.organisations.insert({
      id: workspaceId,
      name: "F3.1 Workspace",
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
    code: "C-F31",
    displayName: "Customer",
  });
  const site = await service.createSite(scope, {
    customerId: customer.id,
    code: "S-F31",
    name: "Site",
  });
  const asset = await service.createAsset(scope, {
    siteId: site.id,
    tag: "A-F31",
    name: "Asset",
    assetKind: "cold_room",
    refrigerantType: "R404A",
  });
  const workOrder = await service.createWorkOrder(scope, {
    siteId: site.id,
    primaryAssetId: asset.id,
    workReference: "WO-F31-1",
    workKind: "reactive",
    reportedCondition: "Warm",
  });
  const assigned = await service.assignWorkOrder(scope, workOrder.id, {
    userId: attendingUserId,
    expectedUpdatedAt: workOrder.updatedAt,
  });
  const visit = await service.recordVisitArrival(scope, assigned.id, {
    userId: attendingUserId,
    arrivedAt: ARRIVED,
  });
  return { customer, site, asset, workOrder: assigned, visit };
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

describe("F3.1 time & materials charge helpers", () => {
  it("formats ZAR cents for display", () => {
    assert.equal(formatZarCents(0), "R 0.00");
    assert.equal(formatZarCents(100), "R 1.00");
    assert.equal(formatZarCents(12550), "R 125.50");
    assert.equal(formatZarCents(1), "R 0.01");
  });

  it("rounds quantity × rate to deterministic non-negative cents", () => {
    assert.equal(roundChargeCents(2, 12550), 25100);
    assert.equal(roundChargeCents(1.5, 100), 150);
    assert.equal(roundChargeCents(0.333, 100), 33);
    assert.equal(roundChargeCents(0.666, 100), 67);
    assert.throws(() => roundChargeCents(-1, 100), RangeError);
    assert.throws(() => roundChargeCents(1, -1), RangeError);
  });

  it("computes labour charge from duration and hourly rate boundary cases", () => {
    assert.equal(labourChargeCents(3600, 45000), 45000);
    assert.equal(labourChargeCents(1800, 45000), 22500);
    assert.equal(labourChargeCents(1, 3600), 1);
    assert.equal(labourChargeCents(1, 1), 0);
    assert.equal(labourChargeCents(3599, 3600), 3599);
    assert.throws(() => labourChargeCents(-1, 100), RangeError);
    assert.throws(() => labourChargeCents(1, -1), RangeError);
  });
});

describe("F3.1 time & materials customer charge", () => {
  it("denies member commercial rate and T&M summary APIs", async () => {
    const owner = await seed();
    const memberId = "user-member" as UserId;
    await addMember(owner.workspaceId, memberId);
    const memberScope = {
      userId: memberId,
      workspaceId: owner.workspaceId,
      ventureId: owner.ventureId,
    } satisfies FrigoraScope;
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: "clamp",
      quantity: 1,
      quantityUnit: "each",
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });

    await expectCode(
      () =>
        owner.service.setVentureLabourHourlyCharge(memberScope, {
          labourHourlyChargeCents: 45000,
        }),
      "forbidden",
    );
    await expectCode(
      () =>
        owner.service.setPartUsageUnitCharge(memberScope, usage.id, {
          unitChargeCents: 1000,
        }),
      "forbidden",
    );
    await expectCode(
      () => owner.service.getWorkOrderTimeMaterials(memberScope, workOrder.id),
      "forbidden",
    );
  });

  it("allows owner to configure labour rate and read T&M summary", async () => {
    const owner = await seed();
    const settings = await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 45000,
    });
    assert.equal(settings.labourHourlyChargeCents, 45000);
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const summary = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(summary.completeness, "complete");
    assert.equal(summary.totalCents, 45000);
    assert.equal(summary.labourCents, 45000);
  });

  it("snapshots PartReference defaultUnitChargeCents onto structured PartUsage", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const part = await owner.service.createPartReference(owner.scope, {
      displayName: "Filter drier",
      defaultQuantityUnit: "each",
      defaultUnitChargeCents: 12550,
    });
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partReferenceId: part.id,
      quantity: 2,
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(usage.unitChargeCents, 12550);
    assert.equal(usage.partDescription, "Filter drier");
  });

  it("treats unlisted PartUsage with null unitChargeCents as incomplete", async () => {
    const owner = await seed();
    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 45000,
    });
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: "improvised clamp",
      quantity: 1,
      quantityUnit: "each",
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(usage.unitChargeCents, null);
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const summary = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(summary.completeness, "incomplete");
    assert.equal(summary.totalCents, null);
    assert.ok(summary.unpriced.some((item) => item.kind === "part" && item.evidenceId === usage.id));
  });

  it("snapshots added refrigerant charge and treats recovered as R0 without blocking complete", async () => {
    const owner = await seed();
    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 36000,
    });
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const refrigerant = await owner.service.createRefrigerantReference(owner.scope, {
      canonicalCode: "R404A",
      displayName: "R404A",
      defaultChargePerKgCents: 85000,
    });
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const added = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantReferenceId: refrigerant.id,
      eventKind: "added",
      quantityKg: 2,
      occurredAt: USED,
      handledByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(added.chargePerKgCents, 85000);
    const recovered = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantType: "R404A",
      eventKind: "recovered",
      quantityKg: 1.5,
      occurredAt: USED,
      handledByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(recovered.chargePerKgCents, null);
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const summary = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(summary.completeness, "complete");
    assert.equal(summary.refrigerantCents, 170000);
    const recoveredLine = summary.refrigerantLines.find(
      (line) => line.refrigerantEventId === recovered.id,
    );
    assert.ok(recoveredLine);
    assert.equal(recoveredLine.amountCents, 0);
    assert.equal(recoveredLine.chargeable, false);
    assert.equal(recoveredLine.priced, true);
    assert.equal(summary.totalCents, 36000 + 170000);
  });

  it("snapshots venture labour rate on departure; missing rate is incomplete not silent zero", async () => {
    const owner = await seed();
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    assert.equal(visit.labourHourlyChargeCents, null);
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    assert.equal(departed.labourHourlyChargeCents, null);
    const incomplete = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(incomplete.completeness, "incomplete");
    assert.equal(incomplete.totalCents, null);
    assert.equal(incomplete.labourCents, 0);
    assert.ok(
      incomplete.unpriced.some((item) => item.kind === "labour" && item.evidenceId === visit.id),
    );

    const priced = await seed({
      workspaceId: "ws-f31-priced" as WorkspaceId,
      ventureId: "ven-f31-priced" as VentureId,
      userId: "user-owner-priced" as UserId,
    });
    await priced.service.setVentureLabourHourlyCharge(priced.scope, {
      labourHourlyChargeCents: 45000,
    });
    const engineer2 = "user-engineer-2" as UserId;
    await addMember(priced.workspaceId, engineer2);
    const seeded = await seedOpenVisit(priced.service, priced.scope, engineer2);
    const departedPriced = await priced.service.recordVisitDeparture(priced.scope, seeded.visit.id, {
      departedAt: DEPARTED,
    });
    assert.equal(departedPriced.labourHourlyChargeCents, 45000);
  });

  it("does not rewrite historical snapshots when defaults change", async () => {
    const owner = await seed();
    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 40000,
    });
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const part = await owner.service.createPartReference(owner.scope, {
      displayName: "Core",
      defaultQuantityUnit: "each",
      defaultUnitChargeCents: 1000,
    });
    const refrigerant = await owner.service.createRefrigerantReference(owner.scope, {
      canonicalCode: "R410A",
      displayName: "R410A",
      defaultChargePerKgCents: 50000,
    });
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partReferenceId: part.id,
      quantity: 1,
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    const added = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantReferenceId: refrigerant.id,
      eventKind: "added",
      quantityKg: 1,
      occurredAt: USED,
      handledByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    assert.equal(departed.labourHourlyChargeCents, 40000);
    assert.equal(usage.unitChargeCents, 1000);
    assert.equal(added.chargePerKgCents, 50000);

    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 99000,
    });
    await owner.service.updatePartReference(owner.scope, part.id, {
      defaultUnitChargeCents: 9999,
    });
    await owner.service.updateRefrigerantReference(owner.scope, refrigerant.id, {
      defaultChargePerKgCents: 99999,
    });

    const reloadedVisit = await owner.service.getVisit(owner.scope, visit.id);
    const reloadedUsage = await owner.service.getPartUsage(owner.scope, usage.id);
    const reloadedEvent = await owner.service.getRefrigerantEvent(owner.scope, added.id);
    assert.equal(reloadedVisit?.labourHourlyChargeCents, 40000);
    assert.equal(reloadedUsage?.unitChargeCents, 1000);
    assert.equal(reloadedEvent?.chargePerKgCents, 50000);
  });

  it("lets venture.update replace a non-null PartUsage unit-charge snapshot without changing ops or catalogue", async () => {
    const owner = await seed();
    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 45000,
    });
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const part = await owner.service.createPartReference(owner.scope, {
      displayName: "Filter drier",
      defaultQuantityUnit: "each",
      defaultUnitChargeCents: 12550,
    });
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partReferenceId: part.id,
      quantity: 2,
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(usage.unitChargeCents, 12550);
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });

    await owner.service.updatePartReference(owner.scope, part.id, {
      defaultUnitChargeCents: 15000,
    });
    const before = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(before.partsCents, 25100);
    assert.equal(before.totalCents, 45000 + 25100);

    const overridden = await owner.service.setPartUsageUnitCharge(owner.scope, usage.id, {
      unitChargeCents: 13000,
    });
    assert.equal(overridden.unitChargeCents, 13000);
    assert.equal(overridden.quantity, 2);
    assert.equal(overridden.partDescription, "Filter drier");
    assert.equal(overridden.partReferenceId, part.id);

    const catalogue = await owner.service.getPartReference(owner.scope, part.id);
    assert.equal(catalogue?.defaultUnitChargeCents, 15000);

    const after = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(after.partsCents, 26000);
    assert.equal(after.totalCents, 45000 + 26000);
    assert.equal((after.totalCents ?? 0) - (before.totalCents ?? 0), 900);
    assert.equal(after.completeness, "complete");
  });

  it("denies member replacement of a non-null PartUsage unit-charge snapshot", async () => {
    const owner = await seed();
    const memberId = "user-member" as UserId;
    await addMember(owner.workspaceId, memberId);
    const memberScope = {
      userId: memberId,
      workspaceId: owner.workspaceId,
      ventureId: owner.ventureId,
    } satisfies FrigoraScope;
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const part = await owner.service.createPartReference(owner.scope, {
      displayName: "Filter drier",
      defaultQuantityUnit: "each",
      defaultUnitChargeCents: 12550,
    });
    const { visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partReferenceId: part.id,
      quantity: 2,
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    await expectCode(
      () =>
        owner.service.setPartUsageUnitCharge(memberScope, usage.id, {
          unitChargeCents: 13000,
        }),
      "forbidden",
    );
    const reloaded = await owner.service.getPartUsage(owner.scope, usage.id);
    assert.equal(reloaded?.unitChargeCents, 12550);
  });

  it("lets venture.update override priced refrigerant and departed labour snapshots", async () => {
    const owner = await seed();
    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 40000,
    });
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const refrigerant = await owner.service.createRefrigerantReference(owner.scope, {
      canonicalCode: "R404A",
      displayName: "R404A charge",
      defaultChargePerKgCents: 50000,
    });
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const added = await owner.service.recordRefrigerantEvent(owner.scope, visit.id, {
      refrigerantReferenceId: refrigerant.id,
      eventKind: "added",
      quantityKg: 2,
      occurredAt: USED,
      handledByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    assert.equal(added.chargePerKgCents, 50000);
    const departed = await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    assert.equal(departed.labourHourlyChargeCents, 40000);

    const before = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(before.labourCents, 40000);
    assert.equal(before.refrigerantCents, 100000);

    const labourOverride = await owner.service.setVisitLabourHourlyCharge(
      owner.scope,
      visit.id,
      { labourHourlyChargeCents: 45000 },
    );
    assert.equal(labourOverride.labourHourlyChargeCents, 45000);
    assert.equal(labourOverride.arrivedAt, ARRIVED);
    assert.equal(labourOverride.departedAt, DEPARTED);

    const refrOverride = await owner.service.setRefrigerantEventChargePerKg(
      owner.scope,
      added.id,
      { chargePerKgCents: 55000 },
    );
    assert.equal(refrOverride.chargePerKgCents, 55000);
    assert.equal(refrOverride.quantityKg, 2);
    assert.equal(refrOverride.eventKind, "added");

    const catalogue = await owner.service.getRefrigerantReference(owner.scope, refrigerant.id);
    assert.equal(catalogue?.defaultChargePerKgCents, 50000);
    const settings = await owner.service.getVentureCommercialSettings(owner.scope);
    assert.equal(settings?.labourHourlyChargeCents, 40000);

    const after = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(after.labourCents, 45000);
    assert.equal(after.refrigerantCents, 110000);
    assert.equal(after.totalCents, 45000 + 110000);
  });

  it("lets office setPartUsageUnitCharge complete an unlisted part line", async () => {
    const owner = await seed();
    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 36000,
    });
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    const usage = await owner.service.recordPartUsage(owner.scope, visit.id, {
      partDescription: "unlisted gasket",
      quantity: 3,
      quantityUnit: "each",
      usedAt: USED,
      usedByUserId: engineerId,
      recordedByUserId: engineerId,
    });
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const before = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(before.completeness, "incomplete");

    const priced = await owner.service.setPartUsageUnitCharge(owner.scope, usage.id, {
      unitChargeCents: 250,
    });
    assert.equal(priced.unitChargeCents, 250);
    const after = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(after.completeness, "complete");
    assert.equal(after.partsCents, 750);
    assert.equal(after.totalCents, 36000 + 750);
    assert.ok(after.partLines.some((line) => line.partUsageId === usage.id && line.priced));
  });

  it("keeps WorkOrder OPEN when T&M becomes complete", async () => {
    const owner = await seed();
    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 45000,
    });
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const summary = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    assert.equal(summary.completeness, "complete");
    const loaded = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    assert.equal(loaded?.status, "open");
  });

  it("excludes inventory, invoice, quote, and VAT fields from T&M summary", async () => {
    const owner = await seed();
    await owner.service.setVentureLabourHourlyCharge(owner.scope, {
      labourHourlyChargeCents: 10000,
    });
    const engineerId = "user-engineer" as UserId;
    await addMember(owner.workspaceId, engineerId);
    const { workOrder, visit } = await seedOpenVisit(owner.service, owner.scope, engineerId);
    await owner.service.recordVisitDeparture(owner.scope, visit.id, {
      departedAt: DEPARTED,
    });
    const summary = await owner.service.getWorkOrderTimeMaterials(owner.scope, workOrder.id);
    const keys = Object.keys(summary);
    for (const banned of [
      "invoice",
      "invoiceId",
      "quote",
      "quotation",
      "vat",
      "vatCents",
      "tax",
      "inventory",
      "stock",
      "warehouseId",
      "payroll",
      "procurement",
    ]) {
      assert.equal(keys.includes(banned), false, banned);
    }
    assert.equal("invoice" in summary, false);
    assert.equal("vat" in summary, false);
    assert.equal("inventory" in summary, false);
    assert.equal("quote" in summary, false);
  });

  it("admits F3.1 T&M at frigora@0.21.0 and SCHEMA_GENERATION 26", () => {
    const frigora = platformVentureRegistry.resolve("frigora");
    assert.equal(frigora.version, "0.22.0");
    assert.match(frigora.description, /F3\.1/);
    assert.match(frigora.description, /ZAR cents|customer charge|Time & Materials/i);
    assert.match(frigora.description, /without inventory|inventory/);
    assert.match(frigora.description, /invoice|VAT|quote|payroll|procurement/i);
    const dbSource = readFileSync(
      join(process.cwd(), "src/platform/persistence/db.ts"),
      "utf8",
    );
    assert.match(dbSource, /SCHEMA_GENERATION = 29/);
  });
});
