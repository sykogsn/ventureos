import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import * as engineerCalendar from "@/modules/frigora/app/engineer-calendar";
import { mapToFieldSafeOfflinePayload } from "@/modules/frigora/app/offline/field-safe-mapper";
import * as operationalDerivations from "@/modules/frigora/app/operational-derivations";
import { FrigoraError } from "@/modules/frigora/errors";
import * as errors from "@/modules/frigora/errors";
import { exampleQuotationCommercial } from "@/modules/frigora/quotation-commercial";
import { createFrigoraService, createScope } from "@/modules/frigora/service";
import { closeFrigoraPersistenceAfterFile } from "@/modules/frigora/test-persistence-lifecycle";
import type {
  FrigoraPartUsage,
  FrigoraRefrigerantEvent,
  FrigoraScope,
  FrigoraVisit,
} from "@/modules/frigora/types";
import * as validation from "@/modules/frigora/validation";
import type { loadWorkOrderDetail as LoadWorkOrderDetail } from "@/modules/frigora/app/views";

const NOW = "2026-11-23T08:00:00.000Z";
const ARRIVED = "2026-11-23T09:00:00.000Z";
const USED = "2026-11-23T09:30:00.000Z";
const DEPARTED = "2026-11-23T10:00:00.000Z";
const RECOMMENDED_AT = "2026-11-23T09:40:00.000Z";
const LABOUR_CENTS = 45000;
const PART_CENTS = 12550;
const GAS_CENTS = 85000;
const PART_OVERRIDE_CENTS = 13000;
const QUOTE_LABOUR_RATE = 100_000;

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

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
    lifecycle: "operating",
    definitionVersion: "0.16.0",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function addActor(workspaceId: WorkspaceId, userId: UserId, role: Role) {
  const store = getPersistence();
  await store.users.insert({
    id: userId,
    email: `${userId}@example.test`,
    name: userId,
    passwordHash: "hash",
    createdAt: NOW,
  });
  await store.memberships.setRole({ userId, workspaceId, role, createdAt: NOW });
}

async function seed() {
  const workspaceId = "ws-frigora" as WorkspaceId;
  const ventureId = "ven-frigora" as VentureId;
  const ownerId = "user-owner" as UserId;
  const adminId = "user-admin" as UserId;
  const engineerAId = "user-engineer-a" as UserId;
  const engineerBId = "user-engineer-b" as UserId;
  const store = getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "Frigora Workspace",
    slug: "ws-frigora",
    createdAt: NOW,
  });
  await store.ventures.insert(ventureRow({ id: ventureId, workspaceId }));
  await addActor(workspaceId, ownerId, "owner");
  await addActor(workspaceId, adminId, "admin");
  await addActor(workspaceId, engineerAId, "member");
  await addActor(workspaceId, engineerBId, "member");
  const service = createFrigoraService({
    permissions: createPermissionService(createDbMembershipStore()),
  });
  const scopeFor = (userId: UserId): FrigoraScope => ({ userId, workspaceId, ventureId });
  return {
    service,
    workspaceId,
    ventureId,
    owner: scopeFor(ownerId),
    admin: scopeFor(adminId),
    engineerA: scopeFor(engineerAId),
    engineerB: scopeFor(engineerBId),
    ownerId,
    adminId,
    engineerAId,
    engineerBId,
  };
}

type Seeded = Awaited<ReturnType<typeof seed>>;

async function pricedCatalogue(seeded: Seeded) {
  await seeded.service.setVentureLabourHourlyCharge(seeded.owner, {
    labourHourlyChargeCents: LABOUR_CENTS,
  });
  const part = await seeded.service.createPartReference(seeded.owner, {
    displayName: "Filter drier",
    defaultQuantityUnit: "each",
    defaultUnitChargeCents: PART_CENTS,
  });
  const refrigerant = await seeded.service.createRefrigerantReference(seeded.owner, {
    canonicalCode: "R410A",
    displayName: "R410A",
    defaultChargePerKgCents: GAS_CENTS,
  });
  return { part, refrigerant };
}

async function jobFor(seeded: Seeded, assignee: FrigoraScope, suffix: string) {
  const customer = await seeded.service.createCustomer(seeded.owner, {
    code: `CUST-${suffix}`,
    displayName: `Customer ${suffix}`,
    legalName: `Customer ${suffix} (Pty) Ltd`,
    notes: `Office note ${suffix}`,
  });
  const site = await seeded.service.createSite(seeded.owner, {
    customerId: customer.id,
    code: `SITE-${suffix}`,
    name: `Site ${suffix}`,
    addressLine1: `${suffix} High Street`,
    notes: `Site office note ${suffix}`,
  });
  const asset = await seeded.service.createAsset(seeded.owner, {
    siteId: site.id,
    tag: `ASSET-${suffix}`,
    name: `Asset ${suffix}`,
    notes: `Asset office note ${suffix}`,
  });
  const created = await seeded.service.createWorkOrder(seeded.owner, {
    siteId: site.id,
    workReference: `WO-${suffix}`,
    workKind: "reactive",
    reportedCondition: `Reported ${suffix}`,
    primaryAssetId: asset.id,
  });
  const workOrder = await seeded.service.assignWorkOrder(seeded.owner, created.id, {
    expectedUpdatedAt: created.updatedAt,
    userId: assignee.userId,
  });
  return { customer, site, asset, workOrder };
}

function forbidden(error: unknown) {
  assert.ok(error instanceof FrigoraError);
  assert.equal(error.code, "forbidden");
  return true;
}

function assertHiddenCharges(value: unknown, amounts: number[]) {
  const serialized = JSON.stringify(value);
  for (const amount of amounts) {
    assert.equal(serialized.includes(String(amount)), false, `disclosed ${amount}`);
  }
}

function assertOperationalVisit(visit: FrigoraVisit | null) {
  assert.ok(visit);
  assert.equal(visit?.arrivedAt, ARRIVED);
  assert.equal(visit?.departedAt, DEPARTED);
  assert.equal(visit?.status, "departed");
  assert.equal(visit?.labourHourlyChargeCents, null);
}

function assertOperationalPart(usage: FrigoraPartUsage | null) {
  assert.ok(usage);
  assert.equal(usage?.partDescription, "Filter drier");
  assert.equal(usage?.quantity, 2);
  assert.equal(usage?.quantityUnit, "each");
  assert.equal(usage?.unitChargeCents, null);
}

function assertOperationalGas(event: FrigoraRefrigerantEvent | null) {
  assert.ok(event);
  assert.equal(event?.refrigerantType, "R410A");
  assert.equal(event?.eventKind, "added");
  assert.equal(event?.quantityKg, 1);
  assert.equal(event?.chargePerKgCents, null);
}

describe("Frigora field selling-charge projection", () => {
  it("keeps office commercial values and redacts them from member reads, lists, facts and mutations", async () => {
    const seeded = await seed();
    const { part, refrigerant } = await pricedCatalogue(seeded);
    const mine = await jobFor(seeded, seeded.engineerA, "A");
    const arrived = await seeded.service.recordVisitArrival(seeded.engineerA, mine.workOrder.id, {
      userId: seeded.engineerAId,
      arrivedAt: ARRIVED,
    });
    assert.equal(arrived.labourHourlyChargeCents, null);
    assert.equal(arrived.status, "open");

    const recordedPart = await seeded.service.recordPartUsage(seeded.engineerA, arrived.id, {
      partReferenceId: part.id,
      quantity: 2,
      usedAt: USED,
      usedByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
      assetId: mine.asset.id,
    });
    assertOperationalPart(recordedPart);
    const recordedGas = await seeded.service.recordRefrigerantEvent(seeded.engineerA, arrived.id, {
      refrigerantReferenceId: refrigerant.id,
      eventKind: "added",
      quantityKg: 1,
      occurredAt: USED,
      handledByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
      assetId: mine.asset.id,
    });
    assertOperationalGas(recordedGas);
    const departed = await seeded.service.recordVisitDeparture(seeded.engineerA, arrived.id, {
      departedAt: DEPARTED,
    });
    assertOperationalVisit(departed);
    assertHiddenCharges(
      { arrived, recordedPart, recordedGas, departed },
      [LABOUR_CENTS, PART_CENTS, GAS_CENTS],
    );

    for (const office of [seeded.owner, seeded.admin]) {
      assert.equal((await seeded.service.getVisit(office, arrived.id))?.labourHourlyChargeCents, LABOUR_CENTS);
      assert.equal((await seeded.service.getPartUsage(office, recordedPart.id))?.unitChargeCents, PART_CENTS);
      assert.equal(
        (await seeded.service.getRefrigerantEvent(office, recordedGas.id))?.chargePerKgCents,
        GAS_CENTS,
      );
      assert.equal(
        (await seeded.service.listVisitsByWorkOrder(office, mine.workOrder.id))[0]?.labourHourlyChargeCents,
        LABOUR_CENTS,
      );
      assert.equal(
        (await seeded.service.listPartUsagesByVisit(office, arrived.id))[0]?.unitChargeCents,
        PART_CENTS,
      );
      assert.equal(
        (await seeded.service.listRefrigerantEventsByAsset(office, mine.asset.id))[0]?.chargePerKgCents,
        GAS_CENTS,
      );
    }

    const settings = await seeded.service.getVentureCommercialSettings(seeded.owner);
    assert.equal(settings?.labourHourlyChargeCents, LABOUR_CENTS);
    await assert.rejects(
      () => seeded.service.getVentureCommercialSettings(seeded.engineerA),
      forbidden,
    );

    assertOperationalVisit(await seeded.service.getVisit(seeded.engineerA, arrived.id));
    assertOperationalPart(await seeded.service.getPartUsage(seeded.engineerA, recordedPart.id));
    assertOperationalGas(await seeded.service.getRefrigerantEvent(seeded.engineerA, recordedGas.id));
    assert.equal(
      (await seeded.service.listVisitsByWorkOrder(seeded.engineerA, mine.workOrder.id))[0]?.labourHourlyChargeCents,
      null,
    );
    assert.equal(
      (await seeded.service.listVisitsByAttendingUser(seeded.engineerA, seeded.engineerAId))[0]
        ?.labourHourlyChargeCents,
      null,
    );
    assert.equal(
      (await seeded.service.listPartUsagesByVisit(seeded.engineerA, arrived.id))[0]?.unitChargeCents,
      null,
    );
    assert.equal(
      (await seeded.service.listPartUsagesByWorkOrder(seeded.engineerA, mine.workOrder.id))[0]?.unitChargeCents,
      null,
    );
    assert.equal(
      (await seeded.service.listPartUsagesByAsset(seeded.engineerA, mine.asset.id))[0]?.unitChargeCents,
      null,
    );
    assert.equal(
      (await seeded.service.listRefrigerantEventsByVisit(seeded.engineerA, arrived.id))[0]?.chargePerKgCents,
      null,
    );
    assert.equal(
      (await seeded.service.listRefrigerantEventsByWorkOrder(seeded.engineerA, mine.workOrder.id))[0]
        ?.chargePerKgCents,
      null,
    );
    assert.equal(
      (await seeded.service.listRefrigerantEventsByAsset(seeded.engineerA, mine.asset.id))[0]?.chargePerKgCents,
      null,
    );
    assert.equal(await seeded.service.getVisit(seeded.engineerB, arrived.id), null);
    assert.equal(await seeded.service.getPartUsage(seeded.engineerB, recordedPart.id), null);
    assert.equal(await seeded.service.getRefrigerantEvent(seeded.engineerB, recordedGas.id), null);

    const recommendation = await seeded.service.recordRecommendedAction(seeded.owner, arrived.id, {
      description: "Replace filter",
      recommendedAt: RECOMMENDED_AT,
      recommendedByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
      assetId: mine.asset.id,
    });
    const quotation = await seeded.service.createQuotation(seeded.owner, {
      recommendedActionId: recommendation.id,
      description: "Replace filter",
      commercial: exampleQuotationCommercial(),
    });
    assert.equal((await seeded.service.getQuotation(seeded.owner, quotation.id))?.id, quotation.id);
    assert.equal(await seeded.service.getQuotation(seeded.engineerA, quotation.id), null);
    assert.deepEqual(await seeded.service.listQuotations(seeded.engineerA), []);
    assert.deepEqual(await seeded.service.getTaxPosture(seeded.engineerA), {
      rules: [],
      configurations: [],
      events: [],
    });
    assert.equal(
      (await seeded.service.listPartReferences(seeded.owner)).find((row) => row.id === part.id)
        ?.defaultUnitChargeCents,
      PART_CENTS,
    );
    assert.equal(
      (await seeded.service.getPartReference(seeded.engineerA, part.id))?.defaultUnitChargeCents,
      null,
    );
    assert.equal(
      (await seeded.service.listRefrigerantReferences(seeded.admin)).find((row) => row.id === refrigerant.id)
        ?.defaultChargePerKgCents,
      GAS_CENTS,
    );
    assert.equal(
      (await seeded.service.getRefrigerantReference(seeded.engineerA, refrigerant.id))?.defaultChargePerKgCents,
      null,
    );

    const actor = { id: seeded.engineerAId };
    const queries = loadQueries(() => actor.id, seeded.service);
    const actions = loadActions(() => actor.id, seeded.service);
    const views = loadViews(queries);
    const memberDetail = await views.loadWorkOrderDetail(
      { workspaceId: seeded.workspaceId, ventureId: seeded.ventureId },
      mine.workOrder.id,
    );
    assert.equal(memberDetail.error, undefined);
    const facts = memberDetail.view?.visitFacts[0];
    assert.ok(facts);
    assertOperationalVisit(facts?.visit ?? null);
    assertOperationalPart(facts?.partUsages[0] ?? null);
    assertOperationalGas(facts?.refrigerantEvents[0] ?? null);
    assert.equal(memberDetail.view?.timeMaterials, null);
    assert.equal(facts?.partUsages[0]?.quantity, 2);
    assertHiddenCharges(memberDetail.view, [LABOUR_CENTS, PART_CENTS, GAS_CENTS, QUOTE_LABOUR_RATE]);

    const blockedCommercial = await views.loadWorkOrderDetail(
      { workspaceId: seeded.workspaceId, ventureId: seeded.ventureId },
      mine.workOrder.id,
      { includeTimeMaterials: true },
    );
    assert.match(blockedCommercial.error ?? "", /Not allowed/);
    assert.equal(blockedCommercial.view, null);

    actor.id = seeded.ownerId;
    const officeDetail = await views.loadWorkOrderDetail(
      { workspaceId: seeded.workspaceId, ventureId: seeded.ventureId },
      mine.workOrder.id,
      { includeTimeMaterials: true },
    );
    assert.equal(officeDetail.error, undefined);
    assert.equal(officeDetail.view?.visitFacts[0]?.visit.labourHourlyChargeCents, LABOUR_CENTS);
    assert.equal(officeDetail.view?.visitFacts[0]?.partUsages[0]?.unitChargeCents, PART_CENTS);
    assert.equal(officeDetail.view?.visitFacts[0]?.refrigerantEvents[0]?.chargePerKgCents, GAS_CENTS);
    assert.equal(officeDetail.view?.timeMaterials?.labourCents, LABOUR_CENTS);
    assert.equal(officeDetail.view?.timeMaterials?.partsCents, PART_CENTS * 2);
    assert.equal(officeDetail.view?.timeMaterials?.refrigerantCents, GAS_CENTS);
    assert.equal(
      officeDetail.view?.timeMaterials?.knownSubtotalCents,
      LABOUR_CENTS + PART_CENTS * 2 + GAS_CENTS,
    );
    assert.equal(officeDetail.view?.timeMaterials?.completeness, "complete");

    actor.id = seeded.engineerAId;
    const actionResult = await actions.recordPartUsageAction({
      workspaceId: seeded.workspaceId,
      ventureId: seeded.ventureId,
      visitId: arrived.id,
      partReferenceId: part.id,
      quantity: 2,
      usedAt: USED,
      usedByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
      assetId: mine.asset.id,
    });
    assert.equal(actionResult.error, undefined);
    assert.equal(actionResult.record?.partDescription, "Filter drier");
    assert.equal(actionResult.record?.quantity, 2);
    assert.equal(actionResult.record?.unitChargeCents, null);
    assert.equal(
      (await seeded.service.getPartUsage(seeded.owner, actionResult.record!.id))?.unitChargeCents,
      PART_CENTS,
    );

    const overridden = await seeded.service.setPartUsageUnitCharge(seeded.owner, recordedPart.id, {
      unitChargeCents: PART_OVERRIDE_CENTS,
    });
    assert.equal(overridden.unitChargeCents, PART_OVERRIDE_CENTS);
    assert.equal(
      (await seeded.service.getPartUsage(seeded.engineerA, recordedPart.id))?.unitChargeCents,
      null,
    );
    assert.equal(
      (await seeded.service.getPartUsage(seeded.admin, recordedPart.id))?.unitChargeCents,
      PART_OVERRIDE_CENTS,
    );

    const offline = mapToFieldSafeOfflinePayload({
      visit: { ...departed },
      history: [
        { ...recordedPart },
        { ...recordedGas },
        {
          unitChargeCents: PART_CENTS,
          nested: { chargePerKgCents: GAS_CENTS, labourHourlyChargeCents: LABOUR_CENTS, ok: true },
        },
      ],
      partReferences: [{
        id: part.id,
        displayName: part.displayName,
        defaultQuantityUnit: part.defaultQuantityUnit,
        status: part.status,
        defaultUnitChargeCents: null,
      }],
      refrigerantReferences: [{
        id: refrigerant.id,
        canonicalCode: refrigerant.canonicalCode,
        displayName: refrigerant.displayName,
        status: refrigerant.status,
        defaultChargePerKgCents: null,
      }],
    });
    assert.equal(offline.visit?.id, departed.id);
    assert.equal(offline.visit?.labourHourlyChargeCents, undefined);
    assert.equal(
      (offline.history?.[0] as { partDescription?: string; unitChargeCents?: number }).partDescription,
      "Filter drier",
    );
    assert.equal(
      (offline.history?.[0] as { unitChargeCents?: number }).unitChargeCents,
      undefined,
    );
    assert.equal(
      (offline.history?.[2] as { nested?: { ok?: boolean; chargePerKgCents?: number } }).nested?.ok,
      true,
    );
    assert.equal(
      (offline.history?.[2] as { nested?: { chargePerKgCents?: number } }).nested?.chargePerKgCents,
      undefined,
    );
    assertHiddenCharges(offline, [LABOUR_CENTS, PART_CENTS, GAS_CENTS, PART_OVERRIDE_CENTS]);
    assert.equal(
      (await seeded.service.getVisit(seeded.owner, arrived.id))?.labourHourlyChargeCents,
      LABOUR_CENTS,
    );
  });

  it("keeps attended historical access after reassignment without selling charges", async () => {
    const seeded = await seed();
    const { part, refrigerant } = await pricedCatalogue(seeded);
    const mine = await jobFor(seeded, seeded.engineerA, "HIST");
    const visit = await seeded.service.recordVisitArrival(seeded.engineerA, mine.workOrder.id, {
      userId: seeded.engineerAId,
      arrivedAt: ARRIVED,
    });
    const usage = await seeded.service.recordPartUsage(seeded.engineerA, visit.id, {
      partReferenceId: part.id,
      quantity: 2,
      usedAt: USED,
      usedByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
    });
    const event = await seeded.service.recordRefrigerantEvent(seeded.engineerA, visit.id, {
      refrigerantReferenceId: refrigerant.id,
      eventKind: "added",
      quantityKg: 1,
      occurredAt: USED,
      handledByUserId: seeded.engineerAId,
      recordedByUserId: seeded.engineerAId,
    });
    await seeded.service.recordVisitDeparture(seeded.engineerA, visit.id, { departedAt: DEPARTED });
    const current = await seeded.service.getWorkOrder(seeded.owner, mine.workOrder.id);
    await seeded.service.assignWorkOrder(seeded.owner, mine.workOrder.id, {
      expectedUpdatedAt: current!.updatedAt,
      userId: seeded.engineerBId,
    });

    assertOperationalVisit(await seeded.service.getVisit(seeded.engineerA, visit.id));
    assertOperationalPart((await seeded.service.listPartUsagesByVisit(seeded.engineerA, visit.id))[0] ?? null);
    assertOperationalGas(
      (await seeded.service.listRefrigerantEventsByVisit(seeded.engineerA, visit.id))[0] ?? null,
    );
    assert.equal(
      (await seeded.service.listVisitsByAttendingUser(seeded.engineerA, seeded.engineerAId))[0]
        ?.labourHourlyChargeCents,
      null,
    );
    assert.equal(await seeded.service.getWorkOrder(seeded.engineerA, mine.workOrder.id), null);
    assert.deepEqual(await seeded.service.listVisitsByWorkOrder(seeded.engineerA, mine.workOrder.id), []);
    assertOperationalVisit(await seeded.service.getVisit(seeded.engineerB, visit.id));
    assert.equal((await seeded.service.getPartUsage(seeded.owner, usage.id))?.unitChargeCents, PART_CENTS);
    assert.equal(
      (await seeded.service.getRefrigerantEvent(seeded.admin, event.id))?.chargePerKgCents,
      GAS_CENTS,
    );
    await assert.rejects(
      () => seeded.service.recordVisitArrival(seeded.engineerA, mine.workOrder.id, {
        userId: seeded.engineerAId,
        arrivedAt: ARRIVED,
      }),
      forbidden,
    );
  });

  it("denies a former assignee who never attended and fails closed for revoked or foreign scope", async () => {
    const seeded = await seed();
    const { part } = await pricedCatalogue(seeded);
    const transferred = await jobFor(seeded, seeded.engineerA, "MOVE");
    const current = await seeded.service.getWorkOrder(seeded.owner, transferred.workOrder.id);
    await seeded.service.assignWorkOrder(seeded.owner, transferred.workOrder.id, {
      expectedUpdatedAt: current!.updatedAt,
      userId: seeded.engineerBId,
    });
    const visit = await seeded.service.recordVisitArrival(seeded.engineerB, transferred.workOrder.id, {
      userId: seeded.engineerBId,
      arrivedAt: ARRIVED,
    });
    const usage = await seeded.service.recordPartUsage(seeded.engineerB, visit.id, {
      partReferenceId: part.id,
      quantity: 2,
      usedAt: USED,
      usedByUserId: seeded.engineerBId,
      recordedByUserId: seeded.engineerBId,
    });
    await seeded.service.recordVisitDeparture(seeded.engineerB, visit.id, { departedAt: DEPARTED });

    assert.equal(await seeded.service.getWorkOrder(seeded.engineerA, transferred.workOrder.id), null);
    assert.equal(await seeded.service.getVisit(seeded.engineerA, visit.id), null);
    assert.equal(await seeded.service.getPartUsage(seeded.engineerA, usage.id), null);
    assert.deepEqual(await seeded.service.listPartUsagesByVisit(seeded.engineerA, visit.id), []);
    assert.deepEqual(
      await seeded.service.listVisitsByAttendingUser(seeded.engineerA, seeded.engineerAId),
      [],
    );
    assert.equal((await seeded.service.getVisit(seeded.owner, visit.id))?.labourHourlyChargeCents, LABOUR_CENTS);

    assert.equal(
      await seeded.service.getVisit(
        { ...seeded.engineerB, ventureId: "ven-other" as VentureId },
        visit.id,
      ),
      null,
    );
    await assert.rejects(
      () => seeded.service.getPartUsage(
        { ...seeded.engineerB, workspaceId: "ws-other" as WorkspaceId },
        usage.id,
      ),
      forbidden,
    );

    const removed = await getPersistence().memberships.removeMember({
      actorId: seeded.ownerId,
      workspaceId: seeded.workspaceId,
      userId: seeded.engineerBId,
      allow: () => true,
    });
    assert.equal(removed.status, "removed");
    await assert.rejects(
      () => seeded.service.getVisit(seeded.engineerB, visit.id),
      forbidden,
    );
    await assert.rejects(
      () => seeded.service.listPartUsagesByWorkOrder(seeded.engineerB, transferred.workOrder.id),
      forbidden,
    );
    assert.equal(
      (await seeded.service.getPartUsage(seeded.admin, usage.id))?.unitChargeCents,
      PART_CENTS,
    );
    assert.equal((await seeded.service.getVisit(seeded.owner, visit.id))?.id, visit.id);
  });
});

function loadQueries(actor: () => UserId, service: ReturnType<typeof createFrigoraService>) {
  return loadModule(join(process.cwd(), "src/modules/frigora/queries.ts"), {
    "@/lib/auth/session": { getSession: async () => ({ id: actor() }) },
    "./errors": errors,
    "./service": { createScope, getFrigoraService: () => service },
    "./validation": validation,
  }) as typeof import("../queries");
}

function loadActions(actor: () => UserId, service: ReturnType<typeof createFrigoraService>) {
  return loadModule(join(process.cwd(), "src/modules/frigora/actions.ts"), {
    "@/lib/auth/session": { getSession: async () => ({ id: actor() }) },
    "./errors": errors,
    "./service": { createScope, getFrigoraService: () => service },
    "./validation": validation,
  }) as typeof import("../actions");
}

function loadViews(queries: ReturnType<typeof loadQueries>) {
  return loadModule(join(process.cwd(), "src/modules/frigora/app/views.ts"), {
    "@/platform/persistence/repositories": { getPersistence },
    "@/modules/frigora/queries": queries,
    "@/modules/frigora/app/engineer-calendar": engineerCalendar,
    "@/modules/frigora/app/operational-derivations": operationalDerivations,
  }) as { loadWorkOrderDetail: typeof LoadWorkOrderDetail };
}

function loadModule(filename: string, imports: Record<string, unknown>) {
  const source = readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  const requireFixture = (name: string) => {
    assert.ok(name in imports, `Unexpected test import: ${name}`);
    return imports[name];
  };
  runInThisContext(`(function(require, exports) { ${compiled}\n})`, { filename })(requireFixture, exports);
  return exports;
}
