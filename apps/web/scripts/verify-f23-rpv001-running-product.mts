/**
 * Controlled disposable running-product proof for F2.3-RPV-001.
 *
 * Uses the disposable verification DATABASE_URL + STORED_OBJECT_ROOT and the
 * real Frigora evidence service path with an allowed JPEG MIME.
 *
 * Does NOT print credentials. Does NOT reseed. Does NOT certify F2.3.
 *
 * Usage (from apps/web):
 *   set DATABASE_URL=file:C:/Users/sykog/AppData/Local/frigora-f23-verification/ventureos.db
 *   set STORED_OBJECT_ROOT=C:\Users\sykog\AppData\Local\frigora-f23-verification\objects
 *   node --import tsx scripts/verify-f23-rpv001-running-product.mts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import {
  issueDomainAuthorizedMutation,
  requireIssuedDomainAuthority,
} from "../src/platform/storage/domain-authority.ts";
import { StoredObjectError } from "../src/platform/storage/errors.ts";

function requireDisposableEnv() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const objectRoot = process.env.STORED_OBJECT_ROOT ?? "";
  if (!databaseUrl.includes("frigora-f23-verification")) {
    throw new Error("Refusing to run outside frigora-f23-verification DATABASE_URL.");
  }
  if (!objectRoot.includes("frigora-f23-verification")) {
    throw new Error("Refusing to run outside frigora-f23-verification STORED_OBJECT_ROOT.");
  }
  return { databaseUrl, objectRoot };
}

async function main() {
  const { databaseUrl, objectRoot } = requireDisposableEnv();
  process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

  const issued = issueDomainAuthorizedMutation({
    domain: "frigora",
    relation: "assigned_work_order",
    resourceId: "rpv001-seal-check",
  });
  requireIssuedDomainAuthority(issued);
  try {
    requireIssuedDomainAuthority({
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: "rpv001-seal-check",
    });
    assert.fail("forged authority accepted");
  } catch (error) {
    assert.ok(error instanceof StoredObjectError && error.code === "FORBIDDEN");
  }

  const client = createClient({ url: databaseUrl });
  const wo = await client.execute(
    "SELECT id, work_reference, status, assigned_user_id, workspace_id, venture_id FROM frigora_work_orders WHERE work_reference = 'WO-F23V-1'",
  );
  assert.ok(wo.rows[0], "WO-F23V-1 missing");
  const workOrder = wo.rows[0];
  assert.equal(String(workOrder.status), "open");

  const assignee = await client.execute({
    sql: "SELECT id, email FROM users WHERE id = ?",
    args: [String(workOrder.assigned_user_id)],
  });
  assert.ok(assignee.rows[0], "assignee missing");
  const engineerEmail = String(assignee.rows[0].email);
  assert.match(engineerEmail, /engineer\.[ab]@f23-verify\.local/);

  const { resetPersistenceLifecycle } = await import(
    "../src/platform/persistence/repositories/sqlite.ts"
  );
  await resetPersistenceLifecycle(databaseUrl);
  const { ensureSchema } = await import("../src/platform/persistence/db.ts");
  await ensureSchema();
  const { getPlatform } = await import("../src/platform/kernel.ts");
  const platform = getPlatform();
  const { createFrigoraService } = await import("../src/modules/frigora/service.ts");
  const { createPermissionService } = await import("../src/platform/permissions/service.ts");
  const { createDbMembershipStore } = await import(
    "../src/platform/permissions/membership-store.ts"
  );
  const service = createFrigoraService({
    permissions: createPermissionService(createDbMembershipStore()),
  });

  const scope = {
    userId: String(workOrder.assigned_user_id) as never,
    workspaceId: String(workOrder.workspace_id) as never,
    ventureId: String(workOrder.venture_id) as never,
  };

  const openVisits = await client.execute({
    sql: "SELECT id, status FROM frigora_visits WHERE work_order_id = ? AND status = 'open'",
    args: [String(workOrder.id)],
  });
  let visitId = openVisits.rows[0] ? String(openVisits.rows[0].id) : "";
  if (!visitId) {
    const visit = await service.recordVisitArrival(scope, String(workOrder.id) as never, {
      userId: String(workOrder.assigned_user_id) as never,
      arrivedAt: new Date().toISOString(),
    });
    visitId = visit.id;
  }

  const beforeEvidence = await client.execute("SELECT COUNT(*) as c FROM frigora_visit_evidence");
  const beforeObjects = await client.execute(
    "SELECT COUNT(*) as c FROM stored_objects WHERE deleted_at IS NULL",
  );

  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  let evidence;
  try {
    evidence = await service.recordVisitEvidenceWithFile(scope, visitId as never, {
      category: "TECHNICAL",
      description: null,
      userId: String(workOrder.assigned_user_id) as never,
      assetId: null,
      body: jpeg,
      originalFilename: "rpv001-proof.jpg",
      mimeType: "image/jpeg",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/issued mutation authority/i.test(message)) {
      throw new Error(`RPV-001 STILL PRESENT: ${message}`);
    }
    throw error;
  }

  assert.ok(evidence.id);
  assert.ok(evidence.storedObjectId);

  const opened = await platform.storedObjects.open({
    actorUserId: String(workOrder.assigned_user_id) as never,
    activeWorkspaceId: String(workOrder.workspace_id) as never,
    objectId: evidence.storedObjectId,
  });
  assert.ok(opened);
  assert.equal(opened!.body.byteLength, jpeg.byteLength);
  assert.equal(opened!.metadata.mimeType, "image/jpeg");

  const afterEvidence = await client.execute("SELECT COUNT(*) as c FROM frigora_visit_evidence");
  const afterObjects = await client.execute(
    "SELECT COUNT(*) as c FROM stored_objects WHERE deleted_at IS NULL",
  );
  assert.equal(Number(afterEvidence.rows[0]?.c), Number(beforeEvidence.rows[0]?.c) + 1);
  assert.equal(Number(afterObjects.rows[0]?.c), Number(beforeObjects.rows[0]?.c) + 1);

  const objectPath = join(objectRoot, String(workOrder.workspace_id), evidence.storedObjectId);
  const bytes = readFileSync(objectPath);
  assert.equal(bytes.byteLength, jpeg.byteLength);

  console.log(
    JSON.stringify(
      {
        ok: true,
        workReference: "WO-F23V-1",
        assigneeEmail: engineerEmail,
        visitId,
        evidenceId: evidence.id,
        storedObjectId: evidence.storedObjectId,
        mimeType: "image/jpeg",
        sealErrorAbsent: true,
        evidenceCount: Number(afterEvidence.rows[0]?.c),
        storedObjectCount: Number(afterObjects.rows[0]?.c),
      },
      null,
      2,
    ),
  );

  platform.scheduler.stopAll();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
