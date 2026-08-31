import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import {
  isFrigoraVenture,
  ventureMatchesActiveWorkspace,
} from "@/modules/frigora/app/context";
import { buildVentureSurfaceLinks } from "@/modules/frigora/app/nav";
import { createFrigoraService } from "@/modules/frigora/service";
import type { FrigoraScope } from "@/modules/frigora/types";
import { FrigoraError } from "@/modules/frigora/errors";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";

const NOW = "2026-08-29T00:00:00.000Z";
const WEB_ROOT = join(process.cwd(), "src");

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
    definitionVersion: "0.15.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function seed(options: {
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
  definitionId?: string;
} = {}) {
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
      definitionVersion: "0.15.0",
    }),
  );

  await store.users.insert({
    id: userId,
    email: `${userId}@example.test`,
    name: `Name ${userId}`,
    passwordHash: "hash",
    createdAt: NOW,
  });

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

describe("F1.1 Office Work Spine", () => {
  it("gates Frigora venture definition and active workspace matching", () => {
    assert.equal(isFrigoraVenture("frigora"), true);
    assert.equal(isFrigoraVenture("ventureos.company"), false);
    assert.equal(
      ventureMatchesActiveWorkspace(
        { workspaceId: "ws-a" as WorkspaceId },
        "ws-a",
      ),
      true,
    );
    assert.equal(
      ventureMatchesActiveWorkspace(
        { workspaceId: "ws-a" as WorkspaceId },
        "ws-b",
      ),
      false,
    );
    assert.equal(
      ventureMatchesActiveWorkspace({ workspaceId: "ws-a" as WorkspaceId }, null),
      false,
    );
  });

  it("adds Work and Customers only for frigora ventures in venture surface nav", () => {
    const frigora = buildVentureSurfaceLinks({
      ventureId: "ven-1",
      slug: "frigora-one",
      definitionId: "frigora",
      companyHomeHref: "/ventures/hq/frigora-one",
    });
    assert.deepEqual(
      frigora.map((link) => link.label),
      [
        "Company HQ",
        "Executive Office",
        "My Work",
        "Work",
        "Customers",
        "Documents",
        "CRM",
        "Finance",
      ],
    );

    const company = buildVentureSurfaceLinks({
      ventureId: "ven-2",
      slug: "acme",
      definitionId: "ventureos.company",
      companyHomeHref: "/ventures/hq/acme",
    });
    assert.equal(
      company.some((link) => link.label === "Work" || link.label === "Customers"),
      false,
    );
  });

  it("creates customer → site → asset → work order → self-assign → clear with persistence", async () => {
    const owner = await seed();
    const customer = await owner.service.createCustomer(owner.scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await owner.service.createSite(owner.scope, {
      customerId: customer.id,
      code: "SANDTON-N",
      name: "Sandton North",
    });
    const asset = await owner.service.createAsset(owner.scope, {
      siteId: site.id,
      tag: "CDU-01",
      name: "Condensing unit 1",
      assetKind: "condensing_unit",
    });
    const workOrder = await owner.service.createWorkOrder(owner.scope, {
      siteId: site.id,
      workReference: "WO-F11-1",
      workKind: "reactive",
      reportedCondition: "Walk-in not holding temperature",
      primaryAssetId: asset.id,
    });

    assert.equal(workOrder.reportedCondition, "Walk-in not holding temperature");
    assert.equal(workOrder.status, "open");
    assert.equal(workOrder.assignedUserId, null);

    const assigned = await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: owner.userId,
    });
    assert.equal(assigned.assignedUserId, owner.userId);

    const cleared = await owner.service.clearWorkOrderAssignment(
      owner.scope,
      workOrder.id,
    );
    assert.equal(cleared.assignedUserId, null);

    await ensureSchema();

    const customers = await owner.service.listCustomers(owner.scope);
    const sites = await owner.service.listSitesByCustomer(owner.scope, customer.id);
    const assets = await owner.service.listAssetsBySite(owner.scope, site.id);
    const orders = await owner.service.listWorkOrders(owner.scope);
    const visits = await owner.service.listVisitsByWorkOrder(owner.scope, workOrder.id);

    assert.equal(customers.some((row) => row.id === customer.id), true);
    assert.equal(sites.some((row) => row.id === site.id), true);
    assert.equal(assets.some((row) => row.id === asset.id), true);
    assert.equal(orders.some((row) => row.id === workOrder.id), true);
    assert.deepEqual(visits, []);
  });

  it("rejects writes for member role and allows reads", async () => {
    const owner = await seed({ userId: "user-owner" as UserId, role: "owner" });
    const customer = await owner.service.createCustomer(owner.scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });

    const memberId = "user-member" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    await getPersistence().users.insert({
      id: memberId,
      email: "member@example.test",
      name: "Member",
      passwordHash: "hash",
      createdAt: NOW,
    });

    const memberScope: FrigoraScope = {
      userId: memberId,
      workspaceId: owner.workspaceId,
      ventureId: owner.ventureId,
    };
    const listed = await owner.service.listCustomers(memberScope);
    assert.equal(listed.some((row) => row.id === customer.id), true);

    await assert.rejects(
      () =>
        owner.service.createCustomer(memberScope, {
          code: "OTHER",
          displayName: "Other",
        }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "forbidden");
        return true;
      },
    );
  });

  it("isolates venture data and rejects non-frigora writes", async () => {
    const frigora = await seed();
    await frigora.service.createCustomer(frigora.scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });

    const other = await seed({
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: "user-other" as UserId,
      definitionId: "frigora",
    });

    const otherCustomers = await other.service.listCustomers(other.scope);
    assert.equal(otherCustomers.length, 0);

    const company = await seed({
      workspaceId: "ws-company" as WorkspaceId,
      ventureId: "ven-company" as VentureId,
      userId: "user-company" as UserId,
      definitionId: "ventureos.company",
    });

    await assert.rejects(
      () =>
        company.service.createCustomer(company.scope, {
          code: "X",
          displayName: "Nope",
        }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "not_frigora");
        return true;
      },
    );
  });

  it("returns null for unknown customer and validates empty create inputs", async () => {
    const owner = await seed();
    const missing = await owner.service.getCustomer(
      owner.scope,
      "missing-customer" as never,
    );
    assert.equal(missing, null);

    await assert.rejects(
      () =>
        owner.service.createCustomer(owner.scope, {
          code: "  ",
          displayName: "FuelCo",
        }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "invalid_input");
        return true;
      },
    );
  });

  it("keeps F0 version and schema locks and ships F1.1 routes without F0 edits", () => {
    assert.equal(platformVentureRegistry.resolve("frigora").version, "0.15.0");

    const dbSource = readFileSync(join(WEB_ROOT, "platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 20/);

    const customersPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/customers/page.tsx"),
      "utf8",
    );
    const workPage = readFileSync(
      join(WEB_ROOT, "app/(app)/ventures/[ventureId]/work/page.tsx"),
      "utf8",
    );
    assert.match(customersPage, /requireFrigoraOpsContext/);
    assert.match(workPage, /requireFrigoraOpsContext/);
    assert.match(customersPage, /listCustomersQuery/);
    assert.equal(customersPage.includes("mock"), false);
    assert.equal(workPage.includes("fixture"), false);

    const mutationActions = readFileSync(
      join(WEB_ROOT, "modules/frigora/app/mutation-actions.ts"),
      "utf8",
    );
    assert.match(mutationActions, /userId: session\.id/);
    assert.equal(mutationActions.includes("technician"), false);
    assert.equal(mutationActions.includes("closeWorkOrder"), false);
  });
});
