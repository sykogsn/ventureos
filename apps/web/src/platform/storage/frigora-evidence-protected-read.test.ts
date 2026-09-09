/**
 * RPV-002 — Frigora Visit Evidence protected byte reads vs ordinary StoredObjects.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createAuditLog } from "@/platform/audit/log";
import { ensureSchema } from "@/platform/persistence/db";
import { getDb } from "@/platform/persistence/db";
import {
  frigoraVisitEvidence,
  frigoraVisits,
  frigoraWorkOrders,
} from "@/platform/persistence/schema";
import { resetPersistenceLifecycle } from "@/platform/persistence/repositories/sqlite";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { issueDomainAuthorizedMutation } from "./domain-authority";
import { createLocalBlobStorageAdapter } from "./local-adapter";
import { createStoredObjectService } from "./service";

let objectRoot: string | undefined;

afterEach(async () => {
  await resetPersistenceLifecycle(":memory:");
  delete process.env.STORED_OBJECT_ROOT;
  if (objectRoot) {
    await rm(objectRoot, { recursive: true, force: true });
    objectRoot = undefined;
  }
});

async function prepareObjectRoot() {
  objectRoot = await mkdtemp(join(tmpdir(), "vos-rpv002-"));
  process.env.STORED_OBJECT_ROOT = objectRoot;
}

function jpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

async function seedActors() {
  await resetPersistenceLifecycle(":memory:");
  await ensureSchema();
  const workspaceId = "ws-rpv002" as WorkspaceId;
  const otherWorkspaceId = "ws-other" as WorkspaceId;
  const ventureId = "ven-rpv002" as VentureId;
  const ownerId = "user-owner" as UserId;
  const assigneeId = "user-assignee" as UserId;
  const attendeeId = "user-attendee" as UserId;
  const unrelatedId = "user-unrelated" as UserId;
  const store = (await import("@/platform/persistence/repositories/sqlite")).getPersistence();
  await store.organisations.insert({
    id: workspaceId,
    name: "RPV002 Workspace",
    slug: "ws-rpv002",
    createdAt: "2026-09-09T00:00:00.000Z",
  });
  await store.organisations.insert({
    id: otherWorkspaceId,
    name: "Other Workspace",
    slug: "ws-other",
    createdAt: "2026-09-09T00:00:00.000Z",
  });
  const memberships = createDbMembershipStore();
  await memberships.setRole(ownerId, workspaceId, "owner");
  await memberships.setRole(assigneeId, workspaceId, "member");
  await memberships.setRole(attendeeId, workspaceId, "member");
  await memberships.setRole(unrelatedId, workspaceId, "member");
  await memberships.setRole(ownerId, otherWorkspaceId, "owner");
  return {
    workspaceId,
    otherWorkspaceId,
    ventureId,
    ownerId,
    assigneeId,
    attendeeId,
    unrelatedId,
  };
}

function createService() {
  return createStoredObjectService({
    adapter: createLocalBlobStorageAdapter(),
    audit: createAuditLog(),
    permissions: createPermissionService(createDbMembershipStore()),
  });
}

describe("RPV-002 Frigora evidence protected byte reads", () => {
  it("preserves ordinary non-protected venture StoredObject member reads", async () => {
    await prepareObjectRoot();
    const { workspaceId, ventureId, ownerId, unrelatedId } = await seedActors();
    const service = createService();
    const metadata = await service.store({
      scope: { workspaceId, ventureId },
      actorUserId: ownerId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "ordinary.jpg",
      mimeType: "image/jpeg",
    });

    const opened = await service.open({
      actorUserId: unrelatedId,
      activeWorkspaceId: workspaceId,
      objectId: metadata.id,
    });
    assert.ok(opened);
    assert.equal(opened!.metadata.id, metadata.id);
  });

  it("denies unrelated members for Frigora Visit Evidence bytes while allowing owner, assignee, and attendee", async () => {
    await prepareObjectRoot();
    const actors = await seedActors();
    const service = createService();
    const workOrderId = "wo-rpv002-1";
    const visitId = "visit-rpv002-1";
    const now = "2026-09-09T10:00:00.000Z";

    await getDb().insert(frigoraWorkOrders).values({
      id: workOrderId,
      workspaceId: actors.workspaceId,
      ventureId: actors.ventureId,
      customerId: "cust-1",
      siteId: "site-1",
      primaryAssetId: null,
      workReference: "WO-RPV002-1",
      workKind: "reactive",
      reportedCondition: "test",
      status: "open",
      assignedUserId: actors.assigneeId,
      createdAt: now,
      updatedAt: now,
      scheduledStartAt: null,
      scheduledEndAt: null,
      assignmentAcceptedAt: null,
      assignmentDeclinedAt: null,
      assignmentDeclineReason: null,
      cancellationReason: null,
      sourceRecommendedActionId: null,
    });
    await getDb().insert(frigoraVisits).values({
      id: visitId,
      workspaceId: actors.workspaceId,
      ventureId: actors.ventureId,
      workOrderId,
      attendingUserId: actors.attendeeId,
      arrivedAt: now,
      departedAt: null,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    const authority = issueDomainAuthorizedMutation({
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: workOrderId,
    });
    const metadata = await service.storeForDomain({
      scope: { workspaceId: actors.workspaceId, ventureId: actors.ventureId },
      actorUserId: actors.assigneeId,
      activeWorkspaceId: actors.workspaceId,
      body: jpegBytes(),
      originalFilename: "evidence.jpg",
      mimeType: "image/jpeg",
      authority,
    });
    await getDb().insert(frigoraVisitEvidence).values({
      id: "ev-rpv002-1",
      workspaceId: actors.workspaceId,
      ventureId: actors.ventureId,
      visitId,
      workOrderId,
      assetId: null,
      storedObjectId: metadata.id,
      category: "TECHNICAL",
      description: null,
      capturedAt: now,
      recordedByUserId: actors.assigneeId,
      createdAt: now,
      removedAt: null,
      originalFilename: "evidence.jpg",
      mimeType: "image/jpeg",
      sizeBytes: jpegBytes().byteLength,
    });

    assert.ok(
      await service.open({
        actorUserId: actors.ownerId,
        activeWorkspaceId: actors.workspaceId,
        objectId: metadata.id,
      }),
    );
    assert.ok(
      await service.open({
        actorUserId: actors.assigneeId,
        activeWorkspaceId: actors.workspaceId,
        objectId: metadata.id,
      }),
    );
    assert.ok(
      await service.open({
        actorUserId: actors.attendeeId,
        activeWorkspaceId: actors.workspaceId,
        objectId: metadata.id,
      }),
    );
    assert.equal(
      await service.open({
        actorUserId: actors.unrelatedId,
        activeWorkspaceId: actors.workspaceId,
        objectId: metadata.id,
      }),
      null,
    );
    assert.equal(
      await service.open({
        actorUserId: actors.ownerId,
        activeWorkspaceId: actors.otherWorkspaceId,
        objectId: metadata.id,
      }),
      null,
    );
  });
});
