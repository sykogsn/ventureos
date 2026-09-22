import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { frigoraClientOperationReceipts, frigoraTechnicalFindings } from "@/platform/persistence/schema";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { eq } from "drizzle-orm";
import { fingerprintTechnicalFindingRequest } from "@/modules/frigora/client-operation-fingerprint";
import { FrigoraError } from "@/modules/frigora/errors";
import { createFrigoraService } from "@/modules/frigora/service";
import { closeFrigoraPersistenceAfterFile } from "@/modules/frigora/test-persistence-lifecycle";
import type { FrigoraScope } from "@/modules/frigora/types";
import {
  FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED,
  FRIGORA_OFFLINE_DB_VERSION,
  FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST,
  applyTechnicalFindingLocalSubmitOutcome,
  captureTechnicalFindingOffline,
  createClientOperationId,
  createMemoryOfflineBackend,
  createOfflineLease,
  isFrigoraOfflineCaptureOperationAllowed,
  openFrigoraOfflineStore,
  prepareTechnicalFindingExplicitRetry,
  refuseOfflineLeaseSelfExtension,
  resetMemoryOfflineDatabasesForTests,
} from "@/modules/frigora/app/offline";
import { shouldBlockFrigoraFieldMutation } from "@/modules/frigora/app/pwa/connectivity";

const NOW = "2026-09-16T08:00:00.000Z";
const ARRIVED = "2026-09-16T09:00:00.000Z";
const ASSERTED = "2026-09-16T09:20:00.000Z";

const here = dirname(fileURLToPath(import.meta.url));

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
  resetMemoryOfflineDatabasesForTests();
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
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  userId?: UserId;
  role?: Role;
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

async function addMember(workspaceId: WorkspaceId, userId: UserId) {
  await getPersistence().memberships.setRole({
    userId,
    workspaceId,
    role: "member",
    createdAt: NOW,
  });
}

async function seedAssignedVisit(owner: Awaited<ReturnType<typeof seed>>, engineerId: UserId) {
  await addMember(owner.workspaceId, engineerId);
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
    workReference: "WO-F33-03",
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "warm case",
  });
  await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
    userId: engineerId,
  });
  const engineerScope: FrigoraScope = {
    userId: engineerId,
    workspaceId: owner.workspaceId,
    ventureId: owner.ventureId,
  };
  const visit = await owner.service.recordVisitArrival(engineerScope, workOrder.id, {
    userId: engineerId,
    arrivedAt: ARRIVED,
  });
  return { workOrder, visit, asset, engineerScope };
}

describe("F33-03 technical finding local capture + idempotent explicit acceptance", () => {
  it("A. SCHEMA_GENERATION is 28 and receipt uniqueness exists", async () => {
    const dbSource = readFileSync(join(here, "../../../../platform/persistence/db.ts"), "utf8");
    assert.match(dbSource, /SCHEMA_GENERATION = 28/);
    assert.match(dbSource, /frigora_client_operation_receipts/);
    assert.match(
      dbSource,
      /frigora_client_operation_receipts_venture_client_op_idx[\s\S]*venture_id, client_operation_id/,
    );
    assert.equal(FRIGORA_OFFLINE_DB_VERSION, 1);
    assert.equal(FRIGORA_FIELD_FORMS_OFFLINE_CAPTURE_ENABLED, false);
    assert.deepEqual(
      [...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST],
      ["recordTechnicalFinding", "recordFieldCapture", "recordVisitEvidence"],
    );
  });

  it("B/C. first acceptance + identical duplicate share entity and receipt", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const clientOperationId = "op-tf-identical-1";

    const first = await owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      findingKind: "symptom",
      description: "compressor click",
      assertedAt: ASSERTED,
      userId: engineerId,
    });
    assert.equal(first.duplicate, false);

    const second = await owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      findingKind: "symptom",
      description: "compressor click",
      assertedAt: ASSERTED,
      userId: engineerId,
    });
    assert.equal(second.duplicate, true);
    assert.equal(second.finding.id, first.finding.id);
    assert.equal(second.receipt.id, first.receipt.id);

    const findings = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findings.length, 1);

    const receipts = await getDb()
      .select()
      .from(frigoraClientOperationReceipts)
      .where(eq(frigoraClientOperationReceipts.clientOperationId, clientOperationId));
    assert.equal(receipts.length, 1);
  });

  it("D. same clientOperationId with altered payload is idempotency conflict", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const clientOperationId = "op-tf-mismatch-1";

    await owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      findingKind: "symptom",
      description: "original",
      assertedAt: ASSERTED,
      userId: engineerId,
    });

    await assert.rejects(
      () =>
        owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
          clientOperationId,
          workOrderId: workOrder.id,
          findingKind: "symptom",
          description: "altered",
          assertedAt: ASSERTED,
          userId: engineerId,
        }),
      (error: unknown) =>
        error instanceof FrigoraError && error.code === "idempotency_conflict",
    );

    const findings = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findings.length, 1);
  });

  it("E/N. offline local capture creates PENDING envelope without server insert and does not extend lease", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit } = await seedAssignedVisit(owner, engineerId);
    const partition = { ventureId: owner.ventureId, actorUserId: engineerId };
    const backend = createMemoryOfflineBackend({ dbName: "f33-03-capture" });
    const store = await openFrigoraOfflineStore({ backend });
    const lease = createOfflineLease(partition, { nowMs: Date.now() });
    await store.putLease(lease);
    await store.putWorkspaceSnapshot({
      snapshotId: "snap-1",
      ventureId: partition.ventureId,
      actorUserId: partition.actorUserId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      asOf: NOW,
      generation: 1,
      leaseId: lease.leaseId,
      payload: {
        workOrder: { id: workOrder.id, workReference: "WO-F33-03" },
        visit: { id: visit.id, status: "open" },
      },
    });

    const expiresBefore = lease.expiresAt;
    refuseOfflineLeaseSelfExtension(lease);
    const envelope = await captureTechnicalFindingOffline(
      {
        partition,
        workspaceId: owner.workspaceId,
        workOrderId: workOrder.id,
        visitId: visit.id,
        payload: {
          findingKind: "confirmed_fault",
          description: "saved locally only",
          assertedAt: ASSERTED,
        },
      },
      store,
    );
    assert.equal(envelope.syncState, "PENDING");
    assert.equal(envelope.operationType, "recordTechnicalFinding");
    const leaseAfter = await store.getLease(partition);
    assert.equal(leaseAfter?.expiresAt, expiresBefore);

    const findings = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findings.length, 0);
  });

  it("F. reconnect alone does not submit — no automatic drain primitive exists", () => {
    const captureSource = readFileSync(
      join(here, "technical-finding-capture.ts"),
      "utf8",
    );
    const connectivitySource = readFileSync(
      join(here, "../pwa/connectivity-banner.tsx"),
      "utf8",
    );
    assert.equal(captureSource.includes("addEventListener(\"online\""), false);
    assert.match(connectivitySource, /data-frigora-offline-capture/);
    assert.equal(connectivitySource.includes("submitClientTechnicalFinding"), false);
  });

  it("G. explicit submit path marks fingerprint and uses FrigoraService acceptance", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const clientOperationId = createClientOperationId();
    const fingerprint = fingerprintTechnicalFindingRequest({
      ventureId: owner.ventureId,
      actorUserId: engineerId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      findingKind: "suspected_fault",
      description: "possible leak",
      assertedAt: ASSERTED,
      userId: engineerId,
      assetId: null,
      sourceFieldCaptureIds: null,
    });

    const accepted = await owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
      clientOperationId,
      workOrderId: workOrder.id,
      findingKind: "suspected_fault",
      description: "possible leak",
      assertedAt: ASSERTED,
      userId: engineerId,
    });
    assert.equal(accepted.receipt.requestFingerprint, fingerprint);
    assert.equal(accepted.receipt.operationType, "recordTechnicalFinding");
    assert.equal(accepted.finding.description, "possible leak");
  });

  it("I. auth/partition mismatch blocks submission without insert", async () => {
    const owner = await seed();
    const engineerA = "user-engineer-a" as UserId;
    const engineerB = "user-engineer-b" as UserId;
    const { workOrder, visit } = await seedAssignedVisit(owner, engineerA);
    await addMember(owner.workspaceId, engineerB);
    const bScope: FrigoraScope = {
      userId: engineerB,
      workspaceId: owner.workspaceId,
      ventureId: owner.ventureId,
    };

    await assert.rejects(
      () =>
        owner.service.submitClientTechnicalFinding(bScope, visit.id, {
          clientOperationId: "op-tf-partition",
          workOrderId: workOrder.id,
          findingKind: "symptom",
          description: "should not insert",
          assertedAt: ASSERTED,
          userId: engineerA,
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "forbidden",
    );

    const findings = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findings.length, 0);
  });

  it("J. authority loss / reassignment rejects first acceptance", async () => {
    const owner = await seed();
    const engineerA = "user-engineer-a" as UserId;
    const engineerB = "user-engineer-b" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerA);
    await addMember(owner.workspaceId, engineerB);
    await owner.service.recordVisitDeparture(engineerScope, visit.id, {
      departedAt: "2026-09-16T10:00:00.000Z",
    });
    await owner.service.assignWorkOrder(owner.scope, workOrder.id, {
      userId: engineerB,
    });

    await assert.rejects(
      () =>
        owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
          clientOperationId: "op-tf-reassign",
          workOrderId: workOrder.id,
          findingKind: "symptom",
          description: "after reassignment",
          assertedAt: ASSERTED,
          userId: engineerA,
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "forbidden",
    );
  });

  it("K. cancelled visit rejects without acceptance receipt", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    await owner.service.cancelVisit(owner.scope, visit.id);

    await assert.rejects(
      () =>
        owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
          clientOperationId: "op-tf-cancelled",
          workOrderId: workOrder.id,
          findingKind: "symptom",
          description: "cancelled visit",
          assertedAt: ASSERTED,
          userId: engineerId,
        }),
      (error: unknown) => error instanceof FrigoraError && error.code === "invalid_status",
    );

    const receipts = await getDb().select().from(frigoraClientOperationReceipts);
    assert.equal(receipts.length, 0);
  });

  it("L. Engineer B cannot list Engineer A outbox mutations", async () => {
    const backend = createMemoryOfflineBackend({ dbName: "f33-03-partition" });
    const store = await openFrigoraOfflineStore({ backend });
    const partitionA = { ventureId: "ven-1", actorUserId: "eng-a" };
    const partitionB = { ventureId: "ven-1", actorUserId: "eng-b" };
    await store.enqueueMutation({
      ventureId: partitionA.ventureId,
      actorUserId: partitionA.actorUserId,
      workOrderId: "wo-1",
      visitId: "vis-1",
      operationType: "recordTechnicalFinding",
      payload: { description: "A only" },
    });
    const aOps = await store.listMutations(partitionA);
    const bOps = await store.listMutations(partitionB);
    assert.equal(aOps.length, 1);
    assert.equal(bOps.length, 0);
  });

  it("M. only the three allowlisted operations may bypass offline mutation block", () => {
    assert.deepEqual(
      [...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST],
      ["recordTechnicalFinding", "recordFieldCapture", "recordVisitEvidence"],
    );
    assert.equal(isFrigoraOfflineCaptureOperationAllowed("recordTechnicalFinding"), true);
    assert.equal(isFrigoraOfflineCaptureOperationAllowed("recordFieldCapture"), true);
    assert.equal(isFrigoraOfflineCaptureOperationAllowed("recordVisitEvidence"), true);
    assert.equal(isFrigoraOfflineCaptureOperationAllowed("recordPartUsage"), false);
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/v/work/wo/visit/vi", {
        operationType: "recordTechnicalFinding",
      }),
      false,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/v/work/wo/visit/vi", {
        operationType: "recordFieldCapture",
      }),
      false,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/v/work/wo/visit/vi", {
        operationType: "recordVisitEvidence",
      }),
      false,
    );
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, "/ventures/v/work/wo/visit/vi", {
        operationType: "recordVisitDeparture",
      }),
      true,
    );
    assert.equal(shouldBlockFrigoraFieldMutation(false, "/ventures/v/work/wo/visit/vi"), true);
  });

  it("O. Service Worker boundary still forbids business mutation drain language", () => {
    const sw = readFileSync(join(here, "../../../../../public/sw.js"), "utf8");
    assert.doesNotMatch(sw, /outbox|clientOperationId|submitClientTechnicalFinding/);
  });

  it("H. transient submit failure stays RETRYABLE_FAILURE then explicit retry reuses clientOperationId", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const partition = { ventureId: owner.ventureId, actorUserId: engineerId };
    const backend = createMemoryOfflineBackend({ dbName: "f33-03-retry" });
    const store = await openFrigoraOfflineStore({ backend });
    const lease = createOfflineLease(partition, { nowMs: Date.now() });
    await store.putLease(lease);
    await store.putWorkspaceSnapshot({
      snapshotId: "snap-retry",
      ventureId: partition.ventureId,
      actorUserId: partition.actorUserId,
      workOrderId: workOrder.id,
      visitId: visit.id,
      asOf: NOW,
      generation: 1,
      leaseId: lease.leaseId,
      payload: {
        workOrder: { id: workOrder.id, workReference: "WO-F33-03" },
        visit: { id: visit.id, status: "open" },
      },
    });

    const clientOperationId = createClientOperationId();
    const envelope = await captureTechnicalFindingOffline(
      {
        partition,
        workspaceId: owner.workspaceId,
        workOrderId: workOrder.id,
        visitId: visit.id,
        clientOperationId,
        payload: {
          findingKind: "symptom",
          description: "retry lifecycle finding",
          assertedAt: ASSERTED,
        },
      },
      store,
    );
    assert.equal(envelope.clientOperationId, clientOperationId);
    assert.equal(envelope.syncState, "PENDING");

    let serverSubmitCalls = 0;
    async function attemptExplicitSubmit(allowTransport: boolean) {
      if (!allowTransport) {
        throw new Error("simulated ECONNRESET / 503 transport failure");
      }
      serverSubmitCalls += 1;
      return owner.service.submitClientTechnicalFinding(engineerScope, visit.id, {
        clientOperationId,
        workOrderId: workOrder.id,
        findingKind: "symptom",
        description: "retry lifecycle finding",
        assertedAt: ASSERTED,
        userId: engineerId,
      });
    }

    // Explicit submit attempt #1 — simulated transient transport/5xx failure.
    await assert.rejects(() => attemptExplicitSubmit(false), /ECONNRESET|503/);
    assert.equal(serverSubmitCalls, 0);
    const afterFailure = await applyTechnicalFindingLocalSubmitOutcome(
      envelope,
      {
        ok: false,
        code: "retryable",
        error: "simulated ECONNRESET / 503 transport failure",
      },
      store,
    );
    assert.equal(afterFailure?.syncState, "RETRYABLE_FAILURE");
    assert.equal(afterFailure?.clientOperationId, clientOperationId);

    const findingsAfterFail = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findingsAfterFail.length, 0);
    const serverReceiptsAfterFail = await getDb()
      .select()
      .from(frigoraClientOperationReceipts)
      .where(eq(frigoraClientOperationReceipts.clientOperationId, clientOperationId));
    assert.equal(serverReceiptsAfterFail.length, 0);

    // Reconnect/online alone performs zero retry and zero server mutation.
    const stillFailed = await store.getMutation(clientOperationId);
    assert.equal(stillFailed?.syncState, "RETRYABLE_FAILURE");
    assert.equal(stillFailed?.clientOperationId, clientOperationId);
    assert.equal(serverSubmitCalls, 0);
    const findingsAfterReconnect = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findingsAfterReconnect.length, 0);

    // Explicit Retry: same clientOperationId → PENDING → real server acceptance.
    const retried = await prepareTechnicalFindingExplicitRetry(clientOperationId, store);
    assert.equal(retried.syncState, "PENDING");
    assert.equal(retried.clientOperationId, clientOperationId);

    const accepted = await attemptExplicitSubmit(true);
    assert.equal(serverSubmitCalls, 1);
    assert.equal(accepted.duplicate, false);
    assert.equal(accepted.receipt.clientOperationId, clientOperationId);

    const synced = await applyTechnicalFindingLocalSubmitOutcome(
      retried,
      {
        ok: true,
        receiptId: accepted.receipt.id,
        acceptedEntityId: accepted.finding.id,
      },
      store,
    );
    assert.equal(synced?.syncState, "SYNCED");
    assert.equal(synced?.clientOperationId, clientOperationId);

    const findingsAfterSuccess = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findingsAfterSuccess.length, 1);
    const receiptsAfterSuccess = await getDb()
      .select()
      .from(frigoraClientOperationReceipts)
      .where(eq(frigoraClientOperationReceipts.clientOperationId, clientOperationId));
    assert.equal(receiptsAfterSuccess.length, 1);

    const identical = await attemptExplicitSubmit(true);
    assert.equal(serverSubmitCalls, 2);
    assert.equal(identical.duplicate, true);
    assert.equal(identical.finding.id, accepted.finding.id);
    assert.equal(identical.receipt.id, accepted.receipt.id);

    const findingsFinal = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findingsFinal.length, 1);
  });

  it("P. concurrent identical submissions create one finding and one receipt", async () => {
    const owner = await seed();
    const engineerId = "user-engineer-a" as UserId;
    const { workOrder, visit, engineerScope } = await seedAssignedVisit(owner, engineerId);
    const clientOperationId = "op-tf-concurrent-1";
    const request = {
      clientOperationId,
      workOrderId: workOrder.id,
      findingKind: "confirmed_fault" as const,
      description: "concurrent identical request",
      assertedAt: ASSERTED,
      userId: engineerId,
    };

    const settled = await Promise.allSettled([
      owner.service.submitClientTechnicalFinding(engineerScope, visit.id, request),
      owner.service.submitClientTechnicalFinding(engineerScope, visit.id, request),
      owner.service.submitClientTechnicalFinding(engineerScope, visit.id, request),
    ]);

    const fulfilled = settled.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof owner.service.submitClientTechnicalFinding>>> =>
        result.status === "fulfilled",
    );
    const rejected = settled.filter((result) => result.status === "rejected");

    assert.equal(
      rejected.length,
      0,
      rejected[0] && rejected[0].status === "rejected"
        ? `unique-constraint or other error escaped: ${String(rejected[0].reason)}`
        : "unexpected rejection",
    );
    assert.equal(fulfilled.length, 3);

    const entityIds = new Set(fulfilled.map((result) => result.value.finding.id));
    const receiptIds = new Set(fulfilled.map((result) => result.value.receipt.id));
    assert.equal(entityIds.size, 1);
    assert.equal(receiptIds.size, 1);

    const findings = await getDb()
      .select()
      .from(frigoraTechnicalFindings)
      .where(eq(frigoraTechnicalFindings.visitId, visit.id));
    assert.equal(findings.length, 1);
    const receipts = await getDb()
      .select()
      .from(frigoraClientOperationReceipts)
      .where(eq(frigoraClientOperationReceipts.clientOperationId, clientOperationId));
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0]?.acceptedEntityId, findings[0]?.id);
  });

  it("product is 0.22.0", () => {
    const catalog = readFileSync(
      join(here, "../../../../core/venture-definition/catalog.ts"),
      "utf8",
    );
    assert.match(catalog, /id:\s*"frigora"[\s\S]*?version:\s*"0\.22\.0"/);
  });
});
