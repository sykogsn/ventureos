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
import {
  FRIGORA_ASSET_HISTORY_EVENT_KINDS,
  type FrigoraVisitCustomerAcknowledgement,
  type FrigoraScope,
} from "./types";

const NOW = "2026-08-28T00:00:00.000Z";
const ARRIVED = "2026-08-28T10:00:00.000Z";
const ACKNOWLEDGED = "2026-08-28T10:30:00.000Z";
const DEPARTED = "2026-08-28T11:00:00.000Z";
const BEFORE_ARRIVAL = "2026-08-28T09:00:00.000Z";
const AFTER_DEPARTURE = "2026-08-28T12:00:00.000Z";
const EARLIER = "2026-08-28T10:20:00.000Z";
const LATER = "2026-08-28T10:40:00.000Z";

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
      definitionVersion: options.definitionVersion ?? "0.15.0",
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
    definitionVersion: "0.15.0",
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

function recordInput(
  overrides: Partial<{
    acknowledgementText: string;
    acknowledgerName: string;
    acknowledgedAt: string;
    recordedByUserId: UserId;
  }> = {},
) {
  return {
    acknowledgementText:
      overrides.acknowledgementText ??
      "Acknowledged technician reported evaporator icing and temporary cooling restored.",
    acknowledgerName: overrides.acknowledgerName ?? "Site Manager Naledi",
    acknowledgedAt: overrides.acknowledgedAt ?? ACKNOWLEDGED,
    recordedByUserId: overrides.recordedByUserId ?? ("user-attendee" as UserId),
  };
}

function assertExactShape(row: FrigoraVisitCustomerAcknowledgement) {
  assert.equal(typeof row.id, "string");
  assert.equal(typeof row.workspaceId, "string");
  assert.equal(typeof row.ventureId, "string");
  assert.equal(typeof row.visitId, "string");
  assert.equal(typeof row.workOrderId, "string");
  assert.equal(typeof row.acknowledgementText, "string");
  assert.equal(typeof row.acknowledgerName, "string");
  assert.equal(typeof row.acknowledgedAt, "string");
  assert.equal(typeof row.recordedByUserId, "string");
  assert.equal(typeof row.createdAt, "string");
  assert.equal(typeof row.updatedAt, "string");
  assert.equal("assetId" in row, false);
  assert.equal("signature" in row, false);
  assert.equal("evidenceId" in row, false);
  assert.equal("approved" in row, false);
  assert.equal("satisfactionScore" in row, false);
  assert.equal("invoiceApproved" in row, false);
  assert.equal("followUpRequired" in row, false);
}

describe("Frigora visit customer acknowledgement (F0.15)", () => {
  it("records acknowledgement with exact shape and rejects invalid text/name/time", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const row = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput(),
    );
    assertExactShape(row);
    assert.equal(row.visitId, visit.id);
    assert.equal(row.workOrderId, workOrder.id);
    assert.equal(row.acknowledgerName, "Site Manager Naledi");
    assert.equal(row.recordedByUserId, attendeeId);
    assert.equal(row.updatedAt, row.createdAt);

    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          owner.scope,
          visit.id,
          recordInput({ acknowledgementText: "   " }),
        ),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          owner.scope,
          visit.id,
          recordInput({ acknowledgementText: "x".repeat(2001) }),
        ),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          owner.scope,
          visit.id,
          recordInput({ acknowledgerName: "\t  " }),
        ),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          owner.scope,
          visit.id,
          recordInput({ acknowledgedAt: "not-a-timestamp" }),
        ),
      "invalid_input",
    );
    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          owner.scope,
          visit.id,
          recordInput({ acknowledgedAt: BEFORE_ARRIVAL }),
        ),
      "invalid_input",
    );
  });

  it("allows open and departed visits, rejects cancelled and unknown visits", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const openAck = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput({ acknowledgedAt: ACKNOWLEDGED }),
    );
    assert.equal(openAck.visitId, visit.id);

    await owner.service.recordVisitDeparture(owner.scope, visit.id, { departedAt: DEPARTED });
    const afterDepart = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput({
        acknowledgementText: "Acknowledged findings by phone after technician left site.",
        acknowledgerName: "Duty Manager Thabo",
        acknowledgedAt: AFTER_DEPARTURE,
      }),
    );
    assert.equal(afterDepart.acknowledgedAt, AFTER_DEPARTURE);

    await owner.service.closeWorkOrder(owner.scope, workOrder.id);
    const afterClose = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput({
        acknowledgementText: "Delayed office acknowledgement after work order closed.",
        acknowledgerName: "Ops Lead Mira",
        acknowledgedAt: "2026-08-28T13:00:00.000Z",
      }),
    );
    assert.equal(afterClose.workOrderId, workOrder.id);

    await owner.service.reopenWorkOrder(owner.scope, workOrder.id);
    const cancelTarget = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
      userId: attendeeId,
      arrivedAt: "2026-08-28T14:00:00.000Z",
    });
    await owner.service.cancelVisit(owner.scope, cancelTarget.id);
    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          owner.scope,
          cancelTarget.id,
          recordInput({ acknowledgedAt: "2026-08-28T14:30:00.000Z" }),
        ),
      "invalid_status",
    );

    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          owner.scope,
          "visit-missing" as never,
          recordInput(),
        ),
      "not_found",
    );
  });

  it("does not require sibling facts and rejects non-member recorders", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const row = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput(),
    );
    assert.equal(await owner.service.getVisitOutcomeByVisit(owner.scope, visit.id), null);
    assert.deepEqual(await owner.service.listRecommendedActionsByVisit(owner.scope, visit.id), []);
    assert.equal(row.id.length > 0, true);

    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          owner.scope,
          visit.id,
          recordInput({ recordedByUserId: "user-stranger" as UserId }),
        ),
      "not_found",
    );
  });

  it("is append-only with multiple acknowledgements and deterministic ordering", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    const first = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput({
        acknowledgementText: "First acknowledgement of icing and temporary cooling.",
        acknowledgerName: "Manager A",
        acknowledgedAt: EARLIER,
      }),
    );
    const second = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput({
        acknowledgementText: "Second acknowledgement of recommended compressor work.",
        acknowledgerName: "Manager B",
        acknowledgedAt: LATER,
      }),
    );
    const tieA = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput({
        acknowledgementText: "Tie A",
        acknowledgerName: "Manager C",
        acknowledgedAt: "2026-08-28T10:50:00.000Z",
      }),
    );
    const tieB = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput({
        acknowledgementText: "Tie B",
        acknowledgerName: "Manager D",
        acknowledgedAt: "2026-08-28T10:50:00.000Z",
      }),
    );

    const loadedFirst = await owner.service.getVisitCustomerAcknowledgement(owner.scope, first.id);
    assert.equal(loadedFirst?.acknowledgementText, first.acknowledgementText);
    assert.equal(loadedFirst?.acknowledgerName, first.acknowledgerName);

    const byVisit = await owner.service.listVisitCustomerAcknowledgementsByVisit(
      owner.scope,
      visit.id,
    );
    assert.equal(byVisit.length, 4);
    for (let index = 1; index < byVisit.length; index += 1) {
      const previous = byVisit[index - 1]!;
      const next = byVisit[index]!;
      assert.ok(previous.acknowledgedAt <= next.acknowledgedAt);
      if (previous.acknowledgedAt === next.acknowledgedAt) {
        assert.ok(previous.id < next.id);
      }
    }
    assert.equal(byVisit[0]?.id, first.id);
    assert.equal(byVisit[1]?.id, second.id);
    const tied = [tieA.id, tieB.id].sort();
    assert.deepEqual(
      byVisit.slice(2).map((row) => row.id),
      tied,
    );

    const byWorkOrder = await owner.service.listVisitCustomerAcknowledgementsByWorkOrder(
      owner.scope,
      workOrder.id,
    );
    assert.equal(byWorkOrder.length, 4);
    assert.deepEqual(
      byWorkOrder.map((row) => row.id),
      byVisit.map((row) => row.id),
    );

    assert.equal("updateVisitCustomerAcknowledgement" in owner.service, false);
    assert.equal("deleteVisitCustomerAcknowledgement" in owner.service, false);
    assert.equal("archiveVisitCustomerAcknowledgement" in owner.service, false);
    assert.equal("approveVisitCustomerAcknowledgement" in owner.service, false);
    assert.equal("signVisitCustomerAcknowledgement" in owner.service, false);
    assert.equal("acceptVisitCustomerAcknowledgement" in owner.service, false);
    assert.equal("getCurrentVisitCustomerAcknowledgement" in owner.service, false);
  });

  it("preserves acknowledgedAt independently from createdAt for delayed recording", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    await owner.service.recordVisitDeparture(owner.scope, visit.id, { departedAt: DEPARTED });

    const delayed = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput({ acknowledgedAt: ACKNOWLEDGED }),
    );
    assert.equal(delayed.acknowledgedAt, ACKNOWLEDGED);
    assert.notEqual(delayed.createdAt, delayed.acknowledgedAt);
    assert.ok(delayed.createdAt >= delayed.acknowledgedAt || delayed.acknowledgedAt === ACKNOWLEDGED);
  });

  it("does not mutate siblings or create outcome / recommendation / operational condition", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, workOrder, asset } = await seedOpenVisit(
      owner.service,
      owner.scope,
      attendeeId,
    );
    const beforeVisit = await owner.service.getVisit(owner.scope, visit.id);
    const beforeWorkOrder = await owner.service.getWorkOrder(owner.scope, workOrder.id);
    const beforeAsset = await owner.service.getAsset(owner.scope, asset.id);

    await owner.service.recordVisitCustomerAcknowledgement(owner.scope, visit.id, recordInput());

    assert.deepEqual(await owner.service.getVisit(owner.scope, visit.id), beforeVisit);
    assert.deepEqual(await owner.service.getWorkOrder(owner.scope, workOrder.id), beforeWorkOrder);
    assert.deepEqual(await owner.service.getAsset(owner.scope, asset.id), beforeAsset);
    assert.equal(await owner.service.getVisitOutcomeByVisit(owner.scope, visit.id), null);
    assert.deepEqual(await owner.service.listRecommendedActionsByVisit(owner.scope, visit.id), []);
    assert.deepEqual(
      await owner.service.listAssetOperationalConditionsByAsset(owner.scope, asset.id),
      [],
    );
  });

  it("enforces authorization and tenant isolation", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    const memberId = "user-member" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    await addMember(owner.workspaceId, memberId);
    const { visit, workOrder } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const row = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput(),
    );

    await expectCode(
      () =>
        owner.service.recordVisitCustomerAcknowledgement(
          { ...owner.scope, userId: "user-outsider" as UserId },
          visit.id,
          recordInput(),
        ),
      "forbidden",
    );

    const memberListed = await owner.service.listVisitCustomerAcknowledgementsByVisit(
      { ...owner.scope, userId: memberId },
      visit.id,
    );
    assert.equal(memberListed[0]?.id, row.id);

    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "other-frigora",
      }),
    );
    assert.deepEqual(
      await owner.service.listVisitCustomerAcknowledgementsByVisit(
        { ...owner.scope, ventureId: otherVenture },
        visit.id,
      ),
      [],
    );
    assert.equal(
      await owner.service.getVisitCustomerAcknowledgement(
        { ...owner.scope, ventureId: otherVenture },
        row.id,
      ),
      null,
    );
    assert.deepEqual(
      await owner.service.listVisitCustomerAcknowledgementsByWorkOrder(
        { ...owner.scope, ventureId: otherVenture },
        workOrder.id,
      ),
      [],
    );

    const outsider = await seed({
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-cross" as VentureId,
      userId: "user-other" as UserId,
    });
    assert.deepEqual(
      await outsider.service.listVisitCustomerAcknowledgementsByVisit(outsider.scope, visit.id),
      [],
    );

    const nonFrigora = await seed({
      ventureId: "ven-company" as VentureId,
      definitionId: "ventureos.company",
      definitionVersion: "1.0.0",
    });
    await expectCode(
      () =>
        nonFrigora.service.recordVisitCustomerAcknowledgement(
          nonFrigora.scope,
          visit.id,
          recordInput({ recordedByUserId: nonFrigora.userId }),
        ),
      "not_frigora",
    );
  });

  it("persists through restart and keeps SCHEMA_GENERATION at 21", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const row = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput(),
    );
    await ensureSchema();
    const loaded = await owner.service.getVisitCustomerAcknowledgement(owner.scope, row.id);
    assert.equal(loaded?.id, row.id);
    assert.equal(loaded?.acknowledgementText, row.acknowledgementText);

    const dbPath = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));
    const schemaPath = fileURLToPath(
      new URL("../../platform/persistence/schema.ts", import.meta.url),
    );
    assert.match(readFileSync(dbPath, "utf8"), /SCHEMA_GENERATION = 21/);
    assert.match(readFileSync(schemaPath, "utf8"), /frigora_visit_customer_acknowledgements/);
    assert.equal(readFileSync(schemaPath, "utf8").includes("frigora_asset_history"), false);
  });

  it("admits frigora@0.15.0 and remains compatible with persisted 0.14.0", async () => {
    const frigora = platformVentureRegistry.resolve("frigora");
    assert.equal(frigora.version, "0.15.0");
    assert.match(frigora.description, /Visit customer acknowledgement/i);
    assert.match(frigora.description, /evidence/);
    assert.match(frigora.description, /employee agents/);

    const owner = await seed({ definitionVersion: "0.14.0" });
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit } = await seedOpenVisit(owner.service, owner.scope, attendeeId);
    const row = await owner.service.recordVisitCustomerAcknowledgement(
      owner.scope,
      visit.id,
      recordInput(),
    );
    assert.equal(row.visitId, visit.id);
  });

  it("does not modify AssetHistory kinds or project acknowledgement via primary asset", async () => {
    const owner = await seed();
    const attendeeId = "user-attendee" as UserId;
    await addMember(owner.workspaceId, attendeeId);
    const { visit, asset } = await seedOpenVisit(owner.service, owner.scope, attendeeId);

    assert.deepEqual([...FRIGORA_ASSET_HISTORY_EVENT_KINDS], [
      "reported_intake",
      "visit_arrival",
      "visit_departure",
      "observed",
      "finding",
      "corrective_action",
      "part_usage",
      "refrigerant",
      "outcome",
      "recommendation",
      "operational_condition",
    ]);
    assert.equal(FRIGORA_ASSET_HISTORY_EVENT_KINDS.includes("customer_acknowledgement" as never), false);

    const before = await owner.service.listAssetHistory(owner.scope, asset.id);
    await owner.service.recordVisitCustomerAcknowledgement(owner.scope, visit.id, recordInput());
    const after = await owner.service.listAssetHistory(owner.scope, asset.id);
    assert.deepEqual(after, before);
    assert.equal(
      after.some((entry) => (entry.kind as string) === "customer_acknowledgement"),
      false,
    );
  });

  it("exposes no evidence signature workflow commercial AI hierarchy leak surfaces", async () => {
    const owner = await seed();
    assert.equal("recordSignature" in owner.service, false);
    assert.equal("attachEvidence" in owner.service, false);
    assert.equal("createFollowUpRequirement" in owner.service, false);
    assert.equal("recordRefrigerantLeak" in owner.service, false);
    assert.equal("createRefrigerationSystem" in owner.service, false);
    assert.equal("scoreCustomerSatisfaction" in owner.service, false);
    assert.match(
      platformVentureRegistry.resolve("frigora").description,
      /REFRIGERANT|refrigerant events/i,
    );
  });
});
