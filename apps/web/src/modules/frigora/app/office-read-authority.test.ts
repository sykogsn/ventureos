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
import { mapToFieldSafeOfflinePayload } from "@/modules/frigora/app/offline/field-safe-mapper";
import { FrigoraError } from "@/modules/frigora/errors";
import { exampleQuotationCommercial } from "@/modules/frigora/quotation-commercial";
import { createFrigoraService, createScope } from "@/modules/frigora/service";
import { closeFrigoraPersistenceAfterFile } from "@/modules/frigora/test-persistence-lifecycle";
import type { FrigoraScope, FrigoraWorkOrderId } from "@/modules/frigora/types";
import * as errors from "@/modules/frigora/errors";
import * as validation from "@/modules/frigora/validation";

const NOW = "2026-11-21T08:00:00.000Z";
const ARRIVED = "2026-11-21T09:00:00.000Z";
const RECOMMENDED_AT = "2026-11-21T10:00:00.000Z";

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
    definitionVersion: "0.16.0",
    lifecycle: "operating",
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
  const store = getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "Frigora Workspace",
    slug: "ws-frigora",
    createdAt: NOW,
  });
  await store.ventures.insert(ventureRow({ id: ventureId, workspaceId }));
  await addActor(workspaceId, ownerId, "owner");
  const adminId = "user-admin" as UserId;
  const engineerAId = "user-engineer-a" as UserId;
  const engineerBId = "user-engineer-b" as UserId;
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

async function jobFor(
  seeded: Awaited<ReturnType<typeof seed>>,
  assignee: FrigoraScope,
  suffix: string,
) {
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

describe("Frigora office read authority", () => {
  it("keeps office reads for owner and admin and limits a field member to the assigned job", async () => {
    const seeded = await seed();
    const mine = await jobFor(seeded, seeded.engineerA, "A");
    const theirs = await jobFor(seeded, seeded.engineerB, "B");
    const contact = await seeded.service.createCustomerContact(seeded.owner, {
      customerId: mine.customer.id,
      siteId: mine.site.id,
      displayName: "Office Approver",
      email: "approver@customer.test",
    });
    const part = await seeded.service.createPartReference(seeded.owner, {
      displayName: "Filter drier",
      defaultQuantityUnit: "each",
      defaultUnitChargeCents: 12550,
    });
    const visit = await seeded.service.recordVisitArrival(seeded.owner, mine.workOrder.id, {
      userId: seeded.engineerAId,
      arrivedAt: ARRIVED,
    });
    const recommendation = await seeded.service.recordRecommendedAction(seeded.owner, visit.id, {
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

    const ownerCustomers = await seeded.service.listCustomers(seeded.owner);
    const adminCustomers = await seeded.service.listCustomers(seeded.admin);
    assert.equal(ownerCustomers.length, 2);
    assert.equal(adminCustomers.length, 2);
    assert.equal((await seeded.service.getCustomer(seeded.owner, mine.customer.id))?.notes, "Office note A");
    assert.equal((await seeded.service.getQuotation(seeded.admin, quotation.id))?.id, quotation.id);
    assert.equal((await seeded.service.getCustomerContact(seeded.owner, contact.id))?.email, "approver@customer.test");
    assert.equal((await seeded.service.listPartReferences(seeded.owner)).find((row) => row.id === part.id)?.defaultUnitChargeCents, 12550);

    assert.deepEqual(await seeded.service.listCustomers(seeded.engineerA), []);
    assert.deepEqual(await seeded.service.listSitesByCustomer(seeded.engineerA, mine.customer.id), []);
    assert.deepEqual(await seeded.service.listWorkOrders(seeded.engineerA), []);
    assert.equal(await seeded.service.getQuotation(seeded.engineerA, quotation.id), null);
    assert.deepEqual(await seeded.service.listQuotations(seeded.engineerA), []);
    assert.equal(await seeded.service.getCustomerContact(seeded.engineerA, contact.id), null);
    assert.equal(await seeded.service.getCustomer(seeded.engineerA, theirs.customer.id), null);
    assert.equal(await seeded.service.getWorkOrder(seeded.engineerA, theirs.workOrder.id), null);
    assert.equal(await seeded.service.getWorkOrderByReference(seeded.engineerA, theirs.workOrder.workReference), null);
    assert.deepEqual(
      await seeded.service.listWorkOrdersByAssignee(seeded.engineerA, seeded.engineerBId),
      [],
    );
    assert.deepEqual(
      await seeded.service.listVisitsByAttendingUser(seeded.engineerA, seeded.engineerBId),
      [],
    );

    const ownCustomer = await seeded.service.getCustomer(seeded.engineerA, mine.customer.id);
    const ownSite = await seeded.service.getSite(seeded.engineerA, mine.site.id);
    const ownAsset = await seeded.service.getAsset(seeded.engineerA, mine.asset.id);
    const ownWork = await seeded.service.getWorkOrder(seeded.engineerA, mine.workOrder.id);
    assert.equal(ownCustomer?.displayName, "Customer A");
    assert.equal(ownCustomer?.legalName, null);
    assert.equal(ownCustomer?.notes, null);
    assert.equal(ownSite?.addressLine1, "A High Street");
    assert.equal(ownSite?.notes, null);
    assert.equal(ownAsset?.tag, "ASSET-A");
    assert.equal(ownAsset?.notes, null);
    assert.equal(ownWork?.workReference, "WO-A");
    const ownJobs = await seeded.service.listWorkOrdersByAssignee(seeded.engineerA, seeded.engineerAId);
    assert.deepEqual(ownJobs.map((row) => row.id), [mine.workOrder.id]);
    const fieldParts = await seeded.service.listPartReferences(seeded.engineerA);
    assert.equal(fieldParts.find((row) => row.id === part.id)?.displayName, "Filter drier");
    assert.equal(fieldParts.find((row) => row.id === part.id)?.defaultUnitChargeCents, null);

    const offline = mapToFieldSafeOfflinePayload({
      customer: {
        displayName: ownCustomer?.displayName,
        legalName: ownCustomer?.legalName,
        notes: ownCustomer?.notes,
      },
      partReferences: [{
        id: part.id,
        displayName: "Filter drier",
        defaultQuantityUnit: "each",
        status: "active",
        defaultUnitChargeCents: 12550,
      }],
      history: [{ partDescription: "Filter", unitChargeCents: 12550 }],
    });
    assert.equal(offline.customer?.displayName, "Customer A");
    assert.equal(offline.customer?.legalName, null);
    assert.equal(offline.customer?.notes, null);
    assert.equal(
      (offline.partReferences?.[0] as { defaultUnitChargeCents?: number }).defaultUnitChargeCents,
      undefined,
    );
    assert.equal(
      (offline.history?.[0] as { unitChargeCents?: number }).unitChargeCents,
      undefined,
    );
  });

  it("rejects a wrong workspace and a revoked membership", async () => {
    const seeded = await seed();
    await jobFor(seeded, seeded.engineerA, "A");
    await assert.rejects(
      () => seeded.service.listCustomers({
        ...seeded.engineerA,
        workspaceId: "ws-other" as WorkspaceId,
      }),
      forbidden,
    );
    const removed = await getPersistence().memberships.removeMember({
      actorId: seeded.ownerId,
      workspaceId: seeded.workspaceId,
      userId: seeded.engineerAId,
      allow: () => true,
    });
    assert.equal(removed.status, "removed");
    await assert.rejects(() => seeded.service.listCustomers(seeded.engineerA), forbidden);
    await assert.rejects(
      () => seeded.service.getWorkOrder(seeded.engineerA, "missing" as FrigoraWorkOrderId),
      forbidden,
    );
  });

  it("denies a member server action for the customer directory without using a caller-supplied actor", async () => {
    const seeded = await seed();
    await jobFor(seeded, seeded.engineerA, "A");
    const queries = loadQueries(() => seeded.engineerAId, seeded.service);
    const listed = await queries.listCustomersQuery({
      workspaceId: seeded.workspaceId,
      ventureId: seeded.ventureId,
    });
    assert.equal(listed.error, undefined);
    assert.deepEqual(listed.record, []);
    const impersonated = await queries.listWorkOrdersByAssigneeQuery({
      workspaceId: seeded.workspaceId,
      ventureId: seeded.ventureId,
      userId: seeded.engineerBId,
    });
    assert.deepEqual(impersonated.record, []);
    const foreign = await queries.listCustomersQuery({
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: seeded.ventureId,
    });
    assert.match(foreign.error ?? "", /Not allowed/);
  });

  it("does not load work-create options when office authority is denied", async () => {
    let loads = 0;
    const page = loadWorkCreatePage(
      async () => {
        throw new Error("OFFICE_DENIED");
      },
      async () => {
        loads += 1;
        return { options: { customers: [{ id: "secret-customer" }] } };
      },
    );
    await assert.rejects(
      () => page({
        params: Promise.resolve({ ventureId: "ven-frigora" }),
        searchParams: Promise.resolve({}),
      }),
      /OFFICE_DENIED/,
    );
    assert.equal(loads, 0);
  });
});

function loadQueries(actor: () => UserId, service: ReturnType<typeof createFrigoraService>) {
  return loadModule(
    join(process.cwd(), "src/modules/frigora/queries.ts"),
    {
      "@/lib/auth/session": { getSession: async () => ({ id: actor() }) },
      "./errors": errors,
      "./service": { createScope, getFrigoraService: () => service },
      "./validation": validation,
    },
  ) as typeof import("../queries");
}

function loadWorkCreatePage(
  requireFrigoraOfficeContext: (ventureId: string) => Promise<unknown>,
  loadWorkCreateOptions: (scope: unknown) => Promise<unknown>,
) {
  const loaded = loadModule(
    join(process.cwd(), "src/app/(app)/ventures/[ventureId]/work/new/page.tsx"),
    {
      "@/modules/frigora/app/context": {
        requireFrigoraOfficeContext,
        frigoraScope: (ctx: unknown) => ctx,
      },
      "@/modules/frigora/app/views": { loadWorkCreateOptions },
      "@/modules/frigora/app/screens/work-screens": { WorkCreateScreen: () => null },
      "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    },
  );
  return loaded.default as (props: {
    params: Promise<{ ventureId: string }>;
    searchParams: Promise<Record<string, string | undefined>>;
  }) => Promise<unknown>;
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
