import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { PermissionService, UserId, VentureId, WorkspaceId } from "@/contracts";
import { createDbMembershipStore } from "@/platform/permissions/membership-store";
import { createPermissionService } from "@/platform/permissions/service";
import {
  ensureFrigoraCommercialLinesSchema,
  ensureSchema,
  getClient,
  getDatabaseUrl,
} from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { exampleQuotationCommercial } from "./quotation-commercial";
import {
  correctPersistedQuotation,
  createPersistedQuotation,
  issuePersistedQuotation,
  revisePersistedQuotation,
} from "./quotation-commands";
import { createFrigoraService } from "./service";
import { createFrigoraStore, type FrigoraStore } from "./store";
import { allowSyntheticNotRegisteredQuotationSend } from "./tax-configuration-fixture";
import { closeFrigoraPersistenceAfterFile } from "./test-persistence-lifecycle";
import type { FrigoraScope } from "./types";
// The installed libsql package does not ship TypeScript declarations.
// @ts-expect-error TS7016
import Database from "../../../../../node_modules/.pnpm/libsql@0.5.29/node_modules/libsql/index.js";

const NOW = "2026-10-24T08:00:00.000Z";

closeFrigoraPersistenceAfterFile();

beforeEach(async () => {
  await resetPersistenceLifecycle();
  await ensureSchema();
});

type RawDatabase = InstanceType<typeof Database>;

function openIsolatedDatabase(): RawDatabase {
  const url = getDatabaseUrl();
  if (!url.includes("vos-ephemeral") || url.toLowerCase().includes("ventureos.db")) {
    throw new Error("Refusing a non-ephemeral database");
  }
  return new Database(url.slice("file:".length));
}

function setMode(db: RawDatabase, foreignKeys: number, recursiveTriggers: number) {
  db.pragma(`foreign_keys = ${foreignKeys}`);
  db.pragma(`recursive_triggers = ${recursiveTriggers}`);
  const foreignKeyValue = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
  const recursiveValue = db.prepare("PRAGMA recursive_triggers").get() as { recursive_triggers: number };
  assert.equal(foreignKeyValue.foreign_keys, foreignKeys);
  assert.equal(recursiveValue.recursive_triggers, recursiveTriggers);
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function reject(db: RawDatabase, sql: string, args: Array<string | number> = []) {
  assert.throws(() => db.prepare(sql).run(...args), (error: unknown) => error instanceof Error && messageOf(error).length > 0);
}

function versionRow(db: RawDatabase, quotationId: string, versionNumber: number) {
  return db.prepare(
    "SELECT quotation_id, version_number, workspace_id, venture_id, status, description, document_hash FROM frigora_quotation_versions WHERE quotation_id = ? AND version_number = ?",
  ).get(quotationId, versionNumber) as {
    quotation_id: string;
    version_number: number;
    workspace_id: string;
    venture_id: string;
    status: string;
    description: string;
    document_hash: string;
  };
}

function seals(db: RawDatabase, quotationId: string, versionNumber: number) {
  return db.prepare(
    "SELECT copy, workspace_id, venture_id FROM frigora_quotation_version_seals WHERE quotation_id = ? AND version_number = ? ORDER BY copy",
  ).all(quotationId, versionNumber) as Array<{ copy: number; workspace_id: string; venture_id: string }>;
}

describe("Frigora quotation version integrity", () => {
  it("registers existing versions without changing history and survives a repeated initialiser", async () => {
    const owner = await seed();
    const recommendation = await seedRecommendation(owner, "WO-H03-REGISTER");
    const quote = await createPersistedQuotation(owner.store, owner.scope, quoteInput(recommendation.id));
    const before = await getClient().execute({
      sql: "SELECT status, description, document_hash FROM frigora_quotation_versions WHERE quotation_id = ?",
      args: [quote.id],
    });
    await ensureFrigoraCommercialLinesSchema();
    await ensureFrigoraCommercialLinesSchema();
    const after = await getClient().execute({
      sql: "SELECT status, description, document_hash FROM frigora_quotation_versions WHERE quotation_id = ?",
      args: [quote.id],
    });
    assert.deepEqual(after.rows, before.rows);
    const registered = await getClient().execute({
      sql: "SELECT copy FROM frigora_quotation_version_seals WHERE quotation_id = ? ORDER BY copy",
      args: [quote.id],
    });
    assert.deepEqual(registered.rows.map((row) => Number(row.copy)), [0, 1]);
  });

  it("rejects alternative version and line writes and preserves supported workflows", async () => {
    await ensureFrigoraCommercialLinesSchema();
    const owner = await seed({ reset: false });
    const headerRecommendation = await seedRecommendation(owner, "WO-H03-HEADER");
    const lineRecommendation = await seedRecommendation(owner, "WO-H03-LINE");
    const otherRecommendation = await seedRecommendation(owner, "WO-H03-OTHER");
    const headerQuote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(headerRecommendation.id, "Header offer"),
    );
    const issued = await issuePersistedQuotation(owner.store, owner.scope, headerQuote.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    assert.equal(issued.quotation.versions[0]?.status, "awaiting_customer_approval");
    const revisedHeader = await revisePersistedQuotation(owner.store, owner.scope, headerQuote.id, {
      expectedCurrentVersion: 1,
      description: "Lineless revision",
      commercial: exampleQuotationCommercial(),
    });
    assert.equal(revisedHeader.currentVersion, 2);
    const historicalHeaderHash = revisedHeader.versions.find((version) => version.version === 1)?.documentHash;
    const lineQuote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(lineRecommendation.id, "Line offer"),
      { permissions: owner.permissions, drafts: [customDraft("Identity gasket")] },
    );
    const revisedLine = await revisePersistedQuotation(owner.store, owner.scope, lineQuote.id, {
      expectedCurrentVersion: 1,
      description: "Line revision",
      commercial: exampleQuotationCommercial({ labourQuantityMilli: 20_000 }),
    });
    assert.equal(revisedLine.currentVersion, 2);
    const versionOneHash = revisedLine.versions.find((version) => version.version === 1)?.documentHash;
    const otherQuote = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(otherRecommendation.id, "Other offer"),
      { permissions: owner.permissions, drafts: [customDraft("Other gasket")] },
    );

    const db = openIsolatedDatabase();
    try {
      await runAttacks(db, 0, 0, {
        headerId: headerQuote.id,
        lineId: lineQuote.id,
        otherId: otherQuote.id,
        workspaceId: owner.workspaceId,
        ventureId: owner.ventureId,
        versionOneHash: String(versionOneHash),
        historicalHeaderHash: String(historicalHeaderHash),
      });
      await runAttacks(db, 1, 0, {
        headerId: headerQuote.id,
        lineId: lineQuote.id,
        otherId: otherQuote.id,
        workspaceId: owner.workspaceId,
        ventureId: owner.ventureId,
        versionOneHash: String(versionOneHash),
        historicalHeaderHash: String(historicalHeaderHash),
        identityOnly: true,
      });

      db.exec("BEGIN");
      db.prepare(`
        INSERT INTO frigora_quotation_versions (
          quotation_id, workspace_id, venture_id, version_number, status, description,
          total_minor, currency, document_hash
        ) VALUES (?, ?, ?, 3, 'in_preparation', 'Rolled back', 1, 'ZAR', 'hash-temp')
      `).run(lineQuote.id, owner.workspaceId, owner.ventureId);
      db.prepare("UPDATE frigora_quotations SET current_version = 3 WHERE id = ?").run(lineQuote.id);
      db.exec("ROLLBACK");
      assert.equal(versionRow(db, lineQuote.id, 3), undefined);
      assert.equal(seals(db, lineQuote.id, 3).length, 0);
      assert.equal(
        Number((db.prepare("SELECT current_version FROM frigora_quotations WHERE id = ?").get(lineQuote.id) as { current_version: number }).current_version),
        2,
      );
    } finally {
      db.close();
    }

    const corrected = await correctPersistedQuotation(owner.store, owner.scope, lineQuote.id, {
      expectedCurrentVersion: 2,
      description: "Corrected line offer",
      commercial: exampleQuotationCommercial({ labourQuantityMilli: 20_000 }),
    }, {
      permissions: owner.permissions,
      drafts: [customDraft("Corrected gasket")],
    });
    assert.equal(corrected.currentVersion, 2);
    assert.equal(corrected.versions.find((version) => version.version === 2)?.documentHash === versionOneHash, false);
    assert.equal(corrected.versions.find((version) => version.version === 1)?.documentHash, versionOneHash);
    const forwarded = await revisePersistedQuotation(owner.store, owner.scope, lineQuote.id, {
      expectedCurrentVersion: 2,
      description: "Forward revision",
      commercial: exampleQuotationCommercial({ labourQuantityMilli: 30_000 }),
    });
    assert.equal(forwarded.currentVersion, 3);
    assert.equal(forwarded.versions.find((version) => version.version === 1)?.documentHash, versionOneHash);
    const dbAfter = openIsolatedDatabase();
    try {
      const historicalLine = dbAfter.prepare(
        "SELECT description FROM frigora_quotation_line_snapshots WHERE quotation_id = ? AND version_number = 1",
      ).get(lineQuote.id) as { description: string };
      assert.equal(historicalLine.description, "Identity gasket");
      assert.equal(versionRow(dbAfter, lineQuote.id, 1).document_hash, versionOneHash);
      assert.equal(seals(dbAfter, lineQuote.id, 3).length, 2);
      const correctedLine = dbAfter.prepare(
        "SELECT description FROM frigora_quotation_line_snapshots WHERE quotation_id = ? AND version_number = 2",
      ).get(lineQuote.id) as { description: string };
      assert.equal(correctedLine.description, "Corrected gasket");
    } finally {
      dbAfter.close();
    }

    const repair = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput(await seedRecommendation(owner, "WO-H03-REPAIR").then((item) => item.id), "Repair offer"),
    );
    const repairHash = repair.versions[0]?.documentHash;
    const repairDb = openIsolatedDatabase();
    try {
      const versionColumns = (repairDb.prepare("PRAGMA table_info(frigora_quotation_versions)").all() as Array<{ name: string }>).map((column) => column.name);
      const copied = versionColumns.map((column) => {
        if (column === "version_number") return "2";
        if (column === "status") return "'in_preparation'";
        if (column === "description") return "'Revised after approval'";
        if (column === "document_hash") return "'revision-hash'";
        if (column === "sent_at" || column === "recipient" || column === "dispatch_evidence_ref") return "NULL";
        return column;
      }).join(", ");
      const inserted = repairDb.prepare(`
        INSERT INTO frigora_quotation_versions (${versionColumns.join(", ")})
        SELECT ${copied}
        FROM frigora_quotation_versions
        WHERE quotation_id = ? AND version_number = 1
      `).run(repair.id);
      const bumped = repairDb.prepare(
        "UPDATE frigora_quotations SET current_version = 2 WHERE id = ? AND current_version = 1",
      ).run(repair.id);
      assert.equal(inserted.changes, 1);
      assert.equal(bumped.changes, 1);
      assert.equal(versionRow(repairDb, repair.id, 1).document_hash, repairHash);
      assert.equal(versionRow(repairDb, repair.id, 2).description, "Revised after approval");
      assert.equal(seals(repairDb, repair.id, 1).length, 2);
      assert.equal(seals(repairDb, repair.id, 2).length, 2);
    } finally {
      repairDb.close();
    }

    const reissued = await issuePersistedQuotation(owner.store, owner.scope, headerQuote.id, {
      expectedCurrentVersion: 2,
      recipient: "client@example.test",
    });
    assert.equal(reissued.quotation.versions.find((version) => version.version === 2)?.status, "awaiting_customer_approval");
    const declineSource = await createPersistedQuotation(
      owner.store,
      owner.scope,
      quoteInput((await seedRecommendation(owner, "WO-H03-DECLINE")).id, "Decline offer"),
    );
    const declinedQuote = await issuePersistedQuotation(owner.store, owner.scope, declineSource.id, {
      expectedCurrentVersion: 1,
      recipient: "client@example.test",
    });
    assert.equal(declinedQuote.quotation.versions[0]?.status, "awaiting_customer_approval");
    const decisionDb = openIsolatedDatabase();
    try {
      const issuedVersion = versionRow(decisionDb, headerQuote.id, 2);
      assert.equal(issuedVersion.status, "awaiting_customer_approval");
      reject(decisionDb, "UPDATE frigora_quotation_versions SET status = 'approved' WHERE quotation_id = ? AND version_number = 2", [headerQuote.id]);
      assert.equal(versionRow(decisionDb, headerQuote.id, 2).status, "awaiting_customer_approval");
      decisionDb.prepare(`
        INSERT INTO frigora_quotation_decisions (
          id, quotation_id, workspace_id, venture_id, customer_id, site_id,
          version_number, document_hash, decision, grant_id, decided_at
        )
        SELECT 'decision-approved', id, workspace_id, venture_id, customer_id, site_id,
          2, ?, 'approved', 'grant-approved', ?
        FROM frigora_quotations WHERE id = ?
      `).run(issuedVersion.document_hash, NOW, headerQuote.id);
      decisionDb.prepare("UPDATE frigora_quotation_versions SET status = 'approved' WHERE quotation_id = ? AND version_number = 2").run(headerQuote.id);
      assert.equal(versionRow(decisionDb, headerQuote.id, 2).status, "approved");
      assert.equal(versionRow(decisionDb, headerQuote.id, 2).document_hash, issuedVersion.document_hash);
      const declinedVersion = versionRow(decisionDb, declineSource.id, 1);
      reject(decisionDb, "UPDATE frigora_quotation_versions SET status = 'declined' WHERE quotation_id = ? AND version_number = 1", [declineSource.id]);
      assert.equal(versionRow(decisionDb, declineSource.id, 1).status, "awaiting_customer_approval");
      decisionDb.prepare(`
        INSERT INTO frigora_quotation_decisions (
          id, quotation_id, workspace_id, venture_id, customer_id, site_id,
          version_number, document_hash, decision, grant_id, decided_at
        )
        SELECT 'decision-declined', id, workspace_id, venture_id, customer_id, site_id,
          1, ?, 'declined', 'grant-declined', ?
        FROM frigora_quotations WHERE id = ?
      `).run(declinedVersion.document_hash, NOW, declineSource.id);
      decisionDb.prepare("UPDATE frigora_quotation_versions SET status = 'declined' WHERE quotation_id = ? AND version_number = 1").run(declineSource.id);
      assert.equal(versionRow(decisionDb, declineSource.id, 1).status, "declined");
      assert.equal(versionRow(decisionDb, declineSource.id, 1).document_hash, declinedVersion.document_hash);
      reject(decisionDb, "INSERT INTO frigora_quotation_versions (quotation_id, workspace_id, venture_id, version_number, status, description, total_minor, currency, document_hash) VALUES (?, ?, ?, 2, 'approved', 'Skip', 1, 'ZAR', 'hash-direct')", [declineSource.id, owner.workspaceId, owner.ventureId]);
    } finally {
      decisionDb.close();
    }
  });
});

type AttackTarget = {
  headerId: string;
  lineId: string;
  otherId: string;
  workspaceId: string;
  ventureId: string;
  versionOneHash: string;
  historicalHeaderHash: string;
  identityOnly?: boolean;
};

async function runAttacks(db: RawDatabase, foreignKeys: number, recursiveTriggers: number, target: AttackTarget) {
  setMode(db, foreignKeys, recursiveTriggers);
  const current = versionRow(db, target.lineId, 2);
  const identityStatements = [
    "UPDATE frigora_quotation_versions SET quotation_id = 'other-quote' WHERE quotation_id = ? AND version_number = 2",
    "UPDATE frigora_quotation_versions SET version_number = 9 WHERE quotation_id = ? AND version_number = 2",
    "UPDATE frigora_quotation_versions SET workspace_id = 'ws-forged' WHERE quotation_id = ? AND version_number = 2",
    "UPDATE frigora_quotation_versions SET venture_id = 'ven-forged' WHERE quotation_id = ? AND version_number = 2",
    "UPDATE frigora_quotation_versions SET quotation_id = 'other-quote', version_number = 9 WHERE quotation_id = ? AND version_number = 2",
    "UPDATE frigora_quotation_versions SET workspace_id = 'ws-forged', venture_id = 'ven-forged' WHERE quotation_id = ? AND version_number = 2",
    "UPDATE frigora_quotation_versions SET quotation_id = 'other-quote', version_number = 9, workspace_id = 'ws-forged', venture_id = 'ven-forged' WHERE quotation_id = ? AND version_number = 2",
  ];
  for (const sql of identityStatements) {
    reject(db, sql, [target.lineId]);
    const stored = versionRow(db, target.lineId, 2);
    assert.equal(stored.quotation_id, target.lineId ? current.quotation_id : current.quotation_id);
    assert.equal(stored.version_number, 2);
    assert.equal(stored.workspace_id, target.workspaceId);
    assert.equal(stored.venture_id, target.ventureId);
    assert.equal(stored.document_hash, current.document_hash);
    assert.deepEqual(seals(db, target.lineId, 2).map((row) => row.copy), [0, 1]);
  }
  assert.throws(
    () => db.prepare("DELETE FROM frigora_quotations WHERE id = ?").run(target.headerId),
    /quotation identity and version history cannot be rewritten/,
  );
  assert.equal(
    Number((db.prepare("SELECT current_version FROM frigora_quotations WHERE id = ?").get(target.headerId) as { current_version: number }).current_version),
    2,
  );
  assert.equal(seals(db, target.headerId, 2).length, 2);
  if (target.identityOnly) {
    return;
  }

  reject(db, "UPDATE frigora_quotation_versions SET document_hash = 'hash-forged' WHERE quotation_id = ? AND version_number = 1", [target.lineId]);
  assert.equal(versionRow(db, target.lineId, 1).document_hash, target.versionOneHash);
  reject(db, "DELETE FROM frigora_quotation_versions WHERE quotation_id = ? AND version_number = 2", [target.headerId]);
  assert.equal(versionRow(db, target.headerId, 2).description, "Lineless revision");
  assert.equal(seals(db, target.headerId, 2).length, 2);
  const versionColumns = (db.prepare("PRAGMA table_info(frigora_quotation_versions)").all() as Array<{ name: string }>).map((column) => column.name);
  const forgedSelect = versionColumns.map((column) => column === "document_hash" ? "'hash-forged'" : column).join(", ");
  const headerVersionHash = versionRow(db, target.headerId, 2).document_hash;
  const replaceVersion = `REPLACE INTO frigora_quotation_versions (${versionColumns.join(", ")}) SELECT ${forgedSelect} FROM frigora_quotation_versions WHERE quotation_id = ? AND version_number = 2`;
  reject(db, replaceVersion, [target.headerId]);
  reject(db, replaceVersion.replace("REPLACE INTO", "INSERT OR REPLACE INTO"), [target.headerId]);
  assert.equal(versionRow(db, target.headerId, 2).document_hash, headerVersionHash);
  assert.equal(versionRow(db, target.headerId, 1).document_hash, target.historicalHeaderHash);
  reject(
    db,
    "INSERT INTO frigora_quotation_versions (quotation_id, workspace_id, venture_id, version_number, status, description, total_minor, currency, document_hash) VALUES (?, ?, ?, 999, 'in_preparation', 'Skipped', 1, 'ZAR', 'hash-999')",
    [target.headerId, target.workspaceId, target.ventureId],
  );
  assert.equal(versionRow(db, target.headerId, 999), undefined);
  const headerColumns = (db.prepare("PRAGMA table_info(frigora_quotations)").all() as Array<{ name: string }>).map((column) => column.name);
  const headerSelect = (version: number) => headerColumns.map((column) => column === "current_version" ? String(version) : column).join(", ");
  reject(
    db,
    `REPLACE INTO frigora_quotations (${headerColumns.join(", ")}) SELECT ${headerSelect(1)} FROM frigora_quotations WHERE id = ?`,
    [target.headerId],
  );
  reject(
    db,
    `REPLACE INTO frigora_quotations (${headerColumns.join(", ")}) SELECT ${headerSelect(999)} FROM frigora_quotations WHERE id = ?`,
    [target.headerId],
  );
  reject(db, "UPDATE frigora_quotations SET current_version = 999 WHERE id = ?", [target.headerId]);
  reject(db, "UPDATE frigora_quotations SET current_version = current_version + 2 WHERE id = ?", [target.lineId]);
  assert.equal(
    Number((db.prepare("SELECT current_version FROM frigora_quotations WHERE id = ?").get(target.headerId) as { current_version: number }).current_version),
    2,
  );

  for (const copy of [0, 1]) {
    reject(db, "DELETE FROM frigora_quotation_version_seals WHERE quotation_id = ? AND version_number = 2 AND copy = ?", [target.lineId, copy]);
    reject(db, "UPDATE frigora_quotation_version_seals SET workspace_id = 'ws-forged' WHERE quotation_id = ? AND version_number = 2 AND copy = ?", [target.lineId, copy]);
    reject(db, "REPLACE INTO frigora_quotation_version_seals (quotation_id, version_number, copy, workspace_id, venture_id) VALUES (?, 2, ?, 'ws-forged', ?)", [target.lineId, copy, target.ventureId]);
  }
  assert.deepEqual(
    seals(db, target.lineId, 2).map((row) => [row.copy, row.workspace_id, row.venture_id]),
    [[0, target.workspaceId, target.ventureId], [1, target.workspaceId, target.ventureId]],
  );

  const historicalLine = db.prepare(
    "SELECT id, description FROM frigora_quotation_line_snapshots WHERE quotation_id = ? AND version_number = 1",
  ).get(target.lineId) as { id: string; description: string };
  const currentLine = db.prepare(
    "SELECT id FROM frigora_quotation_line_snapshots WHERE quotation_id = ? AND version_number = 2",
  ).get(target.lineId) as { id: string };
  reject(db, "UPDATE frigora_quotation_line_snapshots SET description = 'tamper' WHERE id = ?", [historicalLine.id]);
  reject(db, "DELETE FROM frigora_quotation_line_snapshots WHERE id = ?", [historicalLine.id]);
  const lineColumns = (db.prepare("PRAGMA table_info(frigora_quotation_line_snapshots)").all() as Array<{ name: string }>).map((column) => column.name);
  const movedSelect = lineColumns.map((column) => {
    if (column === "quotation_id") return "?";
    if (column === "version_number") return "1";
    if (column === "line_number") return "9";
    return column;
  }).join(", ");
  reject(
    db,
    `REPLACE INTO frigora_quotation_line_snapshots (${lineColumns.join(", ")}) SELECT ${movedSelect} FROM frigora_quotation_line_snapshots WHERE id = ?`,
    [target.otherId, currentLine.id],
  );
  const promotedSelect = lineColumns.map((column) => {
    if (column === "version_number") return "2";
    if (column === "line_number") return "8";
    if (column === "description") return "'promoted'";
    return column;
  }).join(", ");
  reject(
    db,
    `REPLACE INTO frigora_quotation_line_snapshots (${lineColumns.join(", ")}) SELECT ${promotedSelect} FROM frigora_quotation_line_snapshots WHERE id = ?`,
    [historicalLine.id],
  );
  const storedHistorical = db.prepare(
    "SELECT quotation_id, version_number, description FROM frigora_quotation_line_snapshots WHERE id = ?",
  ).get(historicalLine.id) as { quotation_id: string; version_number: number; description: string };
  assert.equal(storedHistorical.quotation_id, target.lineId);
  assert.equal(storedHistorical.version_number, 1);
  assert.equal(storedHistorical.description, "Identity gasket");
  assert.equal(versionRow(db, target.lineId, 1).document_hash, target.versionOneHash);
  const otherCount = db.prepare(
    "SELECT COUNT(*) AS n FROM frigora_quotation_line_snapshots WHERE quotation_id = ?",
  ).get(target.otherId) as { n: number };
  assert.equal(Number(otherCount.n), 1);
}

function quoteInput(recommendationId: string, description = "Replace compressor") {
  return {
    recommendedActionId: recommendationId,
    description,
    commercial: exampleQuotationCommercial(),
  };
}

function customDraft(description: string) {
  return {
    lineNumber: 1,
    lineRole: "mandatory" as const,
    source: "custom" as const,
    description,
    unit: "each" as const,
    quantityMilli: 0,
    unitPriceMinor: 15000,
    taxTreatment: "not_registered" as const,
  };
}

async function seed(options: { reset?: boolean } = {}) {
  if (options.reset !== false) {
    await resetPersistenceLifecycle();
    await ensureSchema();
  }
  const workspaceId = "ws-h03" as WorkspaceId;
  const ventureId = "ven-h03" as VentureId;
  const userId = "user-owner" as UserId;
  const persistence = getPersistence();
  await persistence.organisations.insert({
    id: workspaceId,
    name: "Integrity",
    slug: "ws-h03",
    createdAt: NOW,
  });
  await persistence.memberships.setRole({ userId, workspaceId, role: "owner", createdAt: NOW });
  await persistence.ventures.insert(ventureRow());
  const store: FrigoraStore = createFrigoraStore();
  const permissions: PermissionService = createPermissionService(createDbMembershipStore());
  const scope = { userId, workspaceId, ventureId } satisfies FrigoraScope;
  await allowSyntheticNotRegisteredQuotationSend(createFrigoraService({ store, permissions }), scope);
  return { workspaceId, ventureId, userId, store, scope, permissions };
}

function ventureRow(): PersistedVenture {
  return {
    id: "ven-h03" as VentureId,
    workspaceId: "ws-h03" as WorkspaceId,
    name: "Integrity",
    slug: "venture-h03",
    stage: "Idea",
    href: "/ventures/hq/h03",
    foundedAt: NOW,
    category: "Operations",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Verify.",
      category: "Operations",
      stage: "Idea",
      goal: "Verify.",
      posture: "human-led",
      risk: "focused",
      motion: "Verify.",
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
  };
}

async function seedRecommendation(owner: Awaited<ReturnType<typeof seed>>, reference: string) {
  const attendeeId = "user-attendee" as UserId;
  await getPersistence().memberships.setRole({
    userId: attendeeId,
    workspaceId: owner.workspaceId,
    role: "member",
    createdAt: NOW,
  });
  const service = createFrigoraService({ store: owner.store, permissions: owner.permissions });
  const customer = await service.createCustomer(owner.scope, { code: `FUEL-${reference}`, displayName: "FuelCo" });
  const site = await service.createSite(owner.scope, { customerId: customer.id, code: `SITE-${reference}`, name: "Sandton" });
  const asset = await service.createAsset(owner.scope, { siteId: site.id, tag: `EVAP-${reference}`, name: "Evaporator" });
  const workOrder = await service.createWorkOrder(owner.scope, {
    siteId: site.id,
    workReference: reference,
    workKind: "reactive",
    primaryAssetId: asset.id,
    reportedCondition: "warm",
  });
  const visit = await service.recordVisitArrival(owner.scope, workOrder.id, { userId: attendeeId, arrivedAt: NOW });
  return service.recordRecommendedAction(owner.scope, visit.id, {
    description: "Replace compressor",
    recommendedAt: NOW,
    recommendedByUserId: attendeeId,
    recordedByUserId: attendeeId,
    assetId: asset.id,
  });
}
