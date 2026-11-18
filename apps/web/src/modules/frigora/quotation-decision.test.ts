import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getClient, getDatabaseUrl } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { FrigoraError } from "./errors";
import { FrigoraMailDeliveryError } from "./mail";
import { exampleQuotationCommercial, priceQuotationCommercial } from "./quotation-commercial";
import { quotationDocumentHash } from "./quotation-workflow";
import { createFrigoraService } from "./service";
import { createFrigoraStore } from "./store";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import type { FrigoraCustomerId, FrigoraScope, FrigoraSiteId, QuotationDecisionGrantDelivery } from "./types";

const NOW = "2026-10-24T08:00:00.000Z";
const ARRIVED = "2026-10-24T08:05:00.000Z";
const RECOMMENDED_AT = "2026-10-24T08:20:00.000Z";
const ISSUED_AT = "2026-10-24T12:00:00.000Z";

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
  now?: () => string;
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
    ventureRow({ id: ventureId, workspaceId, slug: `venture-${ventureId}` }),
  );
  const store = createFrigoraStore();
  return {
    workspaceId,
    ventureId,
    userId,
    store,
    scope: { userId, workspaceId, ventureId } satisfies FrigoraScope,
    service: createFrigoraService({
      store,
      permissions: createPermissionService(createDbMembershipStore()),
      now: options.now,
    }),
  };
}

async function seedSentQuotation(owner: Awaited<ReturnType<typeof seed>>) {
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
  const draft = await owner.service.createQuotation(owner.scope, {
    recommendedActionId: recommendation.id,
    description: "Replace compressor",
    commercial: exampleQuotationCommercial(),
  });
  await allowSyntheticNotRegisteredQuotationSend(owner.service, owner.scope);
  const sent = await owner.service.sendQuotation(owner.scope, draft.id, {
    expectedCurrentVersion: 1,
    recipient: "accounts@fuelco.test",
  });
  return { customer, site, asset, workOrder, sent };
}

function captureDelivery() {
  const secrets: string[] = [];
  const delivery: QuotationDecisionGrantDelivery = {
    async deliver(proof) {
      secrets.push(proof.secret);
    },
  };
  return { secrets, delivery };
}

async function expectCode(run: () => Promise<unknown>, code: FrigoraError["code"]) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof FrigoraError, String(error));
    assert.equal(error.code, code, error.message);
    return true;
  });
}

function databaseText() {
  const url = getDatabaseUrl();
  const path = url.startsWith("file:") ? url.slice("file:".length) : url;
  return [path, `${path}-wal`, `${path}-shm`]
    .filter((candidate) => existsSync(candidate))
    .map((candidate) => readFileSync(candidate));
}

async function issueGrant(
  owner: Awaited<ReturnType<typeof seed>>,
  quotationId: Awaited<ReturnType<typeof seedSentQuotation>>["sent"]["id"],
  version = 1,
) {
  const captured = captureDelivery();
  const grant = await owner.service.issueQuotationDecisionGrant(
    owner.scope,
    quotationId,
    { expectedCurrentVersion: version },
    captured.delivery,
  );
  const secret = captured.secrets[0];
  assert.ok(secret);
  return { grant, secret };
}

describe("Frigora quotation customer decision", () => {
  it("issues a grant for the current sent version and keeps the secret out of storage and logs", async () => {
    const owner = await seed();
    const { customer, site, sent } = await seedSentQuotation(owner);
    const seen: string[] = [];
    const methods = ["log", "info", "warn", "error", "debug"] as const;
    const originals = methods.map((method) => console[method].bind(console));
    for (const method of methods) {
      console[method] = ((...args: unknown[]) => {
        seen.push(args.map((arg) => String(arg)).join(" "));
      }) as typeof console.log;
    }
    let grant: Awaited<ReturnType<typeof issueGrant>>["grant"];
    let secret = "";
    try {
      const issued = await issueGrant(owner, sent.id);
      grant = issued.grant;
      secret = issued.secret;
    } finally {
      methods.forEach((method, index) => {
        console[method] = originals[index] as typeof console.log;
      });
    }
    assert.equal(grant.version, 1);
    assert.equal(grant.quotationId, sent.id);
    assert.equal(grant.customerId, customer.id);
    assert.equal(grant.siteId, site.id);
    assert.equal(grant.issuedByUserId, owner.userId);
    assert.equal(grant.documentHash, sent.versions[0]?.documentHash);
    assert.equal(grant.consumedAt, null);
    assert.equal(JSON.stringify(grant).includes(secret), false);
    assert.equal(seen.some((line) => line.includes(secret)), false);
    assert.equal(databaseText().some((bytes) => bytes.includes(Buffer.from(secret))), false);
    const stored = await getClient().execute("SELECT secret_hash, consumed_at FROM frigora_quotation_decision_grants");
    assert.equal(stored.rows.length, 1);
    assert.notEqual(String(stored.rows[0]?.secret_hash), secret);
    assert.equal(stored.rows[0]?.consumed_at, null);
    await expectCode(
      () => owner.service.issueQuotationDecisionGrant(owner.scope, sent.id, { expectedCurrentVersion: 2 }, captureDelivery().delivery),
      "quotation_conflict",
    );
    const draftOwner = await seed();
    const recommendation = await seedSentQuotation(draftOwner);
    const draft = await draftOwner.service.createQuotation(draftOwner.scope, {
      recommendedActionId: recommendation.sent.recommendedActionId,
      description: "Second draft",
      commercial: exampleQuotationCommercial({
        labourQuantityMilli: 1,
        travelKilometresMilli: 0,
        travelRateMinor: 0,
      }),
    });
    await expectCode(
      () => draftOwner.service.issueQuotationDecisionGrant(
        draftOwner.scope,
        draft.id,
        { expectedCurrentVersion: 1 },
        captureDelivery().delivery,
      ),
      "invalid_status",
    );
  });

  it("rejects grants for another workspace and office writes without venture.update", async () => {
    const owner = await seed();
    const { sent } = await seedSentQuotation(owner);
    const other = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: "user-other" as UserId,
    });
    await expectCode(
      () => other.service.issueQuotationDecisionGrant(
        other.scope,
        sent.id,
        { expectedCurrentVersion: 1 },
        captureDelivery().delivery,
      ),
      "not_found",
    );
    const memberId = "user-clerk" as UserId;
    await getPersistence().memberships.setRole({
      userId: memberId,
      workspaceId: owner.workspaceId,
      role: "member",
      createdAt: NOW,
    });
    await expectCode(
      () => owner.service.issueQuotationDecisionGrant(
        { ...owner.scope, userId: memberId },
        sent.id,
        { expectedCurrentVersion: 1 },
        captureDelivery().delivery,
      ),
      "forbidden",
    );
  });

  it("approves and declines through a bearer grant without a caller authority flag", async () => {
    const approvedOwner = await seed();
    const approvedSeed = await seedSentQuotation(approvedOwner);
    const approvedGrant = await issueGrant(approvedOwner, approvedSeed.sent.id);
    await expectCode(
      () => approvedOwner.service.submitQuotationDecision(approvedOwner.scope, approvedSeed.sent.id, {
        grantId: approvedGrant.grant.id,
        secret: approvedGrant.secret,
        decision: "approved",
        customerId: approvedSeed.customer.id,
        siteId: approvedSeed.site.id,
        customerAuthorityVerified: true,
      } as never),
      "invalid_input",
    );
    const workOrdersBefore = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_work_orders");
    const approved = await approvedOwner.service.submitQuotationDecision(
      approvedOwner.scope,
      approvedSeed.sent.id,
      {
        grantId: approvedGrant.grant.id,
        secret: approvedGrant.secret,
        decision: "approved",
        customerId: approvedSeed.customer.id,
        siteId: approvedSeed.site.id,
      },
    );
    assert.equal(approved.versions[0]?.status, "approved");
    assert.equal(approved.decisions.length, 1);
    assert.equal(approved.decisions[0]?.decision, "approved");
    assert.equal(approved.decisions[0]?.documentHash, approvedSeed.sent.versions[0]?.documentHash);
    assert.equal(approved.events.some((event) => event.kind === "approved"), true);
    assert.equal(approved.versions[0]?.totalMinor, 1495000);
    const workOrdersAfter = await getClient().execute("SELECT COUNT(*) AS n FROM frigora_work_orders");
    assert.equal(Number(workOrdersAfter.rows[0]?.n), Number(workOrdersBefore.rows[0]?.n));
    const declinedOwner = await seed();
    const declinedSeed = await seedSentQuotation(declinedOwner);
    const declinedGrant = await issueGrant(declinedOwner, declinedSeed.sent.id);
    const stranger: FrigoraScope = { ...declinedOwner.scope, userId: "user-nobody" as UserId };
    const declined = await declinedOwner.service.submitQuotationDecision(stranger, declinedSeed.sent.id, {
      grantId: declinedGrant.grant.id,
      secret: declinedGrant.secret,
      decision: "declined",
      customerId: declinedSeed.customer.id,
      siteId: declinedSeed.site.id,
    });
    assert.equal(declined.versions[0]?.status, "declined");
    assert.equal(declined.decisions[0]?.decision, "declined");
    assert.equal(declined.events.some((event) => event.kind === "declined"), true);
  });

  it("rejects expired, consumed, invalid, and replayed grants", async () => {
    let current = ISSUED_AT;
    const owner = await seed({ now: () => current });
    const { customer, site, sent } = await seedSentQuotation(owner);
    const expired = await issueGrant(owner, sent.id);
    current = "2026-11-02T12:00:00.000Z";
    await expectCode(
      () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: expired.grant.id,
        secret: expired.secret,
        decision: "approved",
        customerId: customer.id,
        siteId: site.id,
      }),
      "decision_rejected",
    );
    current = ISSUED_AT;
    const first = await issueGrant(owner, sent.id);
    await owner.service.submitQuotationDecision(owner.scope, sent.id, {
      grantId: first.grant.id,
      secret: first.secret,
      decision: "approved",
      customerId: customer.id,
      siteId: site.id,
    });
    await expectCode(
      () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: first.grant.id,
        secret: first.secret,
        decision: "declined",
        customerId: customer.id,
        siteId: site.id,
      }),
      "decision_rejected",
    );
    const fresh = await seed();
    const freshSeed = await seedSentQuotation(fresh);
    const grant = await issueGrant(fresh, freshSeed.sent.id);
    await expectCode(
      () => fresh.service.submitQuotationDecision(fresh.scope, freshSeed.sent.id, {
        grantId: grant.grant.id,
        secret: "not-the-secret",
        decision: "approved",
        customerId: freshSeed.customer.id,
        siteId: freshSeed.site.id,
      }),
      "decision_rejected",
    );
    assert.equal((await fresh.service.getQuotation(fresh.scope, freshSeed.sent.id))?.versions[0]?.status, "awaiting_customer_approval");
  });

  it("rejects a stale version, a version no longer awaiting approval, and a tampered document hash", async () => {
    const owner = await seed();
    const { customer, site, sent } = await seedSentQuotation(owner);
    const grant = await issueGrant(owner, sent.id);
    const revised = await owner.service.reviseQuotation(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      description: "Revised compressor replacement",
      commercial: exampleQuotationCommercial({ travelRateMinor: 2500 }),
    });
    await expectCode(
      () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: grant.grant.id,
        secret: grant.secret,
        decision: "approved",
        customerId: customer.id,
        siteId: site.id,
      }),
      "quotation_conflict",
    );
    assert.equal(revised.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(revised.versions[1]?.status, "in_preparation");
    assert.equal(revised.decisions.length, 0);
    const decided = await seed();
    const decidedSeed = await seedSentQuotation(decided);
    const used = await issueGrant(decided, decidedSeed.sent.id);
    const second = await issueGrant(decided, decidedSeed.sent.id);
    await decided.service.submitQuotationDecision(decided.scope, decidedSeed.sent.id, {
      grantId: used.grant.id,
      secret: used.secret,
      decision: "approved",
      customerId: decidedSeed.customer.id,
      siteId: decidedSeed.site.id,
    });
    await expectCode(
      () => decided.service.submitQuotationDecision(decided.scope, decidedSeed.sent.id, {
        grantId: second.grant.id,
        secret: second.secret,
        decision: "declined",
        customerId: decidedSeed.customer.id,
        siteId: decidedSeed.site.id,
      }),
      "invalid_status",
    );
    const tamper = await seed();
    const tamperSeed = await seedSentQuotation(tamper);
    const tampered = await issueGrant(tamper, tamperSeed.sent.id);
    await getClient().execute("DROP TRIGGER frigora_quotation_decision_grants_consume_only");
    await getClient().execute({
      sql: "UPDATE frigora_quotation_decision_grants SET document_hash = ? WHERE id = ?",
      args: ["tampered-hash", tampered.grant.id],
    });
    await expectCode(
      () => tamper.service.submitQuotationDecision(tamper.scope, tamperSeed.sent.id, {
        grantId: tampered.grant.id,
        secret: tampered.secret,
        decision: "approved",
        customerId: tamperSeed.customer.id,
        siteId: tamperSeed.site.id,
      }),
      "decision_rejected",
    );
    assert.equal(
      (await tamper.service.getQuotation(tamper.scope, tamperSeed.sent.id))?.versions[0]?.status,
      "awaiting_customer_approval",
    );
  });

  it("rejects the wrong customer, site, workspace, or venture", async () => {
    const owner = await seed();
    const { customer, site, sent } = await seedSentQuotation(owner);
    const grant = await issueGrant(owner, sent.id);
    await expectCode(
      () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: grant.grant.id,
        secret: grant.secret,
        decision: "approved",
        customerId: "customer-other" as FrigoraCustomerId,
        siteId: site.id,
      }),
      "decision_rejected",
    );
    await expectCode(
      () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: grant.grant.id,
        secret: grant.secret,
        decision: "approved",
        customerId: customer.id,
        siteId: "site-other" as FrigoraSiteId,
      }),
      "decision_rejected",
    );
    const other = await seed({
      reset: false,
      workspaceId: "ws-other" as WorkspaceId,
      ventureId: "ven-other" as VentureId,
      userId: "user-other" as UserId,
    });
    await expectCode(
      () => other.service.submitQuotationDecision(other.scope, sent.id, {
        grantId: grant.grant.id,
        secret: grant.secret,
        decision: "approved",
        customerId: customer.id,
        siteId: site.id,
      }),
      "decision_rejected",
    );
    await expectCode(
      () => owner.service.submitQuotationDecision(
        { ...owner.scope, ventureId: "ven-missing" as VentureId },
        sent.id,
        {
          grantId: grant.grant.id,
          secret: grant.secret,
          decision: "approved",
          customerId: customer.id,
          siteId: site.id,
        },
      ),
      "not_found",
    );
    assert.equal((await owner.service.getQuotation(owner.scope, sent.id))?.versions[0]?.status, "awaiting_customer_approval");
  });

  it("accepts only one concurrent decision and preserves the sent commercial history", async () => {
    const owner = await seed();
    const { customer, site, sent } = await seedSentQuotation(owner);
    const first = await issueGrant(owner, sent.id);
    const second = await issueGrant(owner, sent.id);
    const [left, right] = await Promise.allSettled([
      owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: first.grant.id,
        secret: first.secret,
        decision: "approved",
        customerId: customer.id,
        siteId: site.id,
      }),
      owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: second.grant.id,
        secret: second.secret,
        decision: "approved",
        customerId: customer.id,
        siteId: site.id,
      }),
    ]);
    const fulfilled = [left, right].filter((result) => result.status === "fulfilled");
    assert.equal(fulfilled.length, 1);
    const stored = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(stored?.decisions.length, 1);
    assert.equal(stored?.versions[0]?.status, "approved");
    assert.equal(stored?.versions[0]?.documentHash, quotationDocumentHash({
      version: 1,
      description: "Replace compressor",
      ...priceQuotationCommercial(exampleQuotationCommercial()),
    }));
    const grants = await getClient().execute("SELECT consumed_at FROM frigora_quotation_decision_grants");
    assert.equal(grants.rows.filter((row) => row.consumed_at != null).length, 1);
    await assert.rejects(
      () => getClient().execute("UPDATE frigora_quotation_versions SET total_minor = 1 WHERE version_number = 1"),
      /immutable/,
    );
    const revised = await owner.service.reviseQuotation(owner.scope, sent.id, {
      expectedCurrentVersion: 1,
      description: "Replacement after decline of the old price",
      commercial: exampleQuotationCommercial({
        labourQuantityMilli: 9900,
        travelKilometresMilli: 0,
        travelRateMinor: 0,
      }),
    });
    assert.equal(revised.versions[0]?.status, "approved");
    assert.equal(revised.versions[1]?.status, "in_preparation");
    assert.equal(revised.decisions.length, 1);
    assert.equal(revised.decisions[0]?.version, 1);
  });

  it("rolls back the decision, status, event, and grant consumption together", async () => {
    const owner = await seed();
    const { customer, site, sent } = await seedSentQuotation(owner);
    const grant = await issueGrant(owner, sent.id);
    await getClient().execute(`
      CREATE TRIGGER decision_event_fail
      BEFORE INSERT ON frigora_quotation_events
      WHEN NEW.kind IN ('approved', 'declined')
      BEGIN
        SELECT RAISE(ABORT, 'forced decision failure');
      END
    `);
    await assert.rejects(
      () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: grant.grant.id,
        secret: grant.secret,
        decision: "approved",
        customerId: customer.id,
        siteId: site.id,
      }),
      /forced decision failure/,
    );
    const stored = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(stored?.versions[0]?.status, "awaiting_customer_approval");
    assert.equal(stored?.decisions.length, 0);
    assert.equal(stored?.events.some((event) => event.kind === "approved"), false);
    const grants = await getClient().execute("SELECT consumed_at FROM frigora_quotation_decision_grants");
    assert.equal(grants.rows[0]?.consumed_at, null);
  });

  it("drops a failed delivery without returning or storing the plaintext secret", async () => {
    const owner = await seed();
    const { sent } = await seedSentQuotation(owner);
    let secret = "";
    await assert.rejects(
      () => owner.service.issueQuotationDecisionGrant(owner.scope, sent.id, { expectedCurrentVersion: 1 }, {
        async deliver(proof) {
          secret = proof.secret;
          throw new Error(proof.secret);
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "customer_delivery_unavailable");
        assert.equal(error.message.includes(secret), false);
        return true;
      },
    );
    assert.ok(secret);
    assert.equal(databaseText().some((bytes) => bytes.includes(Buffer.from(secret))), false);
    const grants = await getClient().execute(
      "SELECT id, consumed_at, revoked_at FROM frigora_quotation_decision_grants",
    );
    assert.equal(grants.rows.length, 1);
    assert.equal(grants.rows[0]?.consumed_at, null);
    assert.equal(typeof grants.rows[0]?.revoked_at, "string");
    const stored = await owner.service.getQuotation(owner.scope, sent.id);
    assert.equal(stored?.versions[0]?.status, "awaiting_customer_approval");
    await expectCode(
      () => owner.service.submitQuotationDecision(owner.scope, sent.id, {
        grantId: String(grants.rows[0]?.id),
        secret,
        decision: "approved",
        customerId: sent.customerId,
        siteId: sent.siteId,
      }),
      "decision_rejected",
    );
    const audits = await getClient().execute("SELECT metadata_json FROM audit_events");
    assert.equal(audits.rows.some((row) => String(row.metadata_json).includes(secret)), false);
  });

  it("records provider rejection without calling it inbox delivery", async () => {
    const owner = await seed();
    const { sent } = await seedSentQuotation(owner);
    await assert.rejects(
      () => owner.service.issueQuotationDecisionGrant(owner.scope, sent.id, { expectedCurrentVersion: 1 }, {
        async deliver() {
          throw new FrigoraMailDeliveryError("rejected");
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "delivery_failed");
        assert.match(error.message, /rejected the message/);
        assert.match(error.message, /is revoked/);
        assert.match(error.message, /failure record was saved/);
        assert.match(error.message, /not inbox delivery/);
        return true;
      },
    );
    const grants = await getClient().execute("SELECT revoked_at FROM frigora_quotation_decision_grants");
    assert.equal(typeof grants.rows[0]?.revoked_at, "string");
    const audits = await getClient().execute(
      "SELECT action FROM audit_events WHERE action = 'frigora.quotation.decision_grant_delivery_failed'",
    );
    assert.equal(audits.rows.length, 1);
  });

  it("does not claim revocation when the failure record cannot be saved", async () => {
    const owner = await seed();
    const { sent } = await seedSentQuotation(owner);
    await getClient().execute(`
      CREATE TRIGGER delivery_failure_audit_fail
      BEFORE INSERT ON audit_events
      WHEN NEW.action = 'frigora.quotation.decision_grant_delivery_failed'
      BEGIN
        SELECT RAISE(ABORT, 'forced delivery failure audit');
      END
    `);
    await assert.rejects(
      () => owner.service.issueQuotationDecisionGrant(owner.scope, sent.id, { expectedCurrentVersion: 1 }, {
        async deliver() {
          throw new FrigoraMailDeliveryError("unknown");
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof FrigoraError);
        assert.equal(error.code, "delivery_unknown");
        assert.match(error.message, /could not be revoked and may still be active/);
        assert.match(error.message, /failure record was not saved/);
        assert.match(error.message, /not sent again/);
        assert.equal(error.message.includes("is revoked"), false);
        return true;
      },
    );
    const grants = await getClient().execute("SELECT revoked_at, consumed_at FROM frigora_quotation_decision_grants");
    assert.equal(grants.rows[0]?.revoked_at, null);
    assert.equal(grants.rows[0]?.consumed_at, null);
  });

  it("revokes one grant once when two failure records are written together", async () => {
    const owner = await seed();
    const { sent } = await seedSentQuotation(owner);
    let grantId = "";
    await owner.service.issueQuotationDecisionGrant(owner.scope, sent.id, { expectedCurrentVersion: 1 }, {
      async deliver(proof) {
        grantId = proof.grantId;
      },
    });
    const store = createFrigoraStore();
    const input = {
      id: grantId as never,
      workspaceId: owner.scope.workspaceId,
      ventureId: owner.scope.ventureId,
      revokedAt: ISSUED_AT,
      deliveryFailure: {
        outcome: "unknown" as const,
        actorUserId: owner.scope.userId,
      },
    };
    await Promise.allSettled([
      store.revokeQuotationDecisionGrant(input),
      store.revokeQuotationDecisionGrant(input),
    ]);
    const grants = await getClient().execute("SELECT revoked_at FROM frigora_quotation_decision_grants");
    assert.equal(typeof grants.rows[0]?.revoked_at, "string");
    const audits = await getClient().execute(
      "SELECT id FROM audit_events WHERE action = 'frigora.quotation.decision_grant_delivery_failed'",
    );
    assert.equal(audits.rows.length >= 1, true);
  });

  it("widens a narrow generation-33 status check without losing customer or version rows", async () => {
    const directory = await mkdtemp(join(tmpdir(), "frigora-quote-decision-"));
    const url = `file:${join(directory, "narrow-check.db").replaceAll("\\", "/")}`;
    try {
      await resetPersistenceLifecycle(url);
      await ensureSchema();
      const owner = await seed({ reset: false });
      const customer = await owner.service.createCustomer(owner.scope, {
        code: "KEEP",
        displayName: "Kept Customer",
      });
      await getClient().execute("DROP TABLE frigora_quotation_versions");
      await getClient().execute(`
        CREATE TABLE frigora_quotation_versions (
          quotation_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('in_preparation', 'awaiting_customer_approval')),
          description TEXT NOT NULL,
          total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
          currency TEXT NOT NULL CHECK (currency = 'ZAR'),
          document_hash TEXT NOT NULL,
          sent_at TEXT,
          recipient TEXT,
          dispatch_evidence_ref TEXT,
          PRIMARY KEY (quotation_id, version_number)
        )
      `);
      await getClient().execute({
        sql: `INSERT INTO frigora_quotation_versions (
          quotation_id, workspace_id, venture_id, version_number, status, description,
          total_minor, currency, document_hash, sent_at, recipient, dispatch_evidence_ref
        ) VALUES ('quote-keep', ?, ?, 1, 'in_preparation', 'keep the words', 2500, 'ZAR', 'hash-keep', NULL, NULL, NULL)`,
        args: [owner.workspaceId, owner.ventureId],
      });
      await getClient().execute("DROP TABLE frigora_quotation_events");
      await getClient().execute(`
        CREATE TABLE frigora_quotation_events (
          id TEXT PRIMARY KEY,
          quotation_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          venture_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          kind TEXT NOT NULL CHECK (kind IN ('created', 'sent', 'revision_started')),
          occurred_at TEXT NOT NULL,
          actor_user_id TEXT NOT NULL,
          evidence_ref TEXT
        )
      `);
      await getClient().execute({
        sql: `INSERT INTO frigora_quotation_events (
          id, quotation_id, workspace_id, venture_id, version_number, kind, occurred_at, actor_user_id, evidence_ref
        ) VALUES ('event-keep', 'quote-keep', ?, ?, 1, 'created', ?, 'user-owner', NULL)`,
        args: [owner.workspaceId, owner.ventureId, NOW],
      });
      await resetPersistenceLifecycle(url);
      await ensureSchema();
      const keptCustomer = await getClient().execute({
        sql: "SELECT id FROM frigora_customers WHERE id = ?",
        args: [customer.id],
      });
      const keptVersion = await getClient().execute(
        "SELECT description, status, labour_quantity_milli FROM frigora_quotation_versions WHERE quotation_id = 'quote-keep'",
      );
      const keptEvent = await getClient().execute(
        "SELECT kind FROM frigora_quotation_events WHERE id = 'event-keep'",
      );
      assert.equal(keptCustomer.rows.length, 1);
      assert.equal(String(keptVersion.rows[0]?.description), "keep the words");
      assert.equal(String(keptVersion.rows[0]?.status), "in_preparation");
      assert.equal(keptVersion.rows[0]?.labour_quantity_milli ?? null, null);
      assert.equal(String(keptEvent.rows[0]?.kind), "created");
      const ddl = await getClient().execute(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name IN ('frigora_quotation_versions', 'frigora_quotation_events')",
      );
      const sql = ddl.rows.map((row) => String(row.sql)).join("\n");
      assert.match(sql, /labour_quantity_milli/);
      assert.match(sql, /'approved'/);
      assert.match(sql, /'declined'/);
      assert.doesNotMatch(sql, /expired|superseded/);
      await assert.rejects(
        () => getClient().execute(
          "INSERT INTO frigora_quotation_versions (quotation_id, workspace_id, venture_id, version_number, status, description, total_minor, currency, document_hash) VALUES ('quote-bypass', 'ws', 'ven', 1, 'approved', 'bypass', 1, 'ZAR', 'hash')",
        ),
        /cannot be inserted directly/,
      );
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
