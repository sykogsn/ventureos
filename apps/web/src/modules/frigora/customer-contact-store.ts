import { timingSafeEqual } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { and, eq } from "drizzle-orm";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { createId } from "@/platform/ids";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import {
  frigoraContactSupervisedVerifications,
  frigoraContactVerificationChallenges,
  frigoraCustomerContacts,
  frigoraQuotationContactDesignations,
  frigoraVentureMailIdentities,
} from "@/platform/persistence/schema";
import { FrigoraError } from "./errors";
import { withFrigoraWriteTransaction, type FrigoraWriteClientFactory } from "./owned-write";
import type {
  FrigoraContactVerificationChallengeId,
  FrigoraCustomerContact,
  FrigoraCustomerContactAccess,
  FrigoraCustomerContactId,
  FrigoraCustomerId,
  FrigoraSiteId,
  FrigoraSupervisedVerification,
  FrigoraSupervisedVerificationMethod,
  FrigoraVentureMailIdentity,
} from "./types";

function sameSecretHash(stored: string, presented: string) {
  const expected = Buffer.from(stored);
  const actual = Buffer.from(presented);
  return expected.length > 0 && expected.length === actual.length && timingSafeEqual(expected, actual);
}

function lockedDatabase(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /SQLITE_BUSY|database is locked/i.test(message);
}

function duplicateContact(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /frigora_customer_contacts/i.test(message) && /UNIQUE/i.test(message);
}

function duplicateCurrentVerification(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /supervised_verifications/i.test(message) && /UNIQUE/i.test(message);
}

type GrantInvalidationReason =
  | "supervised_verification_revoked"
  | "email_changed"
  | "display_name_changed"
  | "contact_revoked"
  | "designation_revoked"
  | "designation_changed";

async function writeAudit(
  transaction: Transaction,
  input: {
    action: string;
    occurredAt: string;
    actorUserId: string;
    workspaceId: string;
    ventureId: string;
    metadata: Record<string, string>;
  },
) {
  await transaction.execute({
    sql: `
      INSERT INTO audit_events (
        id, action, occurred_at, actor_user_id, actor_kind,
        actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
      ) VALUES (?, ?, ?, ?, 'human', NULL, NULL, ?, ?, ?)
    `,
    args: [
      createId(),
      input.action,
      input.occurredAt,
      input.actorUserId,
      input.workspaceId,
      input.ventureId,
      JSON.stringify(input.metadata),
    ],
  });
}

async function revokeOutstandingGrantsForContact(
  transaction: Transaction,
  input: {
    contactId: string;
    workspaceId: string;
    ventureId: string;
    revokedAt: string;
    actorUserId: string;
    reason: GrantInvalidationReason;
  },
) {
  const grants = await transaction.execute({
    sql: `
      SELECT id, quotation_id
      FROM frigora_quotation_decision_grants
      WHERE contact_id = ?
        AND workspace_id = ?
        AND venture_id = ?
        AND consumed_at IS NULL
        AND revoked_at IS NULL
    `,
    args: [input.contactId, input.workspaceId, input.ventureId],
  });
  for (const row of grants.rows) {
    const grantId = String(row.id);
    const updated = await transaction.execute({
      sql: `
        UPDATE frigora_quotation_decision_grants
        SET revoked_at = ?
        WHERE id = ?
          AND workspace_id = ?
          AND venture_id = ?
          AND contact_id = ?
          AND consumed_at IS NULL
          AND revoked_at IS NULL
      `,
      args: [input.revokedAt, grantId, input.workspaceId, input.ventureId, input.contactId],
    });
    if (updated.rowsAffected !== 1) {
      throw new FrigoraError("decision_rejected", "Outstanding decision grant could not be revoked.");
    }
    await writeAudit(transaction, {
      action: "frigora.quotation.customer_access_revoked",
      occurredAt: input.revokedAt,
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      ventureId: input.ventureId,
      metadata: {
        grantId,
        contactId: input.contactId,
        quotationId: String(row.quotation_id ?? ""),
        reason: input.reason,
      },
    });
  }
}

async function revokeCurrentSupervisedVerification(
  transaction: Transaction,
  input: {
    contactId: string;
    workspaceId: string;
    ventureId: string;
    revokedAt: string;
    actorUserId: string;
    reason: string;
  },
) {
  const current = await transaction.execute({
    sql: `
      SELECT id
      FROM frigora_contact_supervised_verifications
      WHERE contact_id = ? AND workspace_id = ? AND venture_id = ? AND revoked_at IS NULL
    `,
    args: [input.contactId, input.workspaceId, input.ventureId],
  });
  if (current.rows.length === 0) {
    return;
  }
  if (current.rows.length !== 1) {
    throw new FrigoraError("invalid_status", "Supervised verification could not be revoked.");
  }
  const verificationId = String(current.rows[0]?.id);
  const updated = await transaction.execute({
    sql: `
      UPDATE frigora_contact_supervised_verifications
      SET revoked_at = ?, revoked_by_user_id = ?
      WHERE id = ? AND workspace_id = ? AND venture_id = ? AND revoked_at IS NULL
    `,
    args: [input.revokedAt, input.actorUserId, verificationId, input.workspaceId, input.ventureId],
  });
  if (updated.rowsAffected !== 1) {
    throw new FrigoraError("invalid_status", "Supervised verification could not be revoked.");
  }
  await writeAudit(transaction, {
    action: "frigora.customer_contact.supervised_verification_revoked",
    occurredAt: input.revokedAt,
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    ventureId: input.ventureId,
    metadata: {
      verificationId,
      contactId: input.contactId,
      reason: input.reason,
    },
  });
}

function mapContact(
  row: typeof frigoraCustomerContacts.$inferSelect,
  designation: typeof frigoraQuotationContactDesignations.$inferSelect | undefined,
): FrigoraCustomerContact {
  if (row.status !== "active" && row.status !== "revoked") {
    throw new FrigoraError("invalid_status", "Unknown customer contact status.");
  }
  return {
    id: row.id as FrigoraCustomerContactId,
    workspaceId: row.workspaceId as WorkspaceId,
    ventureId: row.ventureId as VentureId,
    customerId: row.customerId as FrigoraCustomerId,
    siteId: row.siteId as FrigoraSiteId,
    displayName: row.displayName,
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt ?? null,
    status: row.status,
    createdByUserId: row.createdByUserId as UserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    designation: designation
      ? {
          contactId: designation.contactId as FrigoraCustomerContactId,
          basis: designation.basis,
          designatedByUserId: designation.designatedByUserId as UserId,
          designatedAt: designation.designatedAt,
          revokedAt: designation.revokedAt ?? null,
          revokedByUserId: (designation.revokedByUserId as UserId | null) ?? null,
        }
      : null,
  };
}

function mapSupervisedVerification(
  row: typeof frigoraContactSupervisedVerifications.$inferSelect,
): FrigoraSupervisedVerification {
  if (row.method !== "telephone" && row.method !== "in_person") {
    throw new FrigoraError("invalid_status", "Unknown supervised verification method.");
  }
  return {
    id: row.id,
    contactId: row.contactId as FrigoraCustomerContactId,
    method: row.method,
    verifiedByUserId: row.verifiedByUserId as UserId,
    verifiedAt: row.verifiedAt,
    evidenceNote: row.evidenceNote,
    revokedAt: row.revokedAt ?? null,
    revokedByUserId: (row.revokedByUserId as UserId | null) ?? null,
  };
}

export function createCustomerContactPersistence(createWriteClient?: FrigoraWriteClientFactory) {
  return {
    async findCustomerContact(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      contactId: FrigoraCustomerContactId,
    ): Promise<FrigoraCustomerContact | null> {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraCustomerContacts)
        .where(
          and(
            eq(frigoraCustomerContacts.id, contactId),
            eq(frigoraCustomerContacts.workspaceId, workspaceId),
            eq(frigoraCustomerContacts.ventureId, ventureId),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) {
        return null;
      }
      const designations = await getDb()
        .select()
        .from(frigoraQuotationContactDesignations)
        .where(
          and(
            eq(frigoraQuotationContactDesignations.contactId, contactId),
            eq(frigoraQuotationContactDesignations.workspaceId, workspaceId),
            eq(frigoraQuotationContactDesignations.ventureId, ventureId),
          ),
        )
        .limit(1);
      return mapContact(row, designations[0]);
    },
    async insertCustomerContact(input: {
      id: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      customerId: FrigoraCustomerId;
      siteId: FrigoraSiteId;
      displayName: string;
      email: string;
      createdByUserId: UserId;
      createdAt: string;
    }) {
      await ensureSchema();
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          const inserted = await transaction.execute({
            sql: `
              INSERT INTO frigora_customer_contacts (
                id, workspace_id, venture_id, customer_id, site_id, display_name, email,
                email_verified_at, status, created_by_user_id, created_at, updated_at
              )
              SELECT ?, s.workspace_id, s.venture_id, s.customer_id, s.id, ?, ?, NULL, 'active', ?, ?, ?
              FROM frigora_sites s
              JOIN frigora_customers c
                ON c.id = s.customer_id
               AND c.workspace_id = s.workspace_id
               AND c.venture_id = s.venture_id
               AND c.status = 'active'
              WHERE s.id = ?
                AND s.workspace_id = ?
                AND s.venture_id = ?
                AND s.customer_id = ?
                AND s.status = 'active'
            `,
            args: [
              input.id,
              input.displayName,
              input.email,
              input.createdByUserId,
              input.createdAt,
              input.createdAt,
              input.siteId,
              input.workspaceId,
              input.ventureId,
              input.customerId,
            ],
          });
          if (inserted.rowsAffected !== 1) {
            throw new FrigoraError("not_found", "Customer site was not found.");
          }
          await writeAudit(transaction, {
            action: "frigora.customer_contact.created",
            occurredAt: input.createdAt,
            actorUserId: input.createdByUserId,
            workspaceId: input.workspaceId,
            ventureId: input.ventureId,
            metadata: {
              contactId: input.id,
              customerId: input.customerId,
              siteId: input.siteId,
            },
          });
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (duplicateContact(error)) {
          throw new FrigoraError("duplicate", "A contact with that email already exists for this site.");
        }
        throw error;
      }
    },
    async designateQuotationContact(input: {
      contactId: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      basis: string;
      actorUserId: UserId;
      designatedAt: string;
    }) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        const contact = await transaction.execute({
          sql: `
            SELECT customer_id, site_id, status
            FROM frigora_customer_contacts
            WHERE id = ? AND workspace_id = ? AND venture_id = ?
          `,
          args: [input.contactId, input.workspaceId, input.ventureId],
        });
        const row = contact.rows[0];
        if (!row || String(row.status) !== "active") {
          throw new FrigoraError("not_found", "Customer contact was not found.");
        }
        await transaction.execute({
          sql: `
            INSERT INTO frigora_quotation_contact_designations (
              contact_id, workspace_id, venture_id, customer_id, site_id, basis,
              designated_by_user_id, designated_at, revoked_at, revoked_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
            ON CONFLICT(contact_id) DO UPDATE SET
              basis = excluded.basis,
              designated_by_user_id = excluded.designated_by_user_id,
              designated_at = excluded.designated_at,
              revoked_at = NULL,
              revoked_by_user_id = NULL
            WHERE frigora_quotation_contact_designations.workspace_id = excluded.workspace_id
              AND frigora_quotation_contact_designations.venture_id = excluded.venture_id
          `,
          args: [
            input.contactId,
            input.workspaceId,
            input.ventureId,
            String(row.customer_id),
            String(row.site_id),
            input.basis,
            input.actorUserId,
            input.designatedAt,
          ],
        });
        await writeAudit(transaction, {
          action: "frigora.customer_contact.designated",
          occurredAt: input.designatedAt,
          actorUserId: input.actorUserId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          metadata: {
            contactId: input.contactId,
            customerId: String(row.customer_id),
            siteId: String(row.site_id),
            basis: input.basis,
          },
        });
        await revokeOutstandingGrantsForContact(transaction, {
          contactId: input.contactId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          revokedAt: input.designatedAt,
          actorUserId: input.actorUserId,
          reason: "designation_changed",
        });
      }, createWriteClient);
    },
    async revokeQuotationContactDesignation(input: {
      contactId: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      actorUserId: UserId;
      revokedAt: string;
    }) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        const updated = await transaction.execute({
          sql: `
            UPDATE frigora_quotation_contact_designations
            SET revoked_at = ?, revoked_by_user_id = ?
            WHERE contact_id = ?
              AND workspace_id = ?
              AND venture_id = ?
              AND revoked_at IS NULL
          `,
          args: [input.revokedAt, input.actorUserId, input.contactId, input.workspaceId, input.ventureId],
        });
        if (updated.rowsAffected !== 1) {
          throw new FrigoraError("invalid_status", "Quotation designation is not active.");
        }
        await writeAudit(transaction, {
          action: "frigora.customer_contact.designation_revoked",
          occurredAt: input.revokedAt,
          actorUserId: input.actorUserId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          metadata: { contactId: input.contactId },
        });
        await revokeOutstandingGrantsForContact(transaction, {
          contactId: input.contactId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          revokedAt: input.revokedAt,
          actorUserId: input.actorUserId,
          reason: "designation_revoked",
        });
      }, createWriteClient);
    },
    async revokeCustomerContact(input: {
      contactId: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      actorUserId: UserId;
      revokedAt: string;
    }) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        const updated = await transaction.execute({
          sql: `
            UPDATE frigora_customer_contacts
            SET status = 'revoked', updated_at = ?
            WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'active'
          `,
          args: [input.revokedAt, input.contactId, input.workspaceId, input.ventureId],
        });
        if (updated.rowsAffected !== 1) {
          throw new FrigoraError("not_found", "Customer contact was not found.");
        }
        await transaction.execute({
          sql: `
            UPDATE frigora_quotation_contact_designations
            SET revoked_at = ?, revoked_by_user_id = ?
            WHERE contact_id = ? AND workspace_id = ? AND venture_id = ? AND revoked_at IS NULL
          `,
          args: [input.revokedAt, input.actorUserId, input.contactId, input.workspaceId, input.ventureId],
        });
        await transaction.execute({
          sql: `
            UPDATE frigora_contact_verification_challenges
            SET revoked_at = ?
            WHERE contact_id = ? AND workspace_id = ? AND venture_id = ?
              AND consumed_at IS NULL AND revoked_at IS NULL
          `,
          args: [input.revokedAt, input.contactId, input.workspaceId, input.ventureId],
        });
        await revokeCurrentSupervisedVerification(transaction, {
          contactId: input.contactId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          revokedAt: input.revokedAt,
          actorUserId: input.actorUserId,
          reason: "contact_revoked",
        });
        await writeAudit(transaction, {
          action: "frigora.customer_contact.revoked",
          occurredAt: input.revokedAt,
          actorUserId: input.actorUserId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          metadata: { contactId: input.contactId },
        });
        await revokeOutstandingGrantsForContact(transaction, {
          contactId: input.contactId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          revokedAt: input.revokedAt,
          actorUserId: input.actorUserId,
          reason: "contact_revoked",
        });
      }, createWriteClient);
    },
    async updateCustomerContact(input: {
      contactId: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      displayName: string;
      email: string;
      updatedAt: string;
      actorUserId: UserId;
    }) {
      await ensureSchema();
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          const existing = await transaction.execute({
            sql: `
              SELECT email, display_name FROM frigora_customer_contacts
              WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'active'
            `,
            args: [input.contactId, input.workspaceId, input.ventureId],
          });
          const row = existing.rows[0];
          if (!row) {
            throw new FrigoraError("not_found", "Customer contact was not found.");
          }
          const emailChanged = String(row.email) !== input.email;
          const nameChanged = String(row.display_name) !== input.displayName;
          const updated = await transaction.execute({
            sql: `
              UPDATE frigora_customer_contacts
              SET display_name = ?,
                  email = ?,
                  email_verified_at = CASE WHEN ? = 1 THEN NULL ELSE email_verified_at END,
                  updated_at = ?
              WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'active'
            `,
            args: [
              input.displayName,
              input.email,
              emailChanged ? 1 : 0,
              input.updatedAt,
              input.contactId,
              input.workspaceId,
              input.ventureId,
            ],
          });
          if (updated.rowsAffected !== 1) {
            throw new FrigoraError("not_found", "Customer contact was not found.");
          }
          if (emailChanged) {
            await transaction.execute({
              sql: `
                UPDATE frigora_contact_verification_challenges
                SET revoked_at = ?
                WHERE contact_id = ? AND workspace_id = ? AND venture_id = ?
                  AND consumed_at IS NULL AND revoked_at IS NULL
              `,
              args: [input.updatedAt, input.contactId, input.workspaceId, input.ventureId],
            });
          }
          if (emailChanged || nameChanged) {
            await revokeCurrentSupervisedVerification(transaction, {
              contactId: input.contactId,
              workspaceId: input.workspaceId,
              ventureId: input.ventureId,
              revokedAt: input.updatedAt,
              actorUserId: input.actorUserId,
              reason: emailChanged ? "email_changed" : "display_name_changed",
            });
            await revokeOutstandingGrantsForContact(transaction, {
              contactId: input.contactId,
              workspaceId: input.workspaceId,
              ventureId: input.ventureId,
              revokedAt: input.updatedAt,
              actorUserId: input.actorUserId,
              reason: emailChanged ? "email_changed" : "display_name_changed",
            });
          }
          await writeAudit(transaction, {
            action: "frigora.customer_contact.corrected",
            occurredAt: input.updatedAt,
            actorUserId: input.actorUserId,
            workspaceId: input.workspaceId,
            ventureId: input.ventureId,
            metadata: {
              contactId: input.contactId,
              emailChanged: emailChanged ? "true" : "false",
              displayNameChanged: nameChanged ? "true" : "false",
            },
          });
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (duplicateContact(error)) {
          throw new FrigoraError("duplicate", "A contact with that email already exists for this site.");
        }
        throw error;
      }
    },
    async insertContactVerificationChallenge(input: {
      id: FrigoraContactVerificationChallengeId;
      contactId: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      customerId: FrigoraCustomerId;
      siteId: FrigoraSiteId;
      secretHash: string;
      expiresAt: string;
      createdAt: string;
    }) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        await transaction.execute({
          sql: `
            UPDATE frigora_contact_verification_challenges
            SET revoked_at = ?
            WHERE contact_id = ? AND workspace_id = ? AND venture_id = ?
              AND consumed_at IS NULL AND revoked_at IS NULL
          `,
          args: [input.createdAt, input.contactId, input.workspaceId, input.ventureId],
        });
        const inserted = await transaction.execute({
          sql: `
            INSERT INTO frigora_contact_verification_challenges (
              id, contact_id, workspace_id, venture_id, customer_id, site_id,
              secret_hash, expires_at, created_at, consumed_at, revoked_at
            )
            SELECT ?, id, workspace_id, venture_id, customer_id, site_id, ?, ?, ?, NULL, NULL
            FROM frigora_customer_contacts
            WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'active'
          `,
          args: [
            input.id,
            input.secretHash,
            input.expiresAt,
            input.createdAt,
            input.contactId,
            input.workspaceId,
            input.ventureId,
          ],
        });
        if (inserted.rowsAffected !== 1) {
          throw new FrigoraError("not_found", "Customer contact was not found.");
        }
      }, createWriteClient);
    },
    async findContactVerificationBinding(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      challengeId: FrigoraContactVerificationChallengeId,
    ): Promise<{ contactId: FrigoraCustomerContactId } | null> {
      await ensureSchema();
      const rows = await getDb()
        .select({ contactId: frigoraContactVerificationChallenges.contactId })
        .from(frigoraContactVerificationChallenges)
        .where(
          and(
            eq(frigoraContactVerificationChallenges.id, challengeId),
            eq(frigoraContactVerificationChallenges.workspaceId, workspaceId),
            eq(frigoraContactVerificationChallenges.ventureId, ventureId),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? { contactId: row.contactId as FrigoraCustomerContactId } : null;
    },
    async revokeContactVerificationChallenge(input: {
      id: FrigoraContactVerificationChallengeId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      revokedAt: string;
    }) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        const updated = await transaction.execute({
          sql: `
            UPDATE frigora_contact_verification_challenges
            SET revoked_at = ?
            WHERE id = ? AND workspace_id = ? AND venture_id = ?
              AND consumed_at IS NULL AND revoked_at IS NULL
          `,
          args: [input.revokedAt, input.id, input.workspaceId, input.ventureId],
        });
        if (updated.rowsAffected === 1) {
          return;
        }
        const existing = await transaction.execute({
          sql: `
            SELECT revoked_at
            FROM frigora_contact_verification_challenges
            WHERE id = ? AND workspace_id = ? AND venture_id = ?
          `,
          args: [input.id, input.workspaceId, input.ventureId],
        });
        if (!existing.rows[0]?.revoked_at) {
          throw new FrigoraError("decision_rejected", "Verification challenge could not be revoked.");
        }
      }, createWriteClient);
    },
    async consumeContactVerificationChallenge(input: {
      id: FrigoraContactVerificationChallengeId;
      contactId: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      secretHash: string;
      now: string;
    }) {
      await ensureSchema();
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
        const found = await transaction.execute({
          sql: `
            SELECT secret_hash, contact_id, workspace_id, venture_id, expires_at, consumed_at, revoked_at
            FROM frigora_contact_verification_challenges
            WHERE id = ?
          `,
          args: [input.id],
        });
        const row = found.rows[0];
        if (
          !row
          || String(row.contact_id) !== input.contactId
          || String(row.workspace_id) !== input.workspaceId
          || String(row.venture_id) !== input.ventureId
          || !sameSecretHash(String(row.secret_hash), input.secretHash)
        ) {
          throw new FrigoraError("invalid_input", "Verification challenge is not valid.");
        }
        if (row.consumed_at || row.revoked_at) {
          throw new FrigoraError("invalid_status", "Verification challenge has already been used.");
        }
        if (Date.parse(String(row.expires_at)) <= Date.parse(input.now)) {
          throw new FrigoraError("invalid_status", "Verification challenge has expired.");
        }
        const consumed = await transaction.execute({
          sql: `
            UPDATE frigora_contact_verification_challenges
            SET consumed_at = ?
            WHERE id = ? AND secret_hash = ? AND consumed_at IS NULL AND revoked_at IS NULL
          `,
          args: [input.now, input.id, input.secretHash],
        });
        if (consumed.rowsAffected !== 1) {
          throw new FrigoraError("invalid_status", "Verification challenge has already been used.");
        }
        const verified = await transaction.execute({
          sql: `
            UPDATE frigora_customer_contacts
            SET email_verified_at = ?, updated_at = ?
            WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'active'
          `,
          args: [input.now, input.now, input.contactId, input.workspaceId, input.ventureId],
        });
        if (verified.rowsAffected !== 1) {
          throw new FrigoraError("not_found", "Customer contact was not found.");
        }
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (lockedDatabase(error)) {
          throw new FrigoraError("invalid_status", "Verification challenge has already been used.");
        }
        throw error;
      }
    },
    async findVentureMailIdentity(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
    ): Promise<FrigoraVentureMailIdentity | null> {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraVentureMailIdentities)
        .where(
          and(
            eq(frigoraVentureMailIdentities.workspaceId, workspaceId),
            eq(frigoraVentureMailIdentities.ventureId, ventureId),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        workspaceId: row.workspaceId as WorkspaceId,
        ventureId: row.ventureId as VentureId,
        fromName: row.fromName,
        fromEmail: row.fromEmail,
        updatedByUserId: row.updatedByUserId as UserId,
        updatedAt: row.updatedAt,
      };
    },
    async saveVentureMailIdentity(input: FrigoraVentureMailIdentity) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        await transaction.execute({
          sql: `
            INSERT INTO frigora_venture_mail_identities (
              workspace_id, venture_id, from_name, from_email, updated_by_user_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(workspace_id, venture_id) DO UPDATE SET
              from_name = excluded.from_name,
              from_email = excluded.from_email,
              updated_by_user_id = excluded.updated_by_user_id,
              updated_at = excluded.updated_at
          `,
          args: [
            input.workspaceId,
            input.ventureId,
            input.fromName,
            input.fromEmail,
            input.updatedByUserId,
            input.updatedAt,
          ],
        });
      }, createWriteClient);
    },
    async listCustomerContactsForSite(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      customerId: FrigoraCustomerId,
      siteId: FrigoraSiteId,
    ): Promise<FrigoraCustomerContactAccess[]> {
      await ensureSchema();
      const contacts = await getDb()
        .select()
        .from(frigoraCustomerContacts)
        .where(
          and(
            eq(frigoraCustomerContacts.workspaceId, workspaceId),
            eq(frigoraCustomerContacts.ventureId, ventureId),
            eq(frigoraCustomerContacts.customerId, customerId),
            eq(frigoraCustomerContacts.siteId, siteId),
          ),
        );
      const listed: FrigoraCustomerContactAccess[] = [];
      for (const row of contacts) {
        const designations = await getDb()
          .select()
          .from(frigoraQuotationContactDesignations)
          .where(
            and(
              eq(frigoraQuotationContactDesignations.contactId, row.id),
              eq(frigoraQuotationContactDesignations.workspaceId, workspaceId),
              eq(frigoraQuotationContactDesignations.ventureId, ventureId),
            ),
          )
          .limit(1);
        const verificationRows = await getDb()
          .select()
          .from(frigoraContactSupervisedVerifications)
          .where(
            and(
              eq(frigoraContactSupervisedVerifications.contactId, row.id),
              eq(frigoraContactSupervisedVerifications.workspaceId, workspaceId),
              eq(frigoraContactSupervisedVerifications.ventureId, ventureId),
            ),
          );
        listed.push({
          ...mapContact(row, designations[0]),
          supervisedVerifications: verificationRows
            .map(mapSupervisedVerification)
            .sort((left, right) => left.verifiedAt.localeCompare(right.verifiedAt) || left.id.localeCompare(right.id)),
        });
      }
      return listed.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    },
    async listSupervisedVerifications(
      workspaceId: WorkspaceId,
      ventureId: VentureId,
      contactId: FrigoraCustomerContactId,
    ): Promise<FrigoraSupervisedVerification[]> {
      await ensureSchema();
      const rows = await getDb()
        .select()
        .from(frigoraContactSupervisedVerifications)
        .where(
          and(
            eq(frigoraContactSupervisedVerifications.contactId, contactId),
            eq(frigoraContactSupervisedVerifications.workspaceId, workspaceId),
            eq(frigoraContactSupervisedVerifications.ventureId, ventureId),
          ),
        );
      return rows
        .map(mapSupervisedVerification)
        .sort((left, right) => left.verifiedAt.localeCompare(right.verifiedAt) || left.id.localeCompare(right.id));
    },
    async recordSupervisedVerification(input: {
      id: string;
      contactId: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      method: FrigoraSupervisedVerificationMethod;
      evidenceNote: string;
      actorUserId: UserId;
      verifiedAt: string;
    }) {
      await ensureSchema();
      if (input.method !== "telephone" && input.method !== "in_person") {
        throw new FrigoraError("invalid_input", "Supervised verification method is not recognised.");
      }
      const evidenceNote = input.evidenceNote.trim();
      if (evidenceNote.length === 0 || evidenceNote.length > 240) {
        throw new FrigoraError("invalid_input", "Supervised verification needs a short evidence note.");
      }
      try {
        await withFrigoraWriteTransaction(async (transaction) => {
          const inserted = await transaction.execute({
            sql: `
              INSERT INTO frigora_contact_supervised_verifications (
                id, contact_id, workspace_id, venture_id, method,
                verified_by_user_id, verified_at, evidence_note, revoked_at, revoked_by_user_id
              )
              SELECT ?, id, workspace_id, venture_id, ?, ?, ?, ?, NULL, NULL
              FROM frigora_customer_contacts
              WHERE id = ? AND workspace_id = ? AND venture_id = ? AND status = 'active'
            `,
            args: [
              input.id,
              input.method,
              input.actorUserId,
              input.verifiedAt,
              evidenceNote,
              input.contactId,
              input.workspaceId,
              input.ventureId,
            ],
          });
          if (inserted.rowsAffected !== 1) {
            throw new FrigoraError("not_found", "Customer contact was not found.");
          }
          await writeAudit(transaction, {
            action: "frigora.customer_contact.supervised_verification_recorded",
            occurredAt: input.verifiedAt,
            actorUserId: input.actorUserId,
            workspaceId: input.workspaceId,
            ventureId: input.ventureId,
            metadata: {
              verificationId: input.id,
              contactId: input.contactId,
              method: input.method,
            },
          });
        }, createWriteClient);
      } catch (error) {
        if (error instanceof FrigoraError) {
          throw error;
        }
        if (duplicateCurrentVerification(error)) {
          throw new FrigoraError(
            "duplicate",
            "This contact already has a current supervised verification.",
          );
        }
        throw error;
      }
    },
    async revokeSupervisedVerification(input: {
      contactId: FrigoraCustomerContactId;
      workspaceId: WorkspaceId;
      ventureId: VentureId;
      actorUserId: UserId;
      revokedAt: string;
    }) {
      await ensureSchema();
      await withFrigoraWriteTransaction(async (transaction) => {
        const current = await transaction.execute({
          sql: `
            SELECT id
            FROM frigora_contact_supervised_verifications
            WHERE contact_id = ? AND workspace_id = ? AND venture_id = ? AND revoked_at IS NULL
          `,
          args: [input.contactId, input.workspaceId, input.ventureId],
        });
        if (current.rows.length !== 1) {
          throw new FrigoraError("invalid_status", "Supervised verification is not current.");
        }
        await revokeCurrentSupervisedVerification(transaction, {
          contactId: input.contactId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          revokedAt: input.revokedAt,
          actorUserId: input.actorUserId,
          reason: "supervised_verification_revoked",
        });
        await revokeOutstandingGrantsForContact(transaction, {
          contactId: input.contactId,
          workspaceId: input.workspaceId,
          ventureId: input.ventureId,
          revokedAt: input.revokedAt,
          actorUserId: input.actorUserId,
          reason: "supervised_verification_revoked",
        });
      }, createWriteClient);
    },
  };
}
