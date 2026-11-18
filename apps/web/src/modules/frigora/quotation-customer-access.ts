import { ensureSchema, getClient } from "@/platform/persistence/db";
import { FrigoraError } from "./errors";
import { issuePersistedQuotationDecisionGrant } from "./quotation-commands";
import type { FrigoraStore } from "./store";
import type {
  FrigoraCustomerContactId,
  FrigoraQuotationId,
  FrigoraScope,
} from "./types";

export type QuotationCustomerAccessActivation = {
  grantId: string;
  version: number;
  expiresAt: string;
  /** Relative test-only URL. The fragment is the secret. This is not an email and not delivery. */
  testOnlyPath: string;
};

export type QuotationCustomerAccessActivationInput = {
  expectedCurrentVersion: number;
  /** Runs after the preliminary eligibility read and before the guarded grant insert. */
  beforeGuardedWrite?: () => Promise<void>;
};

export async function activatePersistedQuotationCustomerAccess(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: QuotationCustomerAccessActivationInput,
  now: () => string,
): Promise<QuotationCustomerAccessActivation> {
  const quotation = await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId);
  if (!quotation) {
    throw new FrigoraError("not_found", "Quotation was not found.");
  }
  await ensureSchema();
  const contacts = await getClient().execute({
    sql: `
      SELECT c.id
      FROM frigora_customer_contacts c
      INNER JOIN frigora_quotation_contact_designations d
        ON d.contact_id = c.id
       AND d.workspace_id = c.workspace_id
       AND d.venture_id = c.venture_id
       AND d.revoked_at IS NULL
      WHERE c.workspace_id = ?
        AND c.venture_id = ?
        AND c.customer_id = ?
        AND c.site_id = ?
        AND c.status = 'active'
        AND (
          c.email_verified_at IS NOT NULL
          OR EXISTS (
            SELECT 1
            FROM frigora_contact_supervised_verifications s
            WHERE s.contact_id = c.id
              AND s.workspace_id = c.workspace_id
              AND s.venture_id = c.venture_id
              AND s.revoked_at IS NULL
          )
        )
    `,
    args: [scope.workspaceId, scope.ventureId, quotation.customerId, quotation.siteId],
  });
  if (contacts.rows.length !== 1) {
    throw new FrigoraError(
      "decision_rejected",
      "A test link needs exactly one active designated contact with mailbox verification or a current supervised verification.",
    );
  }
  const contactId = String(contacts.rows[0]?.id) as FrigoraCustomerContactId;
  let proof: { grantId: string; secret: string; expiresAt: string; version: number } | null = null;
  await issuePersistedQuotationDecisionGrant(
    store,
    scope,
    quotationId,
    { expectedCurrentVersion: input.expectedCurrentVersion },
    {
      async deliver(issued) {
        proof = {
          grantId: issued.grantId,
          secret: issued.secret,
          expiresAt: issued.expiresAt,
          version: issued.version,
        };
      },
    },
    now,
    contactId,
    { eligibility: "test_link", beforeGuardedWrite: input.beforeGuardedWrite },
  );
  if (!proof) {
    throw new FrigoraError("customer_delivery_unavailable", "The test decision link was not created.");
  }
  const issued = proof as { grantId: string; secret: string; expiresAt: string; version: number };
  return {
    grantId: issued.grantId,
    version: issued.version,
    expiresAt: issued.expiresAt,
    testOnlyPath: `/quotation-decision/${issued.grantId}#${encodeURIComponent(issued.secret)}`,
  };
}
