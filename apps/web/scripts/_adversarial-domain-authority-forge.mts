/**
 * Adversarial forge challenge for domain-authority.
 * Updated for closure-private singleton kernel (rejects globalThis registry attack).
 *
 * Usage (apps/web):
 *   node --import tsx scripts/_adversarial-domain-authority-forge.mts
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readdirSync, readFileSync, statSync } from "node:fs";
import type { DomainAuthorizedMutation, UserId, VentureId, WorkspaceId } from "../src/contracts/index.ts";
import {
  isIssuedDomainAuthority,
  requireIssuedDomainAuthority,
  issueDomainAuthorizedMutation,
} from "../src/platform/storage/domain-authority.ts";
import { StoredObjectError } from "../src/platform/storage/errors.ts";
import { createAuditLog } from "../src/platform/audit/log.ts";
import { ensureSchema } from "../src/platform/persistence/db.ts";
import { resetPersistenceLifecycle } from "../src/platform/persistence/repositories/sqlite.ts";
import { createPermissionService } from "../src/platform/permissions/service.ts";
import { createDbMembershipStore } from "../src/platform/permissions/membership-store.ts";
import { createLocalBlobStorageAdapter } from "../src/platform/storage/local-adapter.ts";
import { createStoredObjectService } from "../src/platform/storage/service.ts";

const REGISTRY_KEY_DESCRIPTION = "ventureos.storage.issuedDomainAuthorizedMutation.registry";

type RegistryShape = { issued: WeakSet<object> };

function jpegBytes() {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
}

function listJs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) listJs(full, out);
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

async function main() {
  const report: Record<string, unknown> = { ok: true };

  // Legitimate seed (does not prove forgery).
  const legitimate = issueDomainAuthorizedMutation({
    domain: "frigora",
    relation: "assigned_work_order",
    resourceId: "adversarial-seed-legitimate-only",
  });
  assert.equal(isIssuedDomainAuthority(legitimate), true);

  const key = Symbol.for(REGISTRY_KEY_DESCRIPTION);
  const live = (globalThis as typeof globalThis & Record<symbol, RegistryShape | undefined>)[key];
  report.test1_discoverability =
    live === undefined
      ? "GLOBAL REGISTRY NOT PRESENT / NOT ACCESSIBLE"
      : "REGISTRY ACCESSIBLE";
  report.test1_liveSlotUndefined = live === undefined;

  // Attack: create fake registry and inject.
  const forgedResource = "adversarial-forged-work-order";
  const forged = {
    domain: "frigora",
    relation: "assigned_work_order",
    resourceId: forgedResource,
  } as DomainAuthorizedMutation;
  const globalScope = globalThis as typeof globalThis & Record<symbol, RegistryShape | undefined>;
  globalScope[key] = { issued: new WeakSet<object>() };
  globalScope[key]!.issued.add(forged);

  let requireResult: "FORGERY_ACCEPTED" | "FORGERY_REJECTED";
  try {
    requireIssuedDomainAuthority(forged);
    requireResult = "FORGERY_ACCEPTED";
  } catch (error) {
    requireResult =
      error instanceof StoredObjectError && error.code === "FORBIDDEN"
        ? "FORGERY_REJECTED"
        : "FORGERY_REJECTED";
  }
  report.test2_requireIssuedDomainAuthority = requireResult;
  report.test2_isIssuedDomainAuthority = isIssuedDomainAuthority(forged);

  const forgedWrongRelation = {
    domain: "frigora",
    relation: "workspace_member",
    resourceId: forgedResource,
  };
  const forgedWrongDomain = {
    domain: "unknown-domain",
    relation: "assigned_work_order",
    resourceId: forgedResource,
  };
  globalScope[key]!.issued.add(forgedWrongRelation);
  globalScope[key]!.issued.add(forgedWrongDomain);
  let wrongRelation: "REJECTED" | "ACCEPTED" = "ACCEPTED";
  let wrongDomain: "REJECTED" | "ACCEPTED" = "ACCEPTED";
  try {
    requireIssuedDomainAuthority(forgedWrongRelation as DomainAuthorizedMutation);
  } catch {
    wrongRelation = "REJECTED";
  }
  try {
    requireIssuedDomainAuthority(forgedWrongDomain as DomainAuthorizedMutation);
  } catch {
    wrongDomain = "REJECTED";
  }
  report.test4_wrongRelationAfterInjection = wrongRelation;
  report.test4_wrongDomainAfterInjection = wrongDomain;

  const objectRoot = await mkdtemp(join(tmpdir(), "vos-adv-forge-"));
  process.env.STORED_OBJECT_ROOT = objectRoot;
  try {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    const workspaceId = "ws-adv-forge" as WorkspaceId;
    const ventureId = "ven-adv-forge" as VentureId;
    const ownerId = "user-adv-owner" as UserId;
    const memberId = "user-adv-member" as UserId;
    const store = (await import("../src/platform/persistence/repositories/sqlite.ts")).getPersistence();
    await store.organisations.insert({
      id: workspaceId,
      name: "Adv Forge Workspace",
      slug: "ws-adv-forge",
      createdAt: "2026-09-09T00:00:00.000Z",
    });
    const memberships = createDbMembershipStore();
    await memberships.setRole(ownerId, workspaceId, "owner");
    await memberships.setRole(memberId, workspaceId, "member");

    const service = createStoredObjectService({
      adapter: createLocalBlobStorageAdapter(),
      audit: createAuditLog(),
      permissions: createPermissionService(createDbMembershipStore()),
    });

    let storeResult: "FORGERY_ACCEPTED" | "FORGERY_REJECTED";
    try {
      await service.storeForDomain({
        scope: { workspaceId, ventureId },
        actorUserId: memberId,
        activeWorkspaceId: workspaceId,
        body: jpegBytes(),
        originalFilename: "forged.jpg",
        mimeType: "image/jpeg",
        authority: forged,
      });
      storeResult = "FORGERY_ACCEPTED";
    } catch (error) {
      storeResult =
        error instanceof StoredObjectError && error.code === "FORBIDDEN"
          ? "FORGERY_REJECTED"
          : "FORGERY_REJECTED";
    }
    report.test2_storeForDomain = storeResult;

    // Legitimate store + delete path for contrast; forged delete without issue.
    const legit = issueDomainAuthorizedMutation({
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: forgedResource,
    });
    const stored = await service.storeForDomain({
      scope: { workspaceId, ventureId },
      actorUserId: memberId,
      activeWorkspaceId: workspaceId,
      body: jpegBytes(),
      originalFilename: "legit.jpg",
      mimeType: "image/jpeg",
      authority: legit,
    });
    let deleteForged: "FORGERY_ACCEPTED" | "FORGERY_REJECTED";
    try {
      await service.deleteForDomain({
        actorUserId: memberId,
        activeWorkspaceId: workspaceId,
        objectId: stored.id,
        authority: forged,
      });
      deleteForged = "FORGERY_ACCEPTED";
    } catch {
      deleteForged = "FORGERY_REJECTED";
    }
    report.test3_deleteForDomain_forged = deleteForged;

    await service.deleteForDomain({
      actorUserId: memberId,
      activeWorkspaceId: workspaceId,
      objectId: stored.id,
      authority: issueDomainAuthorizedMutation({
        domain: "frigora",
        relation: "assigned_work_order",
        resourceId: forgedResource,
      }),
    });
    report.test3_deleteForDomain_legitimate = "ACCEPTED";
  } finally {
    delete (globalThis as typeof globalThis & Record<symbol, unknown>)[key];
    delete process.env.STORED_OBJECT_ROOT;
    await rm(objectRoot, { recursive: true, force: true });
    await resetPersistenceLifecycle(":memory:");
  }

  const serverRoot = join(process.cwd(), ".next", "server");
  let bundleKeyRefs = 0;
  let files = 0;
  try {
    const js = listJs(serverRoot);
    files = js.length;
    for (const file of js) {
      const text = readFileSync(file, "utf8");
      bundleKeyRefs += text.split(`Symbol.for("${REGISTRY_KEY_DESCRIPTION}")`).length - 1;
    }
  } catch (error) {
    report.test5_error = error instanceof Error ? error.message : String(error);
  }
  report.test5_productionBundle = {
    serverJsFiles: files,
    rejectedRegistryKeyRefsInBundle: bundleKeyRefs,
    note:
      bundleKeyRefs === 0
        ? "Rejected global registry key absent from production server chunks."
        : "Rejected global registry key still present in bundle.",
  };

  const forgeResistant =
    report.test1_discoverability === "GLOBAL REGISTRY NOT PRESENT / NOT ACCESSIBLE" &&
    report.test2_requireIssuedDomainAuthority === "FORGERY_REJECTED" &&
    report.test2_storeForDomain === "FORGERY_REJECTED" &&
    report.test3_deleteForDomain_forged === "FORGERY_REJECTED";

  report.securityVerdict = forgeResistant
    ? "A. CURRENT DESIGN IS FORGE-RESISTANT"
    : report.test2_storeForDomain === "FORGERY_ACCEPTED"
      ? "B. CURRENT DESIGN ALLOWS DIRECT REGISTRY FORGERY"
      : "C. INSUFFICIENT EVIDENCE";

  console.log(JSON.stringify(report, null, 2));
  if (!forgeResistant) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
