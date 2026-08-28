import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createId } from "@/platform/ids";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import type { FrigoraCustomerId, FrigoraScope, FrigoraSiteId } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";

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
  slug?: string;
} = {}) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
  const workspaceId = (options.workspaceId ?? "ws-frigora") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-frigora") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const store = getPersistence();
  const existingWorkspace = await store.organisations.findById(workspaceId);
  if (!existingWorkspace) {
    await store.organisations.insert({
      id: workspaceId,
      name: "Frigora Workspace",
      slug: options.slug ?? `ws-${workspaceId}`,
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
      definitionVersion: options.definitionVersion ?? "0.2.0",
    }),
  );
  return {
    workspaceId,
    ventureId,
    userId,
    scope: {
      userId,
      workspaceId,
      ventureId,
    } satisfies FrigoraScope,
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
    definitionVersion: "0.2.0",
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

describe("Frigora operational domain", () => {
  it("round-trips Customer, Site, and Asset", async () => {
    const { scope, service } = await seed();
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
      assetKind: "display_freezer",
      designTargetCelsius: -18,
      refrigerantType: "R404A",
    });

    assert.equal((await service.getCustomer(scope, customer.id))?.displayName, "FuelCo");
    assert.equal((await service.listCustomers(scope)).length, 1);
    assert.equal((await service.getSite(scope, site.id))?.name, "Sandton North");
    assert.equal((await service.listSitesByCustomer(scope, customer.id)).length, 1);
    const loaded = await service.getAsset(scope, asset.id);
    assert.equal(loaded?.tag, "FZ-118");
    assert.equal((await service.listAssetsBySite(scope, site.id)).length, 1);
  });

  it("represents FuelCo / Sandton North / FZ-118 without work or evidence fields", async () => {
    const { scope, service } = await seed();
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
      assetKind: "display_freezer",
      designTargetCelsius: -18,
      refrigerantType: "R404A",
    });
    assert.equal(asset.designTargetCelsius, -18);
    assert.equal(asset.refrigerantType, "R404A");
    assert.equal(asset.assetKind, "display_freezer");
    assert.equal("workOrderId" in asset, false);
    assert.equal("currentTemperature" in asset, false);
    assert.equal("systemId" in asset, false);
    assert.equal("parentAssetId" in asset, false);
  });

  it("represents FuelCo / Rosebank / CR-031 without PPM objects", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const sandton = await service.createSite(scope, {
      customerId: customer.id,
      code: "SANDTON-N",
      name: "Sandton North",
    });
    const rosebank = await service.createSite(scope, {
      customerId: customer.id,
      code: "ROSEBANK",
      name: "Rosebank",
    });
    await service.createAsset(scope, {
      siteId: sandton.id,
      tag: "FZ-118",
      assetKind: "display_freezer",
      designTargetCelsius: -18,
      refrigerantType: "R404A",
    });
    const coldRoom = await service.createAsset(scope, {
      siteId: rosebank.id,
      tag: "CR-031",
      assetKind: "cold_room",
      designTargetCelsius: 2,
      refrigerantType: "R404A",
    });
    assert.equal(coldRoom.designTargetCelsius, 2);
    assert.equal(coldRoom.assetKind, "cold_room");
    assert.equal("ppmRequirementId" in coldRoom, false);
  });

  it("allows multiple assets on a site without a refrigeration system", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "SHOP",
      displayName: "Shop",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Supermarket",
    });
    await service.createAsset(scope, { siteId: site.id, tag: "CAB-1", assetKind: "cabinet" });
    await service.createAsset(scope, {
      siteId: site.id,
      tag: "CU-1",
      assetKind: "condensing_unit",
    });
    const listed = await service.listAssetsBySite(scope, site.id);
    assert.equal(listed.length, 2);
    assert.ok(listed.every((item) => !("systemId" in item)));
  });

  it("allows a standalone freezer without a fake system", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "CORNER",
      displayName: "Corner Shop",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "SHOP",
      name: "Small shop",
    });
    const freezer = await service.createAsset(scope, {
      siteId: site.id,
      tag: "FZ-1",
      assetKind: "display_freezer",
    });
    assert.equal(freezer.tag, "FZ-1");
  });

  it("rejects a new site under an archived customer", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    await service.archiveCustomer(scope, customer.id);
    await expectCode(
      () =>
        service.createSite(scope, {
          customerId: customer.id,
          code: "NEW",
          name: "New site",
        }),
      "archived_parent",
    );
  });

  it("rejects a new asset under an archived site", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    await service.archiveSite(scope, site.id);
    await expectCode(
      () => service.createAsset(scope, { siteId: site.id, tag: "FZ-1" }),
      "archived_parent",
    );
  });

  it("keeps a decommissioned asset readable", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    const asset = await service.createAsset(scope, { siteId: site.id, tag: "FZ-118" });
    const decommissioned = await service.decommissionAsset(scope, asset.id);
    assert.equal(decommissioned.status, "decommissioned");
    assert.equal((await service.getAsset(scope, asset.id))?.status, "decommissioned");
    const listed = await service.listAssetsBySite(scope, site.id);
    assert.equal(listed[0]?.status, "decommissioned");
  });

  it("moves an asset between active sites in the same venture", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const from = await service.createSite(scope, {
      customerId: customer.id,
      code: "A",
      name: "Site A",
    });
    const to = await service.createSite(scope, {
      customerId: customer.id,
      code: "B",
      name: "Site B",
    });
    const asset = await service.createAsset(scope, { siteId: from.id, tag: "FZ-118" });
    const moved = await service.updateAsset(scope, asset.id, { siteId: to.id });
    assert.equal(moved.siteId, to.id);
    assert.equal((await service.listAssetsBySite(scope, from.id)).length, 0);
    assert.equal((await service.listAssetsBySite(scope, to.id))[0]?.id, asset.id);
  });

  it("rejects a cross-venture asset move and site parent", async () => {
    const first = await seed();
    const second = await seed({
      reset: false,
      workspaceId: "ws-two" as WorkspaceId,
      ventureId: "ven-two" as VentureId,
      userId: first.userId,
      slug: "ws-two",
    });
    await getPersistence().memberships.setRole({
      userId: first.userId,
      workspaceId: second.workspaceId,
      role: "owner",
      createdAt: NOW,
    });
    const customerA = await first.service.createCustomer(first.scope, {
      code: "A",
      displayName: "Alpha",
    });
    const siteA = await first.service.createSite(first.scope, {
      customerId: customerA.id,
      code: "S",
      name: "Site A",
    });
    const asset = await first.service.createAsset(first.scope, {
      siteId: siteA.id,
      tag: "FZ-1",
    });
    const customerB = await first.service.createCustomer(second.scope, {
      code: "B",
      displayName: "Beta",
    });
    const siteB = await first.service.createSite(second.scope, {
      customerId: customerB.id,
      code: "T",
      name: "Site B",
    });
    await expectCode(
      () => first.service.updateAsset(first.scope, asset.id, { siteId: siteB.id }),
      "not_found",
    );
    await expectCode(
      () =>
        first.service.createSite(first.scope, {
          customerId: customerB.id,
          code: "X",
          name: "Stolen",
        }),
      "not_found",
    );
  });

  it("does not leak records across workspaces or guessed venture ids", async () => {
    const alpha = await seed();
    const customer = await alpha.service.createCustomer(alpha.scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const beta = await seed({
      reset: false,
      workspaceId: "ws-beta" as WorkspaceId,
      ventureId: "ven-beta" as VentureId,
      userId: "user-beta" as UserId,
      slug: "ws-beta",
    });
    assert.equal(await beta.service.getCustomer(beta.scope, customer.id), null);
    await expectCode(
      () =>
        beta.service.listCustomers({
          ...alpha.scope,
          userId: beta.userId,
        }),
      "forbidden",
    );
    assert.equal(
      await alpha.service.getCustomer(
        { ...alpha.scope, ventureId: "ven-guess" as VentureId },
        customer.id,
      ),
      null,
    );
    await expectCode(
      () =>
        alpha.service.createCustomer(
          { ...alpha.scope, ventureId: "ven-guess" as VentureId },
          { code: "X", displayName: "X" },
        ),
      "not_found",
    );
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: alpha.workspaceId,
        slug: "other-frigora",
        definitionId: "frigora",
        definitionVersion: "0.2.0",
      }),
    );
    assert.equal(
      await alpha.service.getCustomer(
        { ...alpha.scope, ventureId: otherVenture },
        customer.id,
      ),
      null,
    );
  });

  it("rejects Frigora records on a non-Frigora venture", async () => {
    const { scope, service } = await seed({ definitionId: "ventureos.company" });
    await expectCode(
      () => service.createCustomer(scope, { code: "X", displayName: "X" }),
      "not_frigora",
    );
  });

  it("enforces uniqueness boundaries", async () => {
    const { scope, service, workspaceId, userId } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    await expectCode(
      () => service.createCustomer(scope, { code: "FUELCO", displayName: "Copy" }),
      "duplicate",
    );
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    await expectCode(
      () =>
        service.createSite(scope, {
          customerId: customer.id,
          code: "MAIN",
          name: "Again",
        }),
      "duplicate",
    );
    await service.createAsset(scope, {
      siteId: site.id,
      tag: "FZ-118",
      serialNumber: "SN-1",
    });
    await expectCode(
      () => service.createAsset(scope, { siteId: site.id, tag: "FZ-118" }),
      "duplicate",
    );
    await expectCode(
      () =>
        service.createAsset(scope, {
          siteId: site.id,
          tag: "FZ-119",
          serialNumber: "SN-1",
        }),
      "duplicate",
    );
    const otherSite = await service.createSite(scope, {
      customerId: customer.id,
      code: "OTHER",
      name: "Other",
    });
    const sameTag = await service.createAsset(scope, {
      siteId: otherSite.id,
      tag: "FZ-118",
    });
    assert.equal(sameTag.tag, "FZ-118");

    const other = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId,
      slug: "ws-other-code",
    });
    await getPersistence().memberships.setRole({
      userId,
      workspaceId: other.workspaceId,
      role: "owner",
      createdAt: NOW,
    });
    const copy = await other.service.createCustomer(other.scope, {
      code: "FUELCO",
      displayName: "FuelCo Other",
    });
    assert.equal(copy.code, "FUELCO");
    assert.notEqual(copy.workspaceId, workspaceId);
  });

  it("rejects invalid asset kind, empty references, and invalid design targets", async () => {
    const { scope, service } = await seed();
    await expectCode(
      () => service.createCustomer(scope, { code: "  ", displayName: "X" }),
      "invalid_input",
    );
    const customer = await service.createCustomer(scope, {
      code: "C",
      displayName: "C",
    });
    await expectCode(
      () => service.createSite(scope, { customerId: customer.id, code: "", name: "N" }),
      "invalid_input",
    );
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "S",
      name: "S",
    });
    await expectCode(
      () =>
        service.createAsset(scope, {
          siteId: site.id,
          tag: "T",
          assetKind: "freezer" as never,
        }),
      "invalid_kind",
    );
    await expectCode(
      () =>
        service.createAsset(scope, {
          siteId: site.id,
          tag: "T2",
          designTargetCelsius: Number.NaN,
        }),
      "invalid_input",
    );
    await expectCode(
      () =>
        service.createAsset(scope, {
          siteId: site.id,
          tag: "T3",
          designTargetCelsius: Number.POSITIVE_INFINITY,
        }),
      "invalid_input",
    );
  });

  it("exposes no hard-delete store surface", async () => {
    const store = createFrigoraStore();
    assert.ok(!Object.keys(store).some((key) => /delete/i.test(key)));
  });

  it("does not mutate VIC snapshot fields when creating operational records", async () => {
    const { scope, service, ventureId } = await seed();
    const persistence = getPersistence();
    const before = await persistence.ventures.findById(ventureId);
    assert.ok(before);
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    await service.createAsset(scope, { siteId: site.id, tag: "FZ-118" });
    const after = await persistence.ventures.findById(ventureId);
    assert.deepEqual(after, before);
  });

  it("allows a persisted Frigora 0.1.0 instance because gating uses definition_id", async () => {
    const { scope, service } = await seed({ definitionVersion: "0.1.0" });
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    assert.equal(customer.code, "FUELCO");
  });

  it("allows members to read and not mutate", async () => {
    const owner = await seed();
    const memberId = "user-member" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const customer = await owner.service.createCustomer(owner.scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const memberScope: FrigoraScope = { ...owner.scope, userId: memberId };
    const listed = await owner.service.listCustomers(memberScope);
    assert.equal(listed[0]?.id, customer.id);
    await expectCode(
      () => owner.service.createCustomer(memberScope, { code: "X", displayName: "X" }),
      "forbidden",
    );
  });

  it("updates customer and site fields without changing tenancy", async () => {
    const { scope, service } = await seed();
    const customer = await service.createCustomer(scope, {
      code: "FUELCO",
      displayName: "FuelCo",
    });
    const renamed = await service.updateCustomer(scope, customer.id, {
      displayName: "FuelCo Holdings",
      legalName: "FuelCo Pty Ltd",
    });
    assert.equal(renamed.displayName, "FuelCo Holdings");
    assert.equal(renamed.workspaceId, scope.workspaceId);
    const site = await service.createSite(scope, {
      customerId: customer.id,
      code: "MAIN",
      name: "Main",
    });
    const updatedSite = await service.updateSite(scope, site.id, {
      name: "Main Campus",
      city: "Johannesburg",
    });
    assert.equal(updatedSite.name, "Main Campus");
    assert.equal(updatedSite.city, "Johannesburg");
    assert.equal(updatedSite.customerId, customer.id);
  });

  it("does not require a customer id from another workspace even if guessed", async () => {
    const alpha = await seed();
    const guessed = createId() as FrigoraCustomerId;
    await expectCode(
      () =>
        alpha.service.createSite(alpha.scope, {
          customerId: guessed,
          code: "X",
          name: "X",
        }),
      "not_found",
    );
    const guessedSite = createId() as FrigoraSiteId;
    await expectCode(
      () => alpha.service.createAsset(alpha.scope, { siteId: guessedSite, tag: "T" }),
      "not_found",
    );
  });
});
