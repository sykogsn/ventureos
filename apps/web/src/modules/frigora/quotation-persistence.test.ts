import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import {
  IMP01A_ALTERNATIVE_SCHEMA_ERROR,
  ensureSchema,
  getClient,
} from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { exampleQuotationCommercial, priceQuotationCommercial } from "./quotation-commercial";
import { quotationDocumentHash, FRIGORA_QUOTE_STATUSES } from "./quotation-workflow";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraQuotationId, FrigoraScope } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";

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
    definitionVersion: "0.21.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function seed(options: {
  reset?: boolean;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
  store?: ReturnType<typeof createFrigoraStore>;
} = {}) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
  const workspaceId = (options.workspaceId ?? "ws-frigora") as WorkspaceId;
  const ventureId = (options.ventureId ?? "ven-frigora") as VentureId;
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
  const scope = { userId, workspaceId, ventureId } satisfies FrigoraScope;
  const service = createFrigoraService({
    store,
    permissions: createPermissionService(createDbMembershipStore()),
  });
  if ((options.role ?? "owner") === "owner") {
    await allowSyntheticNotRegisteredQuotationSend(service, scope);
  }
  return { workspaceId, ventureId, userId, store, scope, service };
}

async function seedRecommendation(owner: Awaited<ReturnType<typeof seed>>) {
  const attendeeId = "user-attendee" as UserId;
  await getPersistence().memberships.setRole({
    userId: attendeeId,
    workspaceId: owner.workspaceId,
    role: "member",
    createdAt: NOW,
  });
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
    tag: "EVAP-01",
    name: "Evaporator",
  });
  const workOrder = await owner.service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: "WO-1864",
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "display freezer warm",
  });
  const visit = await owner.service.recordVisitArrival(owner.scope, workOrder.id, {
    userId: attendeeId,
    arrivedAt: ARRIVED,
  });
  const recommendation = await owner.service.recordRecommendedAction(owner.scope, visit.id, {
    description: "Replace compressor",
    recommendedAt: RECOMMENDED_AT,
    recommendedByUserId: attendeeId,
    recordedByUserId: attendeeId,
    assetId: asset.id,
  });
  return { customer, site, asset, workOrder, visit, recommendation };
}

function quoteInput(
  recommendationId: string,
  commercial: ReturnType<typeof exampleQuotationCommercial> = exampleQuotationCommercial(),
) {
  return {
    recommendedActionId: recommendationId,
    description: "Replace compressor",
    commercial,
  };
}

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code, error.message);
    return true;
  });
}

describe("Frigora quotation persistence", () => {
  it("persists a draft linked to the diagnostic work order, asset, and server hash", async () => {
    const owner = await seed();
    const { asset, workOrder, recommendation, customer, site } = await seedRecommendation(owner);
    const quote = await owner.service.createQuotation(owner.scope, quoteInput(recommendation.id));
    assert.equal(quote.originalWorkOrderId, workOrder.id);
    assert.equal(quote.recommendedActionId, recommendation.id);
    assert.equal(quote.assetId, asset.id);
    assert.equal(quote.customerId, customer.id);
    assert.equal(quote.siteId, site.id);
    assert.equal(quote.currentVersion, 1);
    assert.equal(quote.versions.length, 1);
    assert.equal(quote.versions[0]?.status, "in_preparation");
    assert.equal(quote.versions[0]?.currency, "ZAR");
    assert.equal(quote.versions[0]?.totalMinor, 1495000);
    assert.equal(quote.versions[0]?.commercial.labourAmountMinor, 1_000_000);
    assert.equal(quote.versions[0]?.commercial.travelAmountMinor, 495_000);
    assert.equal(quote.versions[0]?.commercial.taxAmountMinor, 0);
    assert.equal(quote.versions[0]?.commercial.distanceBasis, "one_way");
    assert.equal(quote.versions[0]?.commercial.taxTreatment, "not_registered");
    assert.equal(
      quote.versions[0]?.documentHash,
      quotationDocumentHash({
        version: 1,
        description: "Replace compressor",
        ...priceQuotationCommercial(exampleQuotationCommercial()),
      }),
    );
    assert.equal(quote.events[0]?.kind, "created");
    assert.equal(quote.events[0]?.actorUserId, owner.userId);
    assert.equal("customerAuthorityVerified" in quote, false);
    assert.equal("decideQuotation" in owner.service, false);
    assert.deepEqual([...FRIGORA_QUOTE_STATUSES], [
      "in_preparation",
      "awaiting_customer_approval",
      "approved",
      "declined",
    ]);
    const listed = await owner.service.listQuotationsByWorkOrder(owner.scope, workOrder.id);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, quote.id);
    const byAsset = await owner.service.listQuotationsByAsset(owner.scope, asset.id);
    assert.equal(byAsset[0]?.id, quote.id);
    const loaded = await owner.service.getQuotation(owner.scope, quote.id);
    assert.equal(loaded?.versions.length, 1);
    assert.equal(loaded?.events.length, 1);
  });

  it("corrects a draft in place and leaves a sent version unchanged", async () => {
    const owner = await seed();
    const { recommendation } = await seedRecommendation(owner);
    const quote = await owner.service.createQuotation(owner.scope, quoteInput(recommendation.id));
    const ordersBefore = await owner.service.listWorkOrders(owner.scope);
    const corrected = await owner.service.correctQuotation(owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      description: "Replace compressor and filter drier",
      commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
    });
    assert.equal(corrected.currentVersion, 1);
    assert.equal(corrected.versions.length, 1);
    assert.equal(corrected.events.length, 1);
    assert.equal(corrected.events[0]?.kind, "created");
    assert.equal(corrected.versions[0]?.status, "in_preparation");
    assert.equal(corrected.versions[0]?.description, "Replace compressor and filter drier");
    assert.equal(corrected.versions[0]?.totalMinor, 1_250_000);
    assert.equal(corrected.versions[0]?.commercial.distanceBasis, "one_way");
    assert.notEqual(corrected.versions[0]?.documentHash, quote.versions[0]?.documentHash);
    const listed = await owner.service.listQuotations(owner.scope);
    assert.equal(listed.some((item) => item.id === quote.id), true);
    const sent = await owner.service.sendQuotation(owner.scope, quote.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    assert.equal(sent.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(sent.versions[0]?.documentHash, corrected.versions[0]?.documentHash);
    await expectCode(
      () => owner.service.correctQuotation(owner.scope, quote.id, {
        expectedCurrentVersion: 1,
        description: "Must not replace the sent version",
        commercial: exampleQuotationCommercial({ travelRateMinor: 3000 }),
      }),
      "invalid_input",
    );
    const still = await owner.service.getQuotation(owner.scope, quote.id);
    assert.equal(still?.versions.length, 1);
    assert.equal(still?.versions[0]?.documentHash, corrected.versions[0]?.documentHash);
    assert.equal(still?.versions[0]?.status, "awaiting_customer_approval");
    assert.equal((await owner.service.listWorkOrders(owner.scope)).length, ordersBefore.length);
  });

  it("rejects a description and one total without a commercial basis", async () => {
    const owner = await seed();
    const { recommendation } = await seedRecommendation(owner);
    await expectCode(
      () => owner.service.createQuotation(owner.scope, {
        recommendedActionId: recommendation.id,
        description: "Replace compressor",
        totalMinor: 1495000,
      } as never),
      "invalid_input",
    );
    await expectCode(
      () => owner.service.createQuotation(owner.scope, quoteInput(
        recommendation.id,
        exampleQuotationCommercial({ taxTreatment: "configured_rule" }),
      )),
      "invalid_input",
    );
  });

  it("rejects non-integer ZAR cents and keeps another workspace from reading the quotation", async () => {
    const owner = await seed();
    const { recommendation, workOrder } = await seedRecommendation(owner);
    await expectCode(
      () => owner.service.createQuotation(owner.scope, quoteInput(
        recommendation.id,
        exampleQuotationCommercial({ labourRateMinor: 12.5 }),
      )),
      "invalid_input",
    );
    const quote = await owner.service.createQuotation(owner.scope, quoteInput(recommendation.id));
    const other = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: "user-other" as UserId,
    });
    assert.equal(await other.service.getQuotation(other.scope, quote.id), null);
    assert.deepEqual(await other.service.listQuotationsByWorkOrder(other.scope, workOrder.id), []);
  });

  it("sends only with server-written evidence and keeps the sent version immutable", async () => {
    const owner = await seed();
    const { recommendation } = await seedRecommendation(owner);
    const draft = await owner.service.createQuotation(owner.scope, quoteInput(recommendation.id));
    const sent = await owner.service.sendQuotation(owner.scope, draft.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    const sentEvent = sent.events.find((event) => event.kind === "sent");
    assert.ok(sentEvent);
    assert.equal(sent.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(sent.versions[0]?.dispatchEvidenceRef, sentEvent.id);
    assert.equal(sent.versions[0]?.recipient, "client@example.test");
    assert.equal(sent.versions[0]?.documentHash, draft.versions[0]?.documentHash);
    assert.equal(sent.events[0]?.actorUserId, owner.userId);
    await assert.rejects(
      () => getClient().execute(
        "UPDATE frigora_quotation_versions SET total_minor = 1 WHERE version_number = 1",
      ),
      /immutable/,
    );
    await assert.rejects(
      () => getClient().execute(
        "UPDATE frigora_quotation_versions SET labour_rate_minor = 1 WHERE version_number = 1",
      ),
      /immutable/,
    );
    await assert.rejects(
      () => getClient().execute(
        "UPDATE frigora_quotation_versions SET distance_basis = 'return' WHERE version_number = 1",
      ),
      /immutable/,
    );
    await assert.rejects(
      () => getClient().execute({
        sql: `INSERT INTO frigora_quotation_versions (
          quotation_id, workspace_id, venture_id, version_number, status, description,
          total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref
        ) VALUES (?, ?, ?, 9, 'approved', 'bypass', 100, 'ZAR', 'hash', NULL, NULL, NULL)`,
        args: [draft.id, draft.workspaceId, draft.ventureId],
      }),
      /cannot be inserted directly/,
    );
  });

  it("preserves the sent version when a revision starts and rejects a stale concurrent revision", async () => {
    const owner = await seed();
    const { recommendation } = await seedRecommendation(owner);
    const draft = await owner.service.createQuotation(owner.scope, quoteInput(recommendation.id));
    const sent = await owner.service.sendQuotation(owner.scope, draft.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    const [first, second] = await Promise.allSettled([
      owner.service.reviseQuotation(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        description: "Discounted compressor replacement",
        commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
      }),
      owner.service.reviseQuotation(owner.scope, sent.id, {
        expectedCurrentVersion: 1,
        description: "Competing revision",
        commercial: exampleQuotationCommercial({ travelRateMinor: 3000 }),
      }),
    ]);
    const fulfilled = [first, second].filter((result) => result.status === "fulfilled");
    const rejected = [first, second].filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    const rejection = rejected[0];
    assert.ok(rejection && rejection.status === "rejected");
    assert.ok(rejection.reason instanceof FrigoraError, String(rejection.reason));
    assert.equal(rejection.reason.code, "quotation_conflict");
    const stored = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(stored?.currentVersion, 2);
    assert.equal(stored?.versions.length, 2);
    assert.equal(stored?.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(stored?.versions[0]?.totalMinor, 1495000);
    assert.equal(stored?.versions[0]?.documentHash, sent.versions[0]?.documentHash);
    assert.equal(stored?.versions[1]?.status, "in_preparation");
    assert.equal(stored?.versions[1] ? "decision" in stored.versions[1] : false, false);
    assert.equal(
      stored?.versions[1]?.documentHash,
      quotationDocumentHash({
        version: 2,
        description: stored?.versions[1]?.description ?? "",
        ...(stored?.versions[1]?.commercial ?? priceQuotationCommercial(exampleQuotationCommercial())),
      }),
    );
    assert.notEqual(stored?.versions[1]?.documentHash, stored?.versions[0]?.documentHash);
  });

  it("rejects a duplicate event id and rolls the partial quotation back", async () => {
    const owner = await seed();
    const { recommendation, customer, site, workOrder, asset } = await seedRecommendation(owner);
    const quote = await owner.service.createQuotation(owner.scope, quoteInput(recommendation.id));
    const eventId = quote.events[0]?.id;
    assert.ok(eventId);
    await expectCode(
      () => owner.store.commitQuotationCreate({
        id: "quote-duplicate-event" as FrigoraQuotationId,
        workspaceId: owner.workspaceId,
        ventureId: owner.ventureId,
        customerId: customer.id,
        siteId: site.id,
        assetId: asset.id,
        originalWorkOrderId: workOrder.id,
        recommendedActionId: recommendation.id,
        createdAt: NOW,
        description: "Replace compressor",
        commercial: quote.versions[0]!.commercial,
        totalMinor: 1495000,
        documentHash: quote.versions[0]?.documentHash ?? "",
        eventId,
        actorUserId: owner.userId,
      }),
      "duplicate",
    );
    assert.equal(await owner.service.getQuotation(owner.scope, "quote-duplicate-event" as FrigoraQuotationId), null);
    assert.equal((await owner.service.getQuotation(owner.scope, quote.id))?.events.length, 1);
  });

  it("rejects unauthorised office writes", async () => {
    const owner = await seed();
    const { recommendation } = await seedRecommendation(owner);
    const memberId = "user-clerk" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    const memberScope = { ...owner.scope, userId: memberId };
    await expectCode(
      () => owner.service.createQuotation(memberScope, quoteInput(recommendation.id)),
      "forbidden",
    );
    const quote = await owner.service.createQuotation(owner.scope, quoteInput(recommendation.id));
    const beforeHash = quote.versions[0]?.documentHash;
    await expectCode(
      () => owner.service.correctQuotation(memberScope, quote.id, {
        expectedCurrentVersion: 1,
        description: "Unauthorised correction",
        commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
      }),
      "forbidden",
    );
    assert.equal(
      (await owner.service.getQuotation(owner.scope, quote.id))?.versions[0]?.documentHash,
      beforeHash,
    );
    await expectCode(
      () => owner.service.sendQuotation(memberScope, quote.id, {
        expectedCurrentVersion: 1,
        recipient: "client@example.test",
      }),
      "forbidden",
    );
    await expectCode(
      () => owner.service.reviseQuotation(memberScope, quote.id, {
        expectedCurrentVersion: 1,
        description: "Should not revise",
        commercial: exampleQuotationCommercial({
          labourQuantityMilli: 1,
          travelKilometresMilli: 0,
          travelRateMinor: 0,
        }),
      }),
      "forbidden",
    );
  });

  it("rolls back a quotation create when the event insert fails", async () => {
    const owner = await seed();
    const { recommendation } = await seedRecommendation(owner);
    await getClient().execute(`
      CREATE TRIGGER quote_event_fail
      BEFORE INSERT ON frigora_quotation_events
      BEGIN
        SELECT RAISE(ABORT, 'forced quotation failure');
      END
    `);
    await assert.rejects(
      () => owner.service.createQuotation(owner.scope, quoteInput(recommendation.id)),
      /forced quotation failure/,
    );
    const rows = await getClient().execute("SELECT id FROM frigora_quotations");
    assert.equal(rows.rows.length, 0);
    const versions = await getClient().execute("SELECT quotation_id FROM frigora_quotation_versions");
    assert.equal(versions.rows.length, 0);
  });

  it("upgrades a generation-32 database without losing existing rows", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frigora-quote-33-"));
    const url = `file:${join(directory, "generation-32.db").replaceAll("\\", "/")}`;
    try {
      await resetPersistenceLifecycle(url);
      await ensureSchema();
      const owner = await seed({ reset: false });
      const customer = await owner.service.createCustomer(owner.scope, {
        code: "KEEP",
        displayName: "Kept Customer",
      });
      await getClient().execute("DROP TABLE frigora_quotation_events");
      await getClient().execute("DROP TABLE frigora_quotation_versions");
      await getClient().execute("DROP TABLE frigora_quotations");
      const removed = await getClient().execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotations'",
      );
      assert.equal(removed.rows.length, 0);
      await resetPersistenceLifecycle(url);
      await ensureSchema();
      const kept = await getClient().execute({
        sql: "SELECT id FROM frigora_customers WHERE id = ?",
        args: [customer.id],
      });
      assert.equal(kept.rows.length, 1);
      const tables = await getClient().execute(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (
          'frigora_quotations', 'frigora_quotation_versions', 'frigora_quotation_events'
        ) ORDER BY name`,
      );
      assert.deepEqual(
        tables.rows.map((row) => String(row.name)),
        ["frigora_quotation_events", "frigora_quotation_versions", "frigora_quotations"],
      );
      const dbPath = fileURLToPath(new URL("../../platform/persistence/db.ts", import.meta.url));
      assert.match(readFileSync(dbPath, "utf8"), /SCHEMA_GENERATION = 40/);
    } finally {
      await resetPersistenceLifecycle();
      await rm(directory, { recursive: true, force: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EBUSY" && error.code !== "EPERM" && error.code !== "ENOENT") {
          throw error;
        }
      });
    }
  });

  it("refuses an IMP-01A assurance_evaluations database as quotation generation 33", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frigora-quote-imp01a-"));
    const url = `file:${join(directory, "imp01a.db").replaceAll("\\", "/")}`;
    try {
      await resetPersistenceLifecycle(url);
      await getClient().execute("CREATE TABLE assurance_evaluations (id TEXT PRIMARY KEY)");
      await assert.rejects(() => ensureSchema(), new RegExp(IMP01A_ALTERNATIVE_SCHEMA_ERROR));
      const quotations = await getClient().execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'frigora_quotations'",
      );
      assert.equal(quotations.rows.length, 0);
    } finally {
      await resetPersistenceLifecycle();
      await rm(directory, { recursive: true, force: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EBUSY" && error.code !== "EPERM" && error.code !== "ENOENT") {
          throw error;
        }
      });
    }
  });
});
