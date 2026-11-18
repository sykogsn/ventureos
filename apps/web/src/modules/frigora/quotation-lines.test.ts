import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { PermissionService, Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import {
  ensureFrigoraCommercialLinesSchema,
  ensureSchema,
  getClient,
} from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { createCommercialCatalogue } from "./commercial-catalogue";
import { FrigoraError } from "./errors";
import { setFrigoraWriteLockObserverForTests, withFrigoraWriteTransaction } from "./owned-write";
import { exampleQuotationCommercial, priceQuotationCommercial, quotationOfferHash } from "./quotation-commercial";
import {
  correctPersistedQuotation,
  createPersistedQuotation,
  issuePersistedQuotation,
  revisePersistedQuotation,
} from "./quotation-commands";
import { listQuotationLineSnapshots, offerLineFromSnapshot, prepareQuotationLineSnapshots } from "./quotation-lines";
import { createFrigoraService } from "./service";
import { createFrigoraStore, type FrigoraStore } from "./store";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraQuotationEventId, FrigoraQuotationId, FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const DB_SOURCE = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));
const LINES_SOURCE = fileURLToPath(new URL("./quotation-lines.ts", import.meta.url));
const COMMANDS_SOURCE = fileURLToPath(new URL("./quotation-commands.ts", import.meta.url));

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  setFrigoraWriteLockObserverForTests(undefined);
  await resetPersistenceLifecycle();
  await ensureSchema();
});

function ventureRow(overrides: Partial<PersistedVenture> = {}): PersistedVenture {
  return {
    id: "ven-lines" as VentureId,
    workspaceId: "ws-lines" as WorkspaceId,
    name: "Frigora Lines",
    slug: "frigora-lines",
    stage: "Idea",
    href: "/ventures/hq/frigora-lines",
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
    definitionVersion: "0.22.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

type Seed = {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  userId: UserId;
  store: FrigoraStore;
  scope: FrigoraScope;
  permissions: PermissionService;
};

async function seed(options: {
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
  store?: FrigoraStore;
  permissions?: PermissionService;
  reset?: boolean;
} = {}): Promise<Seed> {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
  const workspaceId = (options.workspaceId ?? "ws-lines") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-lines") as VentureId;
  const userId = (options.userId ?? "user-owner") as UserId;
  const persistence = getPersistence();
  if (!(await persistence.organisations.findById(workspaceId))) {
    await persistence.organisations.insert({
      id: workspaceId,
      name: "Frigora Workspace",
      slug: `ws-${workspaceId}`,
      createdAt: NOW,
    });
  }
  await persistence.memberships.setRole({
    userId,
    workspaceId,
    role: options.role ?? "owner",
    createdAt: NOW,
  });
  await persistence.ventures.insert(
    ventureRow({
      id: ventureId,
      workspaceId,
      slug: `venture-${ventureId}`,
    }),
  );
  const store = options.store ?? createFrigoraStore();
  const permissions = options.permissions ?? createPermissionService(createDbMembershipStore());
  const scope = { userId, workspaceId, ventureId } satisfies FrigoraScope;
  const service = createFrigoraService({ store, permissions });
  if ((options.role ?? "owner") === "owner") {
    await allowSyntheticNotRegisteredQuotationSend(service, scope);
  }
  return { workspaceId, ventureId, userId, store, scope, permissions };
}

async function seedRecommendation(owner: Seed, reference = "WO-1864") {
  const attendeeId = "user-attendee" as UserId;
  await getPersistence().memberships.setRole({
    userId: attendeeId,
    workspaceId: owner.workspaceId,
    role: "member",
    createdAt: NOW,
  });
  const service = createFrigoraService({ store: owner.store, permissions: owner.permissions });
  const customer = await service.createCustomer(owner.scope, {
    code: `FUEL-${reference}`,
    displayName: "FuelCo",
  });
  const site = await service.createSite(owner.scope, {
    customerId: customer.id,
    code: `SITE-${reference}`,
    name: "Sandton North",
  });
  const asset = await service.createAsset(owner.scope, {
    siteId: site.id,
    tag: `EVAP-${reference}`,
    name: "Evaporator",
  });
  const workOrder = await service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: reference,
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "display freezer warm",
  });
  const visit = await service.recordVisitArrival(owner.scope, workOrder.id, {
    userId: attendeeId,
    arrivedAt: ARRIVED,
  });
  const recommendation = await service.recordRecommendedAction(owner.scope, visit.id, {
    description: "Replace compressor",
    recommendedAt: RECOMMENDED_AT,
    recommendedByUserId: attendeeId,
    recordedByUserId: attendeeId,
    assetId: asset.id,
  });
  return recommendation;
}

function quoteInput(recommendationId: string, description = "Replace compressor") {
  return {
    recommendedActionId: recommendationId,
    description,
    commercial: exampleQuotationCommercial(),
  };
}

function customDraft(lineNumber: number, description = "Site gasket") {
  return {
    lineNumber,
    lineRole: "mandatory" as const,
    source: "custom" as const,
    description,
    unit: "each" as const,
    quantityMilli: lineNumber === 1 ? 0 : 2000,
    unitPriceMinor: 15000,
    taxTreatment: "not_registered" as const,
  };
}

async function tableNames(like: string) {
  const rows = await getClient().execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ? ORDER BY name",
    args: [like],
  });
  return rows.rows.map((row) => String(row.name));
}

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code);
    return true;
  });
}

describe("Frigora commercial quotation lines", () => {
  it("keeps commercial line initialisation separate from core startup and repeat-safe", async () => {
    const source = readFileSync(DB_SOURCE, "utf8");
    const ensureStart = source.indexOf("export async function ensureSchema");
    const nextExport = source.indexOf("export async function ensureFrigoraStockSchemaReady");
    const ensureBody = source.slice(ensureStart, nextExport);
    assert.equal(ensureBody.includes("ensureFrigoraCommercialLinesSchema"), false);
    assert.equal(ensureBody.includes("applyFrigoraCommercialLinesSchema"), false);
    assert.match(source, /const SCHEMA_GENERATION = 40;/);
    assert.deepEqual(await tableNames("frigora_quotation_line_snapshots"), []);
    assert.deepEqual(await tableNames("frigora_stock_%"), []);
    assert.deepEqual(await tableNames("frigora_commercial_items"), []);

    await ensureFrigoraCommercialLinesSchema();
    await ensureFrigoraCommercialLinesSchema();
    assert.deepEqual(await tableNames("frigora_quotation_line_snapshots"), [
      "frigora_quotation_line_snapshots",
    ]);
    assert.deepEqual(await tableNames("frigora_stock_%"), []);
    assert.deepEqual(await tableNames("frigora_commercial_items"), []);
    const indexes = await getClient().execute(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('frigora_quotation_versions_scope_uidx', 'frigora_quotation_line_snapshots_number_uidx') ORDER BY name",
    );
    assert.deepEqual(
      indexes.rows.map((row) => String(row.name)),
      ["frigora_quotation_line_snapshots_number_uidx", "frigora_quotation_versions_scope_uidx"],
    );
    const triggers = await getClient().execute(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'frigora_quotation_line_snapshots' ORDER BY name",
    );
    assert.deepEqual(
      triggers.rows.map((row) => String(row.name)),
      [
        "frigora_quotation_line_snapshots_delete_draft",
        "frigora_quotation_line_snapshots_delete_historical",
        "frigora_quotation_line_snapshots_identity_guard",
        "frigora_quotation_line_snapshots_identity_immutable",
        "frigora_quotation_line_snapshots_insert_current",
        "frigora_quotation_line_snapshots_insert_draft",
        "frigora_quotation_line_snapshots_reassign_blocked",
        "frigora_quotation_line_snapshots_update_draft",
        "frigora_quotation_line_snapshots_update_historical",
      ],
    );
    const headerTriggers = await getClient().execute(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'frigora_quotations_identity_immutable'",
    );
    assert.equal(headerTriggers.rows.length, 1);

    const owner = await seed({ reset: false });
    const recommendation = await seedRecommendation(owner);
    await createPersistedQuotation(owner.store, owner.scope, quoteInput(recommendation.id));
    await resetPersistenceLifecycle();
    await ensureSchema();
    assert.deepEqual(await tableNames("frigora_quotation_line_snapshots"), []);
  });

  it("rejects duplicate line numbers and keeps the header unwritten", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    await expectCode(
      () =>
        createPersistedQuotation(owner.store, owner.scope, quoteInput(recommendation.id), {
          permissions: owner.permissions,
          drafts: [customDraft(1, "First"), customDraft(1, "Second")],
        }),
      "duplicate",
    );
    const quotations = await getClient().execute("SELECT id FROM frigora_quotations");
    assert.equal(quotations.rows.length, 0);
    assert.deepEqual(await tableNames("frigora_quotation_line_snapshots"), []);
  });

  it("rejects cross-workspace and cross-venture line writes", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const catalogue = createCommercialCatalogue({ permissions: owner.permissions });
    const item = await catalogue.createItem(owner.scope, {
      sku: "COMP-100",
      description: "Scroll compressor",
      category: "Compressors",
      manufacturer: "Copeland",
      model: "ZR72",
      unit: "each",
      sellingPriceMinor: 100000,
      taxTreatment: "not_registered",
      supplierReference: "SUP-1",
    });
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [
          {
            lineNumber: 1,
            lineRole: "mandatory",
            source: "catalogue",
            catalogueItemId: item.id,
            quantityMilli: 1000,
          },
        ],
      },
    );
    const otherVenture = "ven-other" as VentureId;
    await getPersistence().ventures.insert(
      ventureRow({
        id: otherVenture,
        workspaceId: owner.workspaceId,
        slug: "venture-ven-other",
      }),
    );
    await expectCode(
      () =>
        prepareQuotationLineSnapshots({
          permissions: owner.permissions,
          scope: { ...owner.scope, ventureId: otherVenture },
          quotationId: quote.id,
          versionNumber: 1,
          drafts: [
            {
              lineNumber: 1,
              lineRole: "mandatory",
              source: "catalogue",
              catalogueItemId: item.id,
              quantityMilli: 1000,
            },
          ],
          actorUserId: owner.userId,
          createdAt: NOW,
        }),
      "not_found",
    );
    await expectCode(
      () =>
        prepareQuotationLineSnapshots({
          permissions: owner.permissions,
          scope: { ...owner.scope, workspaceId: "ws-other" as WorkspaceId },
          quotationId: quote.id,
          versionNumber: 1,
          drafts: [customDraft(2)],
          actorUserId: owner.userId,
          createdAt: NOW,
        }),
      "forbidden",
    );
    const ddl = await getClient().execute(
      "SELECT sql FROM sqlite_master WHERE name = 'frigora_quotation_line_snapshots'",
    );
    const tableSql = String(ddl.rows[0]?.sql);
    assert.match(tableSql, /FOREIGN KEY \(quotation_id, version_number, workspace_id, venture_id\)/);
    assert.match(
      tableSql,
      /REFERENCES frigora_quotation_versions \(quotation_id, version_number, workspace_id, venture_id\)/,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: `
              INSERT INTO frigora_quotation_line_snapshots (
                id, quotation_id, version_number, workspace_id, venture_id, line_number,
                source_type, catalogue_item_id, sku, description, unit, quantity_milli,
                unit_price_minor, currency, tax_treatment, line_role, discount_eligible,
                created_at, created_by_user_id
              ) VALUES ('line-wrong-ws', ?, 1, 'ws-other', ?, 2, 'custom', NULL, NULL,
                'Foreign line', 'each', 1000, 100, 'ZAR', 'not_registered', 'mandatory', 0, ?, ?)
            `,
            args: [quote.id, owner.ventureId, NOW, owner.userId],
          });
        }),
      /FOREIGN KEY|quotation lines can only be added to (?:a |the current )draft/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: `
              INSERT INTO frigora_quotation_line_snapshots (
                id, quotation_id, version_number, workspace_id, venture_id, line_number,
                source_type, catalogue_item_id, sku, description, unit, quantity_milli,
                unit_price_minor, currency, tax_treatment, line_role, discount_eligible,
                created_at, created_by_user_id
              ) VALUES ('line-wrong-ven', ?, 1, ?, ?, 2, 'custom', NULL, NULL,
                'Foreign venture', 'each', 1000, 100, 'ZAR', 'not_registered', 'mandatory', 0, ?, ?)
            `,
            args: [quote.id, owner.workspaceId, otherVenture, NOW, owner.userId],
          });
        }),
      /FOREIGN KEY|quotation lines can only be added to (?:a |the current )draft/i,
    );
    const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.workspaceId, owner.workspaceId);
    assert.equal(lines[0]?.ventureId, owner.ventureId);
  });

  it("snapshots catalogue selling fields and leaves custom lines outside the catalogue", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const catalogue = createCommercialCatalogue({ permissions: owner.permissions });
    const item = await catalogue.createItem(owner.scope, {
      sku: "COMP-100",
      description: "Scroll compressor",
      category: "Compressors",
      manufacturer: "Copeland",
      model: "ZR72",
      unit: "each",
      sellingPriceMinor: 100000,
      taxTreatment: "not_registered",
      supplierReference: "SUP-1",
    });
    await catalogue.setItemCost(owner.scope, item.id, { purchaseCostMinor: 40000 });
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [
          {
            lineNumber: 1,
            lineRole: "optional",
            source: "catalogue",
            catalogueItemId: item.id,
            quantityMilli: 2500,
          },
          customDraft(2, "Field gasket"),
        ],
      },
    );
    await catalogue.updateItem(owner.scope, item.id, {
      sellingPriceMinor: 250000,
      description: "Replacement scroll compressor",
    });
    const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.sku, "COMP-100");
    assert.equal(lines[0]?.description, "Scroll compressor");
    assert.equal(lines[0]?.unit, "each");
    assert.equal(lines[0]?.unitPriceMinor, 100000);
    assert.equal(lines[0]?.quantityMilli, 2500);
    assert.equal(lines[0]?.discountEligible, 0);
    assert.equal(JSON.stringify(lines).includes("purchase"), false);
    assert.equal(readFileSync(LINES_SOURCE, "utf8").includes("frigora_commercial_item_costs"), false);
    const columns = await getClient().execute("PRAGMA table_info(frigora_quotation_line_snapshots)");
    assert.equal(
      columns.rows.some((row) => String(row.name).includes("purchase") || String(row.name).includes("margin")),
      false,
    );
    const items = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_commercial_items");
    assert.equal(Number(items.rows[0]?.n), 1);
    assert.equal(lines[1]?.sourceType, "custom");
    assert.equal(lines[1]?.catalogueItemId, null);
    assert.equal(lines[1]?.sku, null);

    await catalogue.updateItem(owner.scope, item.id, { status: "discontinued" });
    const next = await seedRecommendation(owner, "WO-1865");
    await expectCode(
      () =>
        createPersistedQuotation(owner.store, owner.scope, quoteInput(next.id), {
          permissions: owner.permissions,
          drafts: [
            {
              lineNumber: 1,
              lineRole: "mandatory",
              source: "catalogue",
              catalogueItemId: item.id,
              quantityMilli: 1000,
            },
          ],
        }),
      "invalid_status",
    );
    const quotations = await getClient().execute("SELECT id FROM frigora_quotations");
    assert.equal(quotations.rows.length, 1);
  });

  it("freezes issued lines, replaces draft lines, and copies revision lines onto new identities", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Original gasket")],
      },
    );
    const original = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    await correctPersistedQuotation(
      owner.store,
      owner.scope,
      quote.id,
      {
        expectedCurrentVersion: 1,
        description: "Replace compressor and gasket",
        commercial: exampleQuotationCommercial(),
      },
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Corrected gasket")],
      },
    );
    const corrected = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    const correctedLine = corrected[0];
    assert.ok(correctedLine);
    const correctedLineId = correctedLine.id;
    assert.equal(corrected.length, 1);
    assert.equal(correctedLine.description, "Corrected gasket");
    assert.notEqual(correctedLineId, original[0]?.id);
    const correctedQuote = await owner.store.findPersistedQuotation(
      owner.workspaceId,
      owner.ventureId,
      quote.id,
    );
    assert.equal(correctedQuote?.versions[0]?.description, "Replace compressor and gasket");
    assert.equal(
      correctedQuote?.versions[0]?.documentHash,
      quotationOfferHash({
        version: 1,
        description: "Replace compressor and gasket",
        ...priceQuotationCommercial(exampleQuotationCommercial()),
        lines: [offerLineFromSnapshot(correctedLine)],
      }),
    );
    assert.equal(correctedQuote?.versions[0]?.totalMinor, quote.versions[0]?.totalMinor);

    const previousHash = correctedQuote?.versions[0]?.documentHash;
    assert.equal(typeof previousHash, "string");
    const revised = await revisePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor revised",
      commercial: exampleQuotationCommercial({ labourQuantityMilli: 20_000 }),
    });
    assert.equal(revised.currentVersion, 2);
    assert.equal(revised.versions.find((version) => version.version === 1)?.documentHash, previousHash);
    assert.equal(revised.versions.find((version) => version.version === 1)?.status, "in_preparation");
    const repriced = priceQuotationCommercial(exampleQuotationCommercial({ labourQuantityMilli: 20_000 }));
    assert.equal(revised.versions.find((version) => version.version === 2)?.totalMinor, repriced.totalMinor);
    assert.notEqual(revised.versions.find((version) => version.version === 2)?.documentHash, previousHash);
    const decisions = await getClient().execute({
      sql: "SELECT version_number FROM frigora_quotation_decisions WHERE quotation_id = ?",
      args: [quote.id],
    });
    assert.equal(decisions.rows.length, 0);
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotation_line_snapshots SET description = 'Tampered' WHERE id = ?",
            args: [correctedLineId],
          });
        }),
      /historical quotation lines cannot be changed/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "DELETE FROM frigora_quotation_line_snapshots WHERE id = ?",
            args: [correctedLineId],
          });
        }),
      /historical quotation lines cannot be changed/i,
    );
    const frozen = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    const frozenLine = frozen[0];
    assert.ok(frozenLine);
    assert.equal(frozenLine.description, "Corrected gasket");
    assert.equal(frozenLine.id, correctedLineId);
    const previous = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    const copied = await listQuotationLineSnapshots(owner.scope, quote.id, 2);
    const previousLine = previous[0];
    const copiedLine = copied[0];
    assert.ok(previousLine);
    assert.ok(copiedLine);
    assert.equal(previousLine.id, frozenLine.id);
    assert.equal(previousLine.description, "Corrected gasket");
    assert.equal(previousLine.versionNumber, 1);
    assert.equal(previousLine.workspaceId, owner.workspaceId);
    assert.equal(previousLine.ventureId, owner.ventureId);
    assert.equal(copied.length, 1);
    assert.notEqual(copiedLine.id, previousLine.id);
    assert.equal(copiedLine.description, "Corrected gasket");
    assert.equal(copiedLine.unitPriceMinor, previousLine.unitPriceMinor);
    assert.equal(copiedLine.lineNumber, 1);
    assert.equal(copiedLine.versionNumber, 2);
    assert.equal(copiedLine.workspaceId, owner.workspaceId);
    assert.equal(copiedLine.ventureId, owner.ventureId);
  });

  it("rolls a line failure back with the quotation header", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Kept gasket")],
      },
    );
    await expectCode(
      () =>
        correctPersistedQuotation(
          owner.store,
          owner.scope,
          quote.id,
          {
            expectedCurrentVersion: 1,
            description: "This description must not be stored",
            commercial: exampleQuotationCommercial(),
          },
          {
            permissions: owner.permissions,
            drafts: [customDraft(1, "One"), customDraft(1, "Two")],
          },
        ),
      "duplicate",
    );
    const stored = await owner.store.findPersistedQuotation(
      owner.workspaceId,
      owner.ventureId,
      quote.id,
    );
    assert.equal(stored?.versions[0]?.description, "Replace compressor");
    const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.description, "Kept gasket");

    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: `
              INSERT INTO frigora_quotation_line_snapshots (
                id, quotation_id, version_number, workspace_id, venture_id, line_number,
                source_type, catalogue_item_id, sku, description, unit, quantity_milli,
                unit_price_minor, currency, tax_treatment, line_role, discount_eligible,
                created_at, created_by_user_id
              ) VALUES ('line-dup', ?, 1, ?, ?, 1, 'custom', NULL, NULL,
                'Duplicate', 'each', 1000, 100, 'ZAR', 'not_registered', 'mandatory', 0, ?, ?)
            `,
            args: [quote.id, owner.workspaceId, owner.ventureId, NOW, owner.userId],
          });
        }),
      /UNIQUE constraint failed/i,
    );
    const after = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    assert.equal(after.length, 1);
    assert.equal(after[0]?.description, "Kept gasket");
  });

  it("refuses to issue a line-bearing quotation before held replay or send", async () => {
    const commands = readFileSync(COMMANDS_SOURCE, "utf8");
    const issue = commands.slice(commands.indexOf("export async function issuePersistedQuotation"));
    const guard = issue.indexOf("assertQuotationIssueHasNoLines");
    const replay = issue.indexOf("heldIssueReplay(");
    const send = issue.indexOf("sendQuotation(");
    assert.ok(guard >= 0 && guard < replay && replay < send);
    const replayFunction = commands.slice(
      commands.indexOf("async function heldIssueReplay"),
      commands.indexOf("export async function issuePersistedQuotation"),
    );
    const replayGuard = replayFunction.indexOf("assertQuotationIssueHasNoLines");
    const replaySuccess = replayFunction.indexOf("idempotentReplay: true");
    assert.ok(replayGuard >= 0 && replayGuard < replaySuccess);
    const recovery = issue.indexOf("const concurrent = await heldIssueReplay");
    assert.ok(recovery > send);

    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Unissued gasket")],
      },
    );
    const issued = await issuePersistedQuotation(owner.store, owner.scope, quote.id as FrigoraQuotationId, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    assert.equal(issued.quotation.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(issued.quotation.versions[0]?.totalMinor, priceQuotationCommercial(exampleQuotationCommercial()).totalMinor);
    const sent = await getClient().execute({
      sql: "SELECT id FROM frigora_quotation_events WHERE quotation_id = ? AND kind = 'sent'",
      args: [quote.id],
    });
    assert.equal(sent.rows.length, 1);
    const blocked = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(await seedRecommendation(owner, "WO-DISCOUNT").then((row) => row.id)),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Discounted gasket")],
      },
    );
    await getClient().execute({
      sql: "UPDATE frigora_quotation_line_snapshots SET discount_eligible = 1 WHERE quotation_id = ?",
      args: [blocked.id],
    });
    await expectCode(
      () =>
        issuePersistedQuotation(owner.store, owner.scope, blocked.id as FrigoraQuotationId, {
          expectedCurrentVersion: 1,
          recipient: "client@example.test",
        }),
      "invalid_status",
    );
    await assert.rejects(
      () =>
        getClient().execute({
          sql: `
            UPDATE frigora_quotation_versions
            SET status = 'awaiting_customer_approval'
            WHERE quotation_id = ? AND version_number = 1
          `,
          args: [blocked.id],
        }),
      /line-bearing quotation cannot be issued/i,
    );
    const held = await owner.store.findPersistedQuotation(
      owner.workspaceId,
      owner.ventureId,
      blocked.id,
    );
    assert.equal(held?.versions[0]?.status, "in_preparation");
    const outbox = await getClient().execute({
      sql: "SELECT id FROM frigora_quotation_delivery_outbox WHERE quotation_id = ?",
      args: [blocked.id],
    });
    assert.equal(outbox.rows.length, 0);
  });

  it("replays a header-only held issue without creating the line table", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
    );
    await expectCode(
      () =>
        revisePersistedQuotation(owner.store, owner.scope, quote.id, {
          expectedCurrentVersion: 1,
          description: "Header-only drafts are corrected in place",
          commercial: exampleQuotationCommercial(),
        }),
      "invalid_status",
    );
    const issued = await issuePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    assert.equal(issued.idempotentReplay, false);
    assert.equal(issued.quotation.versions[0]?.status, "awaiting_customer_approval");
    const replay = await issuePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    assert.equal(replay.idempotentReplay, true);
    assert.deepEqual(await tableNames("frigora_quotation_line_snapshots"), []);
  });

  it("does not issue when correction adds lines before send commits", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
    );
    const [issued, corrected] = await Promise.allSettled([
      issuePersistedQuotation(owner.store, owner.scope, quote.id, {
        expectedCurrentVersion: 1,
        recipient: "client@example.test",
      }),
      correctPersistedQuotation(
        owner.store,
        owner.scope,
        quote.id,
        {
          expectedCurrentVersion: 1,
          description: "Replace compressor with a raced line",
          commercial: exampleQuotationCommercial(),
        },
        {
          permissions: owner.permissions,
          drafts: [customDraft(1, "Raced gasket")],
        },
      ),
    ]);
    const stored = await owner.store.findPersistedQuotation(
      owner.workspaceId,
      owner.ventureId,
      quote.id,
    );
    const status = stored?.versions.find((version) => version.version === stored.currentVersion)?.status;
    const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    assert.ok(!(status === "awaiting_customer_approval" && lines.length > 0));
    if (issued.status === "fulfilled") {
      assert.equal(issued.value.idempotentReplay, false);
      assert.equal(status, "awaiting_customer_approval");
      assert.equal(lines.length, 0);
    }
    if (corrected.status === "fulfilled") {
      assert.equal(status, "in_preparation");
      assert.equal(lines.length, 1);
      assert.equal(lines[0]?.description, "Raced gasket");
      assert.equal(issued.status, "rejected");
    }
    assert.ok(issued.status === "fulfilled" || corrected.status === "fulfilled");
  });

  it("rolls a failed line replacement back with the previous header and lines", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Kept gasket")],
      },
    );
    await getClient().execute(`
      CREATE TRIGGER frigora_test_correct_line_fail
      BEFORE INSERT ON frigora_quotation_line_snapshots
      WHEN NEW.description = 'FORCE-ROLLBACK'
      BEGIN
        SELECT RAISE(ABORT, 'forced correction line failure');
      END
    `);
    await assert.rejects(
      () =>
        correctPersistedQuotation(
          owner.store,
          owner.scope,
          quote.id,
          {
            expectedCurrentVersion: 1,
            description: "This header must roll back",
            commercial: exampleQuotationCommercial(),
          },
          {
            permissions: owner.permissions,
            drafts: [customDraft(1, "FORCE-ROLLBACK")],
          },
        ),
      /forced correction line failure/i,
    );
    const stored = await owner.store.findPersistedQuotation(
      owner.workspaceId,
      owner.ventureId,
      quote.id,
    );
    assert.equal(stored?.versions[0]?.description, "Replace compressor");
    assert.equal(stored?.versions[0]?.status, "in_preparation");
    const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.description, "Kept gasket");
  });

  it("rolls a revision copy back without advancing the quotation", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Kept gasket")],
      },
    );
    const version = quote.versions[0];
    assert.ok(version);
    await getClient().execute(`
      CREATE TRIGGER frigora_test_revision_copy_fail
      BEFORE INSERT ON frigora_quotation_line_snapshots
      WHEN NEW.version_number = 2
      BEGIN
        SELECT RAISE(ABORT, 'forced revision copy failure');
      END
    `);
    await assert.rejects(
      () =>
        owner.store.commitQuotationRevision({
          quotationId: quote.id,
          workspaceId: owner.workspaceId,
          ventureId: owner.ventureId,
          expectedCurrentVersion: 1,
          nextVersion: 2,
          description: version.description,
          commercial: version.commercial,
          totalMinor: version.totalMinor,
          documentHash: version.documentHash,
          occurredAt: NOW,
          eventId: "event-force-rollback" as FrigoraQuotationEventId,
          actorUserId: owner.userId,
        }),
      /forced revision copy failure/i,
    );
    const stored = await owner.store.findPersistedQuotation(
      owner.workspaceId,
      owner.ventureId,
      quote.id,
    );
    assert.equal(stored?.currentVersion, 1);
    assert.equal(stored?.versions.length, 1);
    assert.equal(stored?.versions[0]?.status, "in_preparation");
    const events = await getClient().execute({
      sql: "SELECT kind FROM frigora_quotation_events WHERE quotation_id = ? AND kind = 'revision_started'",
      args: [quote.id],
    });
    assert.equal(events.rows.length, 0);
    const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.description, "Kept gasket");
    const copied = await listQuotationLineSnapshots(owner.scope, quote.id, 2);
    assert.equal(copied.length, 0);
  });

  it("rejects direct SQL that would issue or reattach line-bearing versions", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Protected gasket")],
      },
    );
    const before = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    const line = before[0];
    assert.ok(line);
    await getClient().execute({
      sql: "UPDATE frigora_quotation_line_snapshots SET discount_eligible = 1 WHERE id = ?",
      args: [line.id],
    });
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotation_versions SET status = 'awaiting_customer_approval' WHERE quotation_id = ? AND version_number = 1",
            args: [quote.id],
          });
        }),
      /line-bearing quotation cannot be issued/i,
    );
    await getClient().execute({
      sql: "UPDATE frigora_quotation_line_snapshots SET discount_eligible = 0 WHERE id = ?",
      args: [line.id],
    });
    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute({
        sql: `
          INSERT INTO frigora_quotation_versions (
            quotation_id, workspace_id, venture_id, version_number, status, description,
            total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref,
            labour_quantity_milli, labour_unit, labour_rate_minor, labour_amount_minor,
            travel_kilometres_milli, distance_basis, travel_rate_minor, travel_amount_minor,
            tax_treatment, tax_rule_id, tax_rule_version, tax_rate_numerator, tax_rate_denominator,
            taxable_amount_minor, tax_amount_minor
          )
          SELECT quotation_id, workspace_id, venture_id, 2, 'awaiting_customer_approval', description,
            total_minor, currency, document_hash, ?, 'client@example.test', 'dispatch-direct',
            labour_quantity_milli, labour_unit, labour_rate_minor, labour_amount_minor,
            travel_kilometres_milli, distance_basis, travel_rate_minor, travel_amount_minor,
            tax_treatment, tax_rule_id, tax_rule_version, tax_rate_numerator, tax_rate_denominator,
            taxable_amount_minor, tax_amount_minor
          FROM frigora_quotation_versions
          WHERE quotation_id = ? AND version_number = 1
        `,
        args: [NOW, quote.id],
      });
    });
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: `
              INSERT INTO frigora_quotation_line_snapshots (
                id, quotation_id, version_number, workspace_id, venture_id, line_number,
                source_type, catalogue_item_id, sku, description, unit, quantity_milli,
                unit_price_minor, currency, tax_treatment, line_role, discount_eligible,
                created_at, created_by_user_id
              ) VALUES ('line-on-awaiting', ?, 2, ?, ?, 1, 'custom', NULL, NULL,
                'Attached late', 'each', 1000, 100, 'ZAR', 'not_registered', 'mandatory', 0, ?, ?)
            `,
            args: [quote.id, owner.workspaceId, owner.ventureId, NOW, owner.userId],
          });
        }),
      /quotation lines can only be added to a draft|quotation lines can only be added to the current draft/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotation_line_snapshots SET version_number = 2 WHERE id = ?",
            args: [line.id],
          });
        }),
      /quotation line identity cannot be changed|quotation lines cannot be moved onto another version/i,
    );
    const triggers = await getClient().execute(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name IN ('frigora_quotation_versions_block_line_issue_insert', 'frigora_quotation_versions_block_line_issue_update') ORDER BY name",
    );
    assert.deepEqual(
      triggers.rows.map((row) => String(row.name)),
      [
        "frigora_quotation_versions_block_line_issue_insert",
        "frigora_quotation_versions_block_line_issue_update",
      ],
    );
    const statuses = await getClient().execute({
      sql: "SELECT version_number, status FROM frigora_quotation_versions WHERE quotation_id = ? ORDER BY version_number",
      args: [quote.id],
    });
    assert.equal(Number(statuses.rows[0]?.version_number), 1);
    assert.equal(String(statuses.rows[0]?.status), "in_preparation");
    assert.equal(Number(statuses.rows[1]?.version_number), 2);
    assert.equal(String(statuses.rows[1]?.status), "awaiting_customer_approval");
    const lines = await getClient().execute({
      sql: "SELECT id, description, version_number FROM frigora_quotation_line_snapshots WHERE quotation_id = ? ORDER BY version_number",
      args: [quote.id],
    });
    assert.equal(lines.rows.length, 1);
    assert.equal(String(lines.rows[0]?.id), String(line.id));
    assert.equal(String(lines.rows[0]?.description), "Protected gasket");
    assert.equal(Number(lines.rows[0]?.version_number), 1);
  });

  it("rejects direct rewrites of quotation header direction and line identity", async () => {
    const owner = await seed();
    const firstRecommendation = await seedRecommendation(owner, "WO-IDENTITY-A");
    const secondRecommendation = await seedRecommendation(owner, "WO-IDENTITY-B");
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(firstRecommendation.id, "Identity source"),
      { permissions: owner.permissions, drafts: [customDraft(1, "Identity gasket")] },
    );
    const other = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(secondRecommendation.id, "Identity destination"),
      { permissions: owner.permissions, drafts: [customDraft(1, "Other gasket")] },
    );
    const revised = await revisePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      description: "Identity revised",
      commercial: exampleQuotationCommercial({ labourQuantityMilli: 20_000 }),
    });
    assert.equal(revised.currentVersion, 2);
    const beforeLines = await getClient().execute({
      sql: "SELECT id, quotation_id, version_number, workspace_id, venture_id, description FROM frigora_quotation_line_snapshots WHERE quotation_id = ? ORDER BY version_number",
      args: [quote.id],
    });
    const versionOne = beforeLines.rows[0];
    const versionTwo = beforeLines.rows[1];
    assert.ok(versionOne?.id);
    assert.ok(versionTwo?.id);
    const versionOneId = String(versionOne.id);
    const versionTwoId = String(versionTwo.id);
    assert.notEqual(versionOneId, versionTwoId);

    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotations SET current_version = 1 WHERE id = ?",
            args: [quote.id],
          });
        }),
      /quotation identity and version history cannot be rewritten/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotations SET workspace_id = 'ws-forged' WHERE id = ?",
            args: [quote.id],
          });
        }),
      /quotation identity and version history cannot be rewritten/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotations SET venture_id = 'ven-forged' WHERE id = ?",
            args: [quote.id],
          });
        }),
      /quotation identity and version history cannot be rewritten/i,
    );
    const header = await getClient().execute({
      sql: "SELECT current_version, workspace_id, venture_id FROM frigora_quotations WHERE id = ?",
      args: [quote.id],
    });
    assert.equal(Number(header.rows[0]?.current_version), 2);
    assert.equal(String(header.rows[0]?.workspace_id), owner.workspaceId);
    assert.equal(String(header.rows[0]?.venture_id), owner.ventureId);

    const forwarded = await revisePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 2,
      description: "Identity revised again",
      commercial: exampleQuotationCommercial({ labourQuantityMilli: 30_000 }),
    });
    assert.equal(forwarded.currentVersion, 3);
    const afterForward = await getClient().execute({
      sql: "SELECT id, version_number, description FROM frigora_quotation_line_snapshots WHERE quotation_id = ? ORDER BY version_number",
      args: [quote.id],
    });
    assert.equal(String(afterForward.rows[0]?.id), versionOneId);
    assert.equal(String(afterForward.rows[0]?.description), "Identity gasket");
    assert.equal(String(afterForward.rows[1]?.id), versionTwoId);
    assert.equal(String(afterForward.rows[1]?.description), "Identity gasket");
    assert.equal(Number(afterForward.rows[2]?.version_number), 3);
    assert.notEqual(String(afterForward.rows[2]?.id), versionTwoId);
    const currentLineId = String(afterForward.rows[2]?.id);

    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotation_line_snapshots SET quotation_id = ?, version_number = 1, line_number = 9 WHERE id = ?",
            args: [other.id, currentLineId],
          });
        }),
      /quotation line identity cannot be changed/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotation_line_snapshots SET version_number = 1 WHERE id = ?",
            args: [currentLineId],
          });
        }),
      /quotation line identity cannot be changed|quotation lines cannot be moved onto another version/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotation_line_snapshots SET workspace_id = 'ws-forged' WHERE id = ?",
            args: [currentLineId],
          });
        }),
      /quotation line identity cannot be changed|quotation lines cannot be moved onto another version/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotation_line_snapshots SET venture_id = 'ven-forged' WHERE id = ?",
            args: [currentLineId],
          });
        }),
      /quotation line identity cannot be changed|quotation lines cannot be moved onto another version/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "UPDATE frigora_quotation_line_snapshots SET description = 'Tampered history' WHERE id = ?",
            args: [versionOneId],
          });
        }),
      /historical quotation lines cannot be changed/i,
    );
    await assert.rejects(
      () =>
        withFrigoraWriteTransaction(async (transaction) => {
          await transaction.execute({
            sql: "DELETE FROM frigora_quotation_line_snapshots WHERE id = ?",
            args: [versionOneId],
          });
        }),
      /historical quotation lines cannot be changed/i,
    );

    const persisted = await getClient().execute({
      sql: "SELECT id, quotation_id, version_number, workspace_id, venture_id, description FROM frigora_quotation_line_snapshots WHERE quotation_id = ? ORDER BY version_number",
      args: [quote.id],
    });
    assert.equal(persisted.rows.length, 3);
    assert.equal(String(persisted.rows[0]?.id), versionOneId);
    assert.equal(String(persisted.rows[0]?.quotation_id), quote.id);
    assert.equal(Number(persisted.rows[0]?.version_number), 1);
    assert.equal(String(persisted.rows[0]?.workspace_id), owner.workspaceId);
    assert.equal(String(persisted.rows[0]?.venture_id), owner.ventureId);
    assert.equal(String(persisted.rows[0]?.description), "Identity gasket");
    assert.equal(String(persisted.rows[2]?.id), currentLineId);
    assert.equal(String(persisted.rows[2]?.quotation_id), quote.id);
    assert.equal(Number(persisted.rows[2]?.version_number), 3);
    assert.equal(String(persisted.rows[2]?.workspace_id), owner.workspaceId);
    assert.equal(String(persisted.rows[2]?.venture_id), owner.ventureId);
    const otherLines = await getClient().execute({
      sql: "SELECT id, description FROM frigora_quotation_line_snapshots WHERE quotation_id = ?",
      args: [other.id],
    });
    assert.equal(otherLines.rows.length, 1);
    assert.equal(String(otherLines.rows[0]?.description), "Other gasket");
    const finalHeader = await getClient().execute({
      sql: "SELECT current_version, workspace_id, venture_id FROM frigora_quotations WHERE id = ?",
      args: [quote.id],
    });
    assert.equal(Number(finalHeader.rows[0]?.current_version), 3);
    assert.equal(String(finalHeader.rows[0]?.workspace_id), owner.workspaceId);
    assert.equal(String(finalHeader.rows[0]?.venture_id), owner.ventureId);
  });

  it("revises a line-bearing draft through the supported command and preserves history", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Historical gasket")],
      },
    );
    const before = await getClient().execute({
      sql: "SELECT * FROM frigora_quotation_line_snapshots WHERE quotation_id = ? AND version_number = 1",
      args: [quote.id],
    });
    const beforeRow = JSON.stringify(before.rows[0]);
    const previousHash = quote.versions[0]?.documentHash;
    assert.ok(previousHash);
    const revised = await revisePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor revised",
      commercial: exampleQuotationCommercial({ labourQuantityMilli: 20_000 }),
    });
    const after = await getClient().execute({
      sql: "SELECT * FROM frigora_quotation_line_snapshots WHERE quotation_id = ? AND version_number = 1",
      args: [quote.id],
    });
    assert.equal(JSON.stringify(after.rows[0]), beforeRow);
    const copied = await listQuotationLineSnapshots(owner.scope, quote.id, 2);
    const copiedLine = copied[0];
    assert.ok(copiedLine);
    assert.equal(revised.currentVersion, 2);
    assert.notEqual(copiedLine.id, before.rows[0]?.id);
    assert.equal(copiedLine.description, "Historical gasket");
    assert.equal(copiedLine.quantityMilli, 0);
    assert.equal(copiedLine.unit, "each");
    assert.equal(copiedLine.unitPriceMinor, 15000);
    assert.equal(copiedLine.taxTreatment, "not_registered");
    assert.equal(copiedLine.lineRole, "mandatory");
    assert.equal(copiedLine.sourceType, "custom");
    assert.equal(copiedLine.workspaceId, owner.workspaceId);
    assert.equal(copiedLine.ventureId, owner.ventureId);
    assert.equal(revised.versions.find((version) => version.version === 1)?.documentHash, previousHash);
    const repriced = priceQuotationCommercial(exampleQuotationCommercial({ labourQuantityMilli: 20_000 }));
    assert.equal(revised.versions.find((version) => version.version === 2)?.totalMinor, repriced.totalMinor);
    assert.equal(revised.versions.find((version) => version.version === 2)?.documentHash, quotationOfferHash({
      version: 2,
      description: "Replace compressor revised",
      ...repriced,
      lines: [offerLineFromSnapshot(copiedLine)],
    }));
    await expectCode(
      () =>
        revisePersistedQuotation(owner.store, owner.scope, quote.id, {
          expectedCurrentVersion: 1,
          description: "Duplicate revision",
          commercial: exampleQuotationCommercial(),
        }),
      "quotation_conflict",
    );
    await expectCode(
      () =>
        revisePersistedQuotation(
          owner.store,
          { ...owner.scope, workspaceId: "ws-other" as WorkspaceId },
          quote.id,
          {
            expectedCurrentVersion: 2,
            description: "Cross workspace",
            commercial: exampleQuotationCommercial(),
          },
        ),
      "not_found",
    );
    await expectCode(
      () =>
        revisePersistedQuotation(owner.store, owner.scope, quote.id, {
          expectedCurrentVersion: 2,
          description: "Invalid charge",
          commercial: exampleQuotationCommercial({ labourQuantityMilli: -1 }),
        }),
      "invalid_input",
    );
    const stored = await owner.store.findPersistedQuotation(owner.workspaceId, owner.ventureId, quote.id);
    assert.equal(stored?.currentVersion, 2);
    assert.equal(stored?.versions.length, 2);
  });

  it("rolls back a supported revision when header creation or line copying fails", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id),
      {
        permissions: owner.permissions,
        drafts: [customDraft(1, "Kept gasket")],
      },
    );
    await getClient().execute(`
      CREATE TRIGGER frigora_test_revision_header_fail
      BEFORE INSERT ON frigora_quotation_versions
      WHEN NEW.description = 'FORCE-HEADER-ROLLBACK'
      BEGIN
        SELECT RAISE(ABORT, 'forced revision header failure');
      END
    `);
    await assert.rejects(
      () =>
        revisePersistedQuotation(owner.store, owner.scope, quote.id, {
          expectedCurrentVersion: 1,
          description: "FORCE-HEADER-ROLLBACK",
          commercial: exampleQuotationCommercial(),
        }),
      /forced revision header failure/i,
    );
    await getClient().execute("DROP TRIGGER IF EXISTS frigora_test_revision_header_fail");
    await getClient().execute(`
      CREATE TRIGGER frigora_test_revision_command_copy_fail
      BEFORE INSERT ON frigora_quotation_line_snapshots
      WHEN NEW.version_number = 2
      BEGIN
        SELECT RAISE(ABORT, 'forced revision copy failure');
      END
    `);
    await assert.rejects(
      () =>
        revisePersistedQuotation(owner.store, owner.scope, quote.id, {
          expectedCurrentVersion: 1,
          description: "Replace compressor revised",
          commercial: exampleQuotationCommercial(),
        }),
      /forced revision copy failure/i,
    );
    const stored = await owner.store.findPersistedQuotation(owner.workspaceId, owner.ventureId, quote.id);
    assert.equal(stored?.currentVersion, 1);
    assert.equal(stored?.versions.length, 1);
    const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    assert.equal(lines[0]?.description, "Kept gasket");
  });

  function pauseFirstWrite() {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    let entries = 0;
    setFrigoraWriteLockObserverForTests(async () => {
      entries += 1;
      order.push(`entered-${entries}`);
      if (entries === 1) {
        markEntered();
        await release;
        order.push("released-first");
      }
    });
    return {
      order,
      entered,
      release() {
        releaseFirst();
      },
      entries: () => entries,
    };
  }

  function assertConflict(result: PromiseSettledResult<unknown>) {
    assert.equal(result.status, "rejected");
    if (result.status !== "rejected") return;
    assert.ok(result.reason instanceof FrigoraError);
    assert.equal(result.reason.code, "quotation_conflict");
  }

  it("lets issue hold the write lock before correction can enter", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(owner.store, owner.scope, quoteInput(recommendation.id));
    await ensureFrigoraCommercialLinesSchema();
    const gate = pauseFirstWrite();
    const issuePromise = issuePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    try {
      await gate.entered;
      assert.equal(gate.entries(), 1);
      const [corrected] = await Promise.allSettled([
        correctPersistedQuotation(
          owner.store,
          owner.scope,
          quote.id,
          {
            expectedCurrentVersion: 1,
            description: "Correction while issue holds the lock",
            commercial: exampleQuotationCommercial(),
          },
          { permissions: owner.permissions, drafts: [customDraft(1, "Raced gasket")] },
        ),
      ]);
      assert.equal(gate.entries(), 1);
      assert.deepEqual(gate.order, ["entered-1"]);
      assertConflict(corrected);
      gate.release();
      const issued = await issuePromise;
      assert.equal(issued.idempotentReplay, false);
      assert.deepEqual(gate.order, ["entered-1", "released-first"]);
      await expectCode(
        () =>
          correctPersistedQuotation(owner.store, owner.scope, quote.id, {
            expectedCurrentVersion: 1,
            description: "Retry after issue",
            commercial: exampleQuotationCommercial(),
          }),
        "invalid_input",
      );
      const stored = await owner.store.findPersistedQuotation(owner.workspaceId, owner.ventureId, quote.id);
      assert.equal(stored?.versions[0]?.status, "awaiting_customer_approval");
      const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
      assert.equal(lines.length, 0);
      const sent = await getClient().execute({
        sql: "SELECT id FROM frigora_quotation_events WHERE quotation_id = ? AND kind = 'sent'",
        args: [quote.id],
      });
      const outbox = await getClient().execute({
        sql: "SELECT id FROM frigora_quotation_delivery_outbox WHERE quotation_id = ?",
        args: [quote.id],
      });
      assert.equal(sent.rows.length, 1);
      assert.equal(outbox.rows.length, 1);
    } finally {
      gate.release();
      await issuePromise.catch(() => undefined);
      setFrigoraWriteLockObserverForTests(undefined);
    }
  });

  it("lets correction hold the write lock before issue can send", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(owner.store, owner.scope, quoteInput(recommendation.id));
    await ensureFrigoraCommercialLinesSchema();
    const gate = pauseFirstWrite();
    const correctionPromise = correctPersistedQuotation(
      owner.store,
      owner.scope,
      quote.id,
      {
        expectedCurrentVersion: 1,
        description: "Correction holds the lock",
        commercial: exampleQuotationCommercial(),
      },
      { permissions: owner.permissions, drafts: [customDraft(1, "Locked gasket")] },
    );
    try {
      await gate.entered;
      assert.equal(gate.entries(), 1);
      const [issued] = await Promise.allSettled([
        issuePersistedQuotation(owner.store, owner.scope, quote.id, {
          expectedCurrentVersion: 1,
          recipient: "client@example.test",
        }),
      ]);
      assert.equal(gate.entries(), 1);
      assert.deepEqual(gate.order, ["entered-1"]);
      assertConflict(issued);
      gate.release();
      await correctionPromise;
      assert.deepEqual(gate.order, ["entered-1", "released-first"]);
      const stored = await owner.store.findPersistedQuotation(owner.workspaceId, owner.ventureId, quote.id);
      assert.equal(stored?.currentVersion, 1);
      assert.equal(stored?.versions[0]?.status, "in_preparation");
      const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
      assert.equal(lines.length, 1);
      assert.equal(lines[0]?.description, "Locked gasket");
      const sent = await getClient().execute({
        sql: "SELECT id FROM frigora_quotation_events WHERE quotation_id = ? AND kind = 'sent'",
        args: [quote.id],
      });
      assert.equal(sent.rows.length, 0);
    } finally {
      gate.release();
      await correctionPromise.catch(() => undefined);
      setFrigoraWriteLockObserverForTests(undefined);
    }
  });

  it("rejects a second issue while the first send holds the lock and then replays", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner);
    const quote = await createPersistedQuotation(owner.store, owner.scope, quoteInput(recommendation.id));
    const gate = pauseFirstWrite();
    const firstPromise = issuePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    try {
      await gate.entered;
      assert.equal(gate.entries(), 1);
      const [second] = await Promise.allSettled([
        issuePersistedQuotation(owner.store, owner.scope, quote.id, {
          expectedCurrentVersion: 1,
          recipient: "client@example.test",
        }),
      ]);
      assert.equal(gate.entries(), 1);
      assert.deepEqual(gate.order, ["entered-1"]);
      assertConflict(second);
      gate.release();
      const first = await firstPromise;
      assert.equal(first.idempotentReplay, false);
      assert.deepEqual(gate.order, ["entered-1", "released-first"]);
      setFrigoraWriteLockObserverForTests(undefined);
      const replay = await issuePersistedQuotation(owner.store, owner.scope, quote.id, {
        expectedCurrentVersion: 1,
        recipient: "client@example.test",
      });
      assert.equal(replay.idempotentReplay, true);
      const sent = await getClient().execute({
        sql: "SELECT id FROM frigora_quotation_events WHERE quotation_id = ? AND kind = 'sent'",
        args: [quote.id],
      });
      const outbox = await getClient().execute({
        sql: "SELECT id FROM frigora_quotation_delivery_outbox WHERE quotation_id = ?",
        args: [quote.id],
      });
      assert.equal(sent.rows.length, 1);
      assert.equal(outbox.rows.length, 1);
    } finally {
      gate.release();
      await firstPromise.catch(() => undefined);
      setFrigoraWriteLockObserverForTests(undefined);
    }
  });

  it("records immutable decision lines for an approved selection and leaves a decline empty", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner, "WO-DECISION");
    const quote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(recommendation.id, "Offer with a choice"),
      {
        permissions: owner.permissions,
        drafts: [
          customDraft(1, "Mandatory gasket"),
          { ...customDraft(2, "Optional filter"), lineRole: "optional" as const },
        ],
      },
    );
    const lines = await listQuotationLineSnapshots(owner.scope, quote.id, 1);
    const mandatory = lines.find((line) => line.lineRole === "mandatory");
    const optional = lines.find((line) => line.lineRole === "optional");
    assert.ok(mandatory && optional);
    assert.equal(
      quote.versions[0]?.documentHash,
      quotationOfferHash({
        version: 1,
        description: "Offer with a choice",
        ...priceQuotationCommercial(exampleQuotationCommercial()),
        lines: lines.map(offerLineFromSnapshot),
      }),
    );
    await issuePersistedQuotation(owner.store, owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    const decisionId = "decision-lines-1";
    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute({
        sql: `
          INSERT INTO frigora_quotation_decisions (
            id, quotation_id, workspace_id, venture_id, customer_id, site_id,
            version_number, document_hash, decision, grant_id, decided_at
          )
          SELECT ?, id, workspace_id, venture_id, customer_id, site_id,
            1, ?, 'approved', 'grant-lines-1', ?
          FROM frigora_quotations WHERE id = ?
        `,
        args: [decisionId, quote.versions[0]?.documentHash ?? "", NOW, quote.id],
      });
      await transaction.execute({
        sql: "INSERT INTO frigora_quotation_decision_lines (decision_id, line_id, inclusion) VALUES (?, ?, 'mandatory')",
        args: [decisionId, mandatory.id],
      });
      await transaction.execute({
        sql: "INSERT INTO frigora_quotation_decision_lines (decision_id, line_id, inclusion) VALUES (?, ?, 'selected_optional')",
        args: [decisionId, optional.id],
      });
      await transaction.execute({
        sql: "UPDATE frigora_quotation_versions SET status = 'approved' WHERE quotation_id = ? AND version_number = 1",
        args: [quote.id],
      });
    });
    await assert.rejects(
      () => getClient().execute({
        sql: "UPDATE frigora_quotation_decision_lines SET inclusion = 'selected_optional' WHERE line_id = ?",
        args: [mandatory.id],
      }),
      /quotation decision lines are immutable/i,
    );
    await assert.rejects(
      () => getClient().execute({
        sql: "DELETE FROM frigora_quotation_decision_lines WHERE line_id = ?",
        args: [optional.id],
      }),
      /quotation decision lines are immutable/i,
    );
    await assert.rejects(
      () => getClient().execute({
        sql: "INSERT OR REPLACE INTO frigora_quotation_decision_lines (decision_id, line_id, inclusion) VALUES (?, ?, 'mandatory')",
        args: [decisionId, optional.id],
      }),
      /quotation decision line is not part of this offer|quotation decision lines are immutable/i,
    );
    await assert.rejects(
      () => getClient().execute({
        sql: "INSERT INTO frigora_quotation_decision_lines (decision_id, line_id, inclusion) VALUES (?, ?, 'selected_optional')",
        args: [decisionId, mandatory.id],
      }),
      /quotation decision line is not part of this offer|UNIQUE constraint failed/i,
    );
    const kept = await getClient().execute({
      sql: "SELECT line_id, inclusion FROM frigora_quotation_decision_lines WHERE decision_id = ? ORDER BY inclusion",
      args: [decisionId],
    });
    assert.equal(kept.rows.length, 2);
    assert.equal(String(kept.rows.find((row) => row.line_id === optional.id)?.inclusion), "selected_optional");

    const incompleteRecommendation = await seedRecommendation(owner, "WO-INCOMPLETE");
    const incomplete = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(incompleteRecommendation.id, "Missing mandatory selection"),
      { permissions: owner.permissions, drafts: [customDraft(1, "Required gasket")] },
    );
    await issuePersistedQuotation(owner.store, owner.scope, incomplete.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    await assert.rejects(
      () => withFrigoraWriteTransaction(async (transaction) => {
        await transaction.execute({
          sql: `
            INSERT INTO frigora_quotation_decisions (
              id, quotation_id, workspace_id, venture_id, customer_id, site_id,
              version_number, document_hash, decision, grant_id, decided_at
            )
            SELECT 'decision-incomplete', id, workspace_id, venture_id, customer_id, site_id,
              1, ?, 'approved', 'grant-incomplete', ?
            FROM frigora_quotations WHERE id = ?
          `,
          args: [incomplete.versions[0]?.documentHash ?? "", NOW, incomplete.id],
        });
        await transaction.execute({
          sql: "UPDATE frigora_quotation_versions SET status = 'approved' WHERE quotation_id = ? AND version_number = 1",
          args: [incomplete.id],
        });
      }),
      /approved quotation lines are incomplete/i,
    );
    const incompleteStatus = await getClient().execute({
      sql: "SELECT status FROM frigora_quotation_versions WHERE quotation_id = ? AND version_number = 1",
      args: [incomplete.id],
    });
    assert.equal(String(incompleteStatus.rows[0]?.status), "awaiting_customer_approval");
    const incompleteDecisions = await getClient().execute({
      sql: "SELECT id FROM frigora_quotation_decisions WHERE quotation_id = ?",
      args: [incomplete.id],
    });
    assert.equal(incompleteDecisions.rows.length, 0);

    const declinedRecommendation = await seedRecommendation(owner, "WO-DECLINE");
    const declined = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(declinedRecommendation.id, "Declined offer"),
      { permissions: owner.permissions, drafts: [customDraft(1, "Declined gasket")] },
    );
    await issuePersistedQuotation(owner.store, owner.scope, declined.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    const declinedLines = await listQuotationLineSnapshots(owner.scope, declined.id, 1);
    await withFrigoraWriteTransaction(async (transaction) => {
      await transaction.execute({
        sql: `
          INSERT INTO frigora_quotation_decisions (
            id, quotation_id, workspace_id, venture_id, customer_id, site_id,
            version_number, document_hash, decision, grant_id, decided_at
          )
          SELECT 'decision-declined', id, workspace_id, venture_id, customer_id, site_id,
            1, ?, 'declined', 'grant-declined-1', ?
          FROM frigora_quotations WHERE id = ?
        `,
        args: [declined.versions[0]?.documentHash ?? "", NOW, declined.id],
      });
      await transaction.execute({
        sql: "UPDATE frigora_quotation_versions SET status = 'declined' WHERE quotation_id = ? AND version_number = 1",
        args: [declined.id],
      });
    });
    await assert.rejects(
      () => getClient().execute({
        sql: "INSERT INTO frigora_quotation_decision_lines (decision_id, line_id, inclusion) VALUES ('decision-declined', ?, 'mandatory')",
        args: [declinedLines[0]?.id ?? ""],
      }),
      /quotation decision line is not part of this offer/i,
    );
    const declinedRows = await getClient().execute({
      sql: "SELECT decision_id FROM frigora_quotation_decision_lines WHERE decision_id = 'decision-declined'",
    });
    assert.equal(declinedRows.rows.length, 0);
  });
});
