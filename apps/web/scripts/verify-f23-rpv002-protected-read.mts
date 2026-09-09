/**
 * Disposable RPV-002 running-product proof.
 * Does NOT touch frigora-f23-verification Independent Work state.
 *
 * From apps/web:
 *   pnpm exec tsx scripts/verify-f23-rpv002-protected-read.mts
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { getPlatform } from "@/platform/kernel";
import { createPermissionService } from "@/platform/permissions/service";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { ensureSchema } from "@/platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { createFrigoraService } from "@/modules/frigora/service";
import type { FrigoraScope } from "@/modules/frigora/types";

const NOW = "2026-09-09T12:00:00.000Z";
const ARRIVED = "2026-09-09T12:10:00.000Z";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

const objectRoot = await mkdtemp(join(tmpdir(), "rpv002-proof-"));
process.env.STORED_OBJECT_ROOT = objectRoot;

await resetPersistenceLifecycle();
await ensureSchema();

const workspaceId = "ws-rpv002-proof" as WorkspaceId;
const ventureId = "ven-rpv002-proof" as VentureId;
const ownerId = "owner-proof" as UserId;
const engineerAId = "eng-a-proof" as UserId;
const engineerBId = "eng-b-proof" as UserId;
const p = getPersistence();
await p.organisations.insert({
  id: workspaceId,
  name: "Proof",
  slug: "proof",
  createdAt: NOW,
});
for (const [id, role] of [
  [ownerId, "owner"],
  [engineerAId, "member"],
  [engineerBId, "member"],
] as const) {
  await p.users.insert({
    id,
    email: `${id}@proof.test`,
    name: id,
    passwordHash: "x",
    createdAt: NOW,
  });
  await p.memberships.setRole({ userId: id, workspaceId, role, createdAt: NOW });
}
await p.ventures.insert({
  id: ventureId,
  workspaceId,
  name: "Proof Venture",
  slug: "proof-venture",
  stage: "Idea",
  href: "/x",
  foundedAt: NOW,
  category: "Operations",
  owner: "Owner",
  hqSummary: "",
  genome: {
    thesis: "",
    category: "",
    stage: "",
    goal: "",
    posture: "human-led",
    risk: "",
    motion: "",
    cadence: "",
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
  definitionVersion: "0.18.0",
  lifecycle: "operating",
  createdAt: NOW,
  updatedAt: NOW,
} satisfies PersistedVenture);

const service = createFrigoraService({
  permissions: createPermissionService(createDbMembershipStore()),
});
const owner = { userId: ownerId, workspaceId, ventureId } satisfies FrigoraScope;
const engA = { userId: engineerAId, workspaceId, ventureId } satisfies FrigoraScope;
const customer = await service.createCustomer(owner, { code: "C", displayName: "C" });
const site = await service.createSite(owner, {
  customerId: customer.id,
  code: "S",
  name: "S",
  addressLine1: "1",
  city: "X",
});
const asset = await service.createAsset(owner, {
  siteId: site.id,
  tag: "A",
  name: "A",
  assetKind: "cold_room",
});
const created = await service.createWorkOrder(owner, {
  siteId: site.id,
  workReference: "WO-PROOF-1",
  workKind: "reactive",
  reportedCondition: "warm",
  primaryAssetId: asset.id,
});
await service.assignWorkOrder(owner, created.id, { userId: engineerAId });
const visit = await service.recordVisitArrival(engA, created.id, {
  userId: engineerAId,
  arrivedAt: ARRIVED,
});
const evidence = await service.recordVisitEvidenceWithFile(engA, visit.id, {
  body: JPEG,
  originalFilename: "proof.jpg",
  mimeType: "image/jpeg",
  category: "TECHNICAL",
  userId: engineerAId,
  assetId: asset.id,
});

const storage = getPlatform().storedObjects;
const a = await storage.open({
  actorUserId: engineerAId,
  activeWorkspaceId: workspaceId,
  objectId: evidence.storedObjectId,
});
const b = await storage.open({
  actorUserId: engineerBId,
  activeWorkspaceId: workspaceId,
  objectId: evidence.storedObjectId,
});
const o = await storage.open({
  actorUserId: ownerId,
  activeWorkspaceId: workspaceId,
  objectId: evidence.storedObjectId,
});

assert.ok(a, "assignee must read");
assert.equal(b, null, "unrelated member must be denied");
assert.ok(o, "owner must read");

console.log(
  JSON.stringify(
    {
      ok: true,
      fixture: "separate-temp",
      touchedIndependentWorkDb: false,
      assigneeRead: "ALLOW",
      unrelatedMemberRead: "DENY",
      ownerRead: "ALLOW",
      storedObjectId: evidence.storedObjectId,
    },
    null,
    2,
  ),
);

getPlatform().scheduler.stopAll();
await resetPersistenceLifecycle();
await rm(objectRoot, { recursive: true, force: true });
