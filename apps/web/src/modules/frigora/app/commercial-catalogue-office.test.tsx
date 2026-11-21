import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { ShellProvider } from "@/core/context/shell-context";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { buildVentureSurfaceLinks } from "@/modules/frigora/app/nav";
import {
  commercialItemCosts,
  parseCommercialItemFields,
  saveCommercialItem,
  saveCommercialItemCost,
  selectCommercialItemForOffice,
} from "@/modules/frigora/app/commercial-catalogue-office";
import type { FrigoraOpsContext } from "@/modules/frigora/app/context";
import { CommercialCatalogueScreen } from "@/modules/frigora/app/screens/commercial-catalogue-screen";
import { createCommercialCatalogue, type FrigoraCommercialItem } from "@/modules/frigora/commercial-catalogue";
import { closeFrigoraPersistenceAfterFile } from "@/modules/frigora/test-persistence-lifecycle";
import type { FrigoraScope } from "@/modules/frigora/types";

const NOW = "2026-11-10T08:00:00.000Z";
const WEB_ROOT = join(process.cwd(), "src");

closeFrigoraPersistenceAfterFile();

function ventureRow(id: VentureId, workspaceId: WorkspaceId, slug: string): PersistedVenture {
  return {
    id,
    workspaceId,
    name: "Frigora Commercial",
    slug,
    stage: "concept",
    href: `/ventures/${id}`,
    foundedAt: NOW,
    category: "Operations",
    owner: "founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Price the work honestly.",
      category: "Operations",
      stage: "Idea",
      goal: "Show the commercial catalogue.",
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
    definitionId: "frigora",
    definitionVersion: "0.22.0",
    lifecycle: "operating",
  };
}

async function seed() {
  const workspaceId = "ws-office-cat" as WorkspaceId;
  const ventureId = "ven-office-cat" as VentureId;
  const otherVentureId = "ven-office-cat-b" as VentureId;
  const store = getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "Office Catalogue",
    slug: "ws-office-cat",
    createdAt: NOW,
  });
  await store.ventures.insert(ventureRow(ventureId, workspaceId, "office-a"));
  await store.ventures.insert(ventureRow(otherVentureId, workspaceId, "office-b"));
  const catalogue = createCommercialCatalogue({
    permissions: createPermissionService(createDbMembershipStore()),
  });
  const bind = async (userId: UserId, role: Role, venture: VentureId) => {
    await store.memberships.setRole({ userId, workspaceId, role, createdAt: NOW });
    return { userId, workspaceId, ventureId: venture } satisfies FrigoraScope;
  };
  return {
    catalogue,
    owner: await bind("user-owner" as UserId, "owner", ventureId),
    admin: await bind("user-admin" as UserId, "admin", ventureId),
    member: await bind("user-member" as UserId, "member", ventureId),
    other: await bind("user-owner" as UserId, "owner", otherVentureId),
  };
}

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

function itemBody(overrides: Record<string, string> = {}) {
  return form({
    sku: "COMP-100",
    description: "Scroll compressor",
    category: "Compressors",
    manufacturer: "Copeland",
    model: "ZR72",
    unit: "each",
    sellingPrice: "1000.00",
    taxTreatment: "not_registered",
    supplierReference: "SUP-1",
    status: "active",
    ...overrides,
  });
}

function screenItem(overrides: Partial<FrigoraCommercialItem> = {}): FrigoraCommercialItem {
  return {
    id: "item-1",
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: "ven-1" as VentureId,
    sku: "COMP-100",
    description: "Scroll compressor",
    category: "Compressors",
    manufacturer: "Copeland",
    model: "ZR72",
    unit: "each",
    sellingPriceMinor: 100000,
    currency: "ZAR",
    taxTreatment: "not_registered",
    supplierReference: "SUP-1",
    status: "active",
    createdAt: NOW,
    createdByUserId: "user-owner" as UserId,
    updatedAt: NOW,
    updatedByUserId: "user-owner" as UserId,
    ...overrides,
  };
}

function ctx(canWrite: boolean): FrigoraOpsContext {
  return {
    sessionUserId: "user-1",
    workspaceId: "ws-1" as WorkspaceId,
    ventureId: "ven-1" as VentureId,
    venture: {
      id: "ven-1" as VentureId,
      workspaceId: "ws-1" as WorkspaceId,
      name: "Frigora Cold",
      slug: "frigora-cold",
      definitionId: "frigora",
    },
    canWrite,
  };
}

function markup(node: ReactNode) {
  return renderToStaticMarkup(
    <ShellProvider
      user={{ name: "Sonny", email: "sonny@example.com" }}
      workspaces={[{ id: "ws-1" as WorkspaceId, name: "Workspace", slug: "workspace" }]}
      ventures={[ctx(false).venture]}
      initialWorkspaceId={"ws-1" as WorkspaceId}
    >
      {node}
    </ShellProvider>,
  );
}

const emptyFilters = {
  sku: "",
  description: "",
  manufacturer: "",
  model: "",
  category: "",
  status: "",
};

describe("Frigora office commercial catalogue", () => {
  beforeEach(async () => {
    await resetPersistenceLifecycle();
    await ensureSchema();
  });

  it("adds Commercial Catalogue only to the Frigora office navigation", () => {
    const frigora = buildVentureSurfaceLinks({
      ventureId: "ven-1",
      slug: "frigora-one",
      definitionId: "frigora",
      companyHomeHref: "/ventures/hq/frigora-one",
      canAccessOffice: true,
    });
    const link = frigora.find((item) => item.label === "Commercial Catalogue");
    assert.equal(link?.href, "/ventures/ven-1/commercial-catalogue");
    assert.equal(link?.href.startsWith("/ventures/ven-1/catalogue"), false);
    assert.equal(link?.match, "prefix");
    const company = buildVentureSurfaceLinks({
      ventureId: "ven-2",
      slug: "acme",
      definitionId: "ventureos.company",
      companyHomeHref: "/ventures/hq/acme",
    });
    assert.equal(company.some((item) => item.label === "Commercial Catalogue"), false);
    assert.equal(
      existsSync(join(WEB_ROOT, "app/(app)/ventures/[ventureId]/commercial-catalogue/page.tsx")),
      true,
    );
    const page = readFileSync(join(WEB_ROOT, "app/(app)/ventures/[ventureId]/commercial-catalogue/page.tsx"), "utf8");
    assert.match(page, /permission: "venture.commercial_cost.read"/);
    assert.match(page, /canReadCost \? await commercialItemCosts/);
    assert.equal(page.includes("ensureFrigoraStockSchemaReady"), false);
    assert.match(readFileSync(join(WEB_ROOT, "app/(app)/ventures/[ventureId]/commercial-catalogue/loading.tsx"), "utf8"), /Loading commercial catalogue/);
  });

  it("lists selling fields, filters, and protects discontinued selection in the screen", () => {
    const active = screenItem();
    const discontinued = screenItem({
      id: "item-2",
      sku: "VALVE-2",
      description: "Service valve",
      status: "discontinued",
      sellingPriceMinor: 20000,
    });
    const html = markup(
      <CommercialCatalogueScreen
        ctx={ctx(true)}
        items={[active, discontinued]}
        filters={{ ...emptyFilters, sku: "COMP" }}
        canReadCost={false}
        canUpdateCost={false}
        costs={null}
      />,
    );
    assert.match(html, /COMP-100/);
    assert.match(html, /Scroll compressor/);
    assert.match(html, /Compressors/);
    assert.match(html, /Copeland/);
    assert.match(html, /ZR72/);
    assert.match(html, /R 1000\.00/);
    assert.match(html, /Not registered/);
    assert.match(html, /Discontinued/);
    assert.match(html, /Use on a new quotation/);
    assert.match(html, /Not available for a new quotation/);
    assert.equal(html.includes("Purchase cost"), false);
    assert.equal(html.includes("gross profit"), false);
    assert.equal(html.includes("margin"), false);
    assert.match(html, /name="sku"[^>]*value="COMP"|value="COMP"/);
    const empty = markup(
      <CommercialCatalogueScreen
        ctx={ctx(false)}
        items={[]}
        filters={emptyFilters}
        error="Catalogue could not be loaded."
        canReadCost={false}
        canUpdateCost={false}
        costs={null}
      />,
    );
    assert.match(empty, /role="alert"/);
    assert.match(empty, /No commercial items/);
    assert.equal(empty.includes("Add commercial item"), false);
  });

  it("shows an unavailable purchase cost to the owner and hides it from an administrator", () => {
    const item = screenItem();
    const owner = markup(
      <CommercialCatalogueScreen
        ctx={ctx(true)}
        items={[item]}
        filters={emptyFilters}
        canReadCost
        canUpdateCost
        costs={{ [item.id]: null }}
      />,
    );
    assert.match(owner, /Purchase cost/);
    assert.match(owner, /Unavailable/);
    assert.equal(owner.includes("R 0.00"), false);
    assert.equal(owner.includes("margin"), false);
    const admin = markup(
      <CommercialCatalogueScreen
        ctx={ctx(true)}
        items={[item]}
        filters={emptyFilters}
        canReadCost={false}
        canUpdateCost={false}
        costs={{ [item.id]: 45500 }}
      />,
    );
    assert.match(admin, /Selling price/);
    assert.equal(admin.includes("Purchase cost"), false);
    assert.equal(admin.includes("455.00"), false);
    assert.equal(admin.includes("Save purchase cost"), false);
  });

  it("creates, edits, and rejects a duplicate SKU without rewriting creation identity", async () => {
    const { catalogue, owner, admin, other } = await seed();
    const money = parseCommercialItemFields({
      sku: "COMP-100",
      description: "Scroll compressor",
      category: "Compressors",
      manufacturer: "Copeland",
      model: "ZR72",
      unit: "each",
      sellingPrice: "1000.50",
      taxTreatment: "not_registered",
      supplierReference: "SUP-1",
      status: "active",
    });
    assert.equal(money.ok && money.sellingPriceMinor, 100050);
    const created = await saveCommercialItem(catalogue, owner, itemBody({ sellingPrice: "1000.50" }));
    assert.equal(created.item?.sellingPriceMinor, 100050);
    assert.equal(created.item?.createdByUserId, owner.userId);
    const edited = await saveCommercialItem(
      catalogue,
      admin,
      itemBody({ id: created.item?.id ?? "", sellingPrice: "1250.00", description: "Scroll compressor revised" }),
    );
    assert.equal(edited.item?.description, "Scroll compressor revised");
    assert.equal(edited.item?.sellingPriceMinor, 125000);
    assert.equal(edited.item?.createdAt, created.item?.createdAt);
    assert.equal(edited.item?.createdByUserId, owner.userId);
    assert.equal(edited.item?.updatedByUserId, admin.userId);
    const duplicate = await saveCommercialItem(catalogue, owner, itemBody({ sku: "comp-100", description: "Copy" }));
    assert.match(duplicate.error ?? "", /SKU already exists/);
    const crossed = await saveCommercialItem(
      catalogue,
      other,
      itemBody({ id: created.item?.id ?? "", sellingPrice: "1.00" }),
    );
    assert.match(crossed.error ?? "", /not found/i);
    const kept = await catalogue.getItem(owner, created.item?.id ?? "");
    assert.equal(kept.sellingPriceMinor, 125000);
  });

  it("filters the catalogue and refuses discontinued selection", async () => {
    const { catalogue, owner } = await seed();
    const compressor = await saveCommercialItem(catalogue, owner, itemBody());
    await saveCommercialItem(catalogue, owner, itemBody({
      sku: "VALVE-2",
      description: "Service valve",
      category: "Valves",
      manufacturer: "Danfoss",
      model: "EVR-10",
      sellingPrice: "200.00",
    }));
    await catalogue.updateItem(owner, compressor.item?.id ?? "", { status: "discontinued" });
    const bySku = await catalogue.listItems(owner, { sku: "valve" });
    assert.deepEqual(bySku.map((item) => item.sku), ["VALVE-2"]);
    const byDescription = await catalogue.listItems(owner, { description: "scroll" });
    assert.deepEqual(byDescription.map((item) => item.sku), ["COMP-100"]);
    const byManufacturer = await catalogue.listItems(owner, { manufacturer: "copeland" });
    assert.deepEqual(byManufacturer.map((item) => item.sku), ["COMP-100"]);
    const byModel = await catalogue.listItems(owner, { model: "evr-10" });
    assert.deepEqual(byModel.map((item) => item.sku), ["VALVE-2"]);
    const discontinued = await catalogue.listItems(owner, { status: "discontinued" });
    assert.deepEqual(discontinued.map((item) => item.sku), ["COMP-100"]);
    const active = await catalogue.listItems(owner, { status: "active", category: "Valves" });
    assert.deepEqual(active.map((item) => item.sku), ["VALVE-2"]);
    const selected = await selectCommercialItemForOffice(catalogue, owner, discontinued[0]?.id ?? "");
    assert.match(selected.error ?? "", /cannot be selected/);
    const readable = await catalogue.getItem(owner, discontinued[0]?.id ?? "");
    assert.equal(readable.status, "discontinued");
  });

  it("records owner cost, refuses administrator and member cost writes, and leaves a missing cost null", async () => {
    const { catalogue, owner, admin, member } = await seed();
    const created = await saveCommercialItem(catalogue, owner, itemBody());
    const id = created.item?.id ?? "";
    let reads = 0;
    const guarded = {
      ...catalogue,
      readItemCost: async (...args: Parameters<typeof catalogue.readItemCost>) => {
        reads += 1;
        return catalogue.readItemCost(...args);
      },
    };
    assert.equal(await commercialItemCosts(guarded, member, [created.item!], false), null);
    assert.equal(reads, 0);
    const missing = await commercialItemCosts(catalogue, owner, [created.item!], true);
    assert.deepEqual(missing, { [id]: null });
    const adminWrite = await saveCommercialItemCost(catalogue, admin, form({ id, purchaseCost: "455.00" }));
    assert.match(adminWrite.error ?? "", /Not allowed/);
    const memberWrite = await saveCommercialItemCost(catalogue, member, form({ id, purchaseCost: "455.00" }));
    assert.match(memberWrite.error ?? "", /Not allowed/);
    const blank = await saveCommercialItemCost(catalogue, owner, form({ id, purchaseCost: " " }));
    assert.match(blank.error ?? "", /not zero/);
    const saved = await saveCommercialItemCost(catalogue, owner, form({ id, purchaseCost: "455.00" }));
    assert.equal(saved.error, undefined);
    const loaded = await commercialItemCosts(catalogue, owner, [created.item!], true);
    assert.deepEqual(loaded, { [id]: 45500 });
    const selling = await catalogue.getItem(admin, id);
    assert.equal("purchaseCostMinor" in selling, false);
    await assert.rejects(() => catalogue.getItem(member, id));
    const rows = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_commercial_item_costs");
    assert.equal(Number(rows.rows[0]?.n), 1);
  });

  it("initialises the catalogue explicitly and still leaves stock off core startup", async () => {
    const names = async (like: string) => {
      const rows = await getClient().execute({
        sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ? ORDER BY name",
        args: [like],
      });
      return rows.rows.map((row) => String(row.name));
    };
    assert.deepEqual(await names("frigora_stock_%"), []);
    assert.deepEqual(await names("frigora_commercial_%"), []);
    const { catalogue, owner } = await seed();
    await catalogue.listItems(owner, {});
    assert.deepEqual(await names("frigora_commercial_%"), [
      "frigora_commercial_item_costs",
      "frigora_commercial_items",
    ]);
    assert.deepEqual(await names("frigora_stock_%"), []);
    const source = readFileSync(join(WEB_ROOT, "platform/persistence/db.ts"), "utf8");
    assert.match(source, /const SCHEMA_GENERATION = 40/);
    assert.doesNotMatch(source, /SCHEMA_GENERATION = 41/);
    const metadata = readFileSync(join(WEB_ROOT, "platform/persistence/schema.ts"), "utf8");
    assert.match(metadata, /export const frigoraCommercialItems/);
    assert.match(metadata, /export const frigoraCommercialItemCosts/);
  });
});
