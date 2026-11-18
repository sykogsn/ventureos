import { createHash, timingSafeEqual } from "node:crypto";
import { createId } from "@/platform/ids";
import { ensureSchema, getClient } from "@/platform/persistence/db";
import { getPersistence } from "@/platform/persistence/repositories";
import { FrigoraError } from "./errors";
import {
  lineTotalMinor,
  priceQuotationSelection,
  QuotationCommercialError,
  quotationOfferHash,
  type FrigoraQuotationCommercialSnapshot,
} from "./quotation-commercial";
import { offerLineFromSnapshot, readQuotationLineSnapshots } from "./quotation-lines";
import {
  formatQuotationMoney,
  type CustomerQuotationCommercialView,
  type CustomerQuotationLineView,
  type CustomerQuotationReview,
  type CustomerQuotationSubmission,
} from "./quotation-decision-contract";
import type { FrigoraStore } from "./store";
import type {
  FrigoraCustomerContactId,
  FrigoraCustomerId,
  FrigoraQuotationDecisionGrantId,
  FrigoraQuotationDecisionId,
  FrigoraQuotationEventId,
  FrigoraQuotationId,
  FrigoraSiteId,
} from "./types";
import type { VentureId, WorkspaceId } from "@/contracts";

export type { CustomerQuotationReview, CustomerQuotationSubmission };
export { formatQuotationMoney };

type ReadyGrant = {
  state: "ready";
  grantId: FrigoraQuotationDecisionGrantId;
  quotationId: FrigoraQuotationId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  customerId: FrigoraCustomerId;
  siteId: FrigoraSiteId;
  contactId: FrigoraCustomerContactId;
  version: number;
  description: string;
  currency: "ZAR";
  totalMinor: number;
  customerName: string;
  siteName: string;
  issuedAt: string | null;
  expiresAt: string;
  commercial: CustomerQuotationCommercialView | null;
  lines: CustomerQuotationLineView[];
  offerTotalMinor: number;
};

type InspectedGrant = Exclude<CustomerQuotationReview, { state: "ready" }> | ReadyGrant;

function secretHash(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function sameSecretHash(stored: string, presented: string) {
  const expected = Buffer.from(stored);
  const actual = Buffer.from(presented);
  return expected.length > 0 && expected.length === actual.length && timingSafeEqual(expected, actual);
}

function cell(row: Record<string, unknown>, key: string) {
  return row[key] == null ? "" : String(row[key]);
}

function toPublic(inspected: InspectedGrant): CustomerQuotationReview {
  if (inspected.state !== "ready") {
    return inspected;
  }
  return {
    state: "ready",
    version: inspected.version,
    description: inspected.description,
    currency: inspected.currency,
    totalMinor: inspected.totalMinor,
    customerName: inspected.customerName,
    siteName: inspected.siteName,
    issuedAt: inspected.issuedAt,
    expiresAt: inspected.expiresAt,
    commercial: inspected.commercial,
    lines: inspected.lines,
    offerTotalMinor: inspected.offerTotalMinor,
  };
}

function optionalInteger(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function issuedCommercial(row: Record<string, unknown>): CustomerQuotationCommercialView | null {
  const labourQuantityMilli = optionalInteger(row, "labour_quantity_milli");
  const labourRateMinor = optionalInteger(row, "labour_rate_minor");
  const labourAmountMinor = optionalInteger(row, "labour_amount_minor");
  const travelKilometresMilli = optionalInteger(row, "travel_kilometres_milli");
  const travelRateMinor = optionalInteger(row, "travel_rate_minor");
  const travelAmountMinor = optionalInteger(row, "travel_amount_minor");
  const taxableAmountMinor = optionalInteger(row, "taxable_amount_minor");
  const taxAmountMinor = optionalInteger(row, "tax_amount_minor");
  const labourUnit = cell(row, "labour_unit");
  const distanceBasis = cell(row, "distance_basis");
  const taxTreatment = cell(row, "tax_treatment");
  if (
    labourQuantityMilli == null
    || labourRateMinor == null
    || labourAmountMinor == null
    || travelKilometresMilli == null
    || travelRateMinor == null
    || travelAmountMinor == null
    || taxableAmountMinor == null
    || taxAmountMinor == null
    || labourUnit.length === 0
    || (distanceBasis !== "one_way" && distanceBasis !== "return")
    || (taxTreatment !== "not_registered" && taxTreatment !== "configured_rule")
  ) {
    return null;
  }
  return {
    labourQuantityMilli,
    labourUnit,
    labourRateMinor,
    labourAmountMinor,
    travelKilometresMilli,
    distanceBasis,
    travelRateMinor,
    travelAmountMinor,
    taxableAmountMinor,
    taxTreatment,
    taxAmountMinor,
    taxRateNumerator: optionalInteger(row, "tax_rate_numerator"),
    taxRateDenominator: optionalInteger(row, "tax_rate_denominator"),
  };
}

async function recordCustomerAccess(
  row: Record<string, unknown>,
  grantId: string,
  outcome: string,
  now: string,
) {
  await getClient().execute({
    sql: `
      INSERT INTO audit_events (
        id, action, occurred_at, actor_user_id, actor_kind,
        actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
      ) VALUES (?, 'frigora.quotation.customer_access', ?, NULL, NULL, NULL, NULL, ?, ?, ?)
    `,
    args: [
      createId(),
      now,
      cell(row, "workspace_id"),
      cell(row, "venture_id"),
      JSON.stringify({
        grantId,
        quotationId: cell(row, "quotation_id"),
        contactId: cell(row, "contact_id"),
        version: cell(row, "version_number"),
        outcome,
      }),
    ],
  });
}

async function inspectGrant(grantId: string, secret: string, now: string): Promise<InspectedGrant> {
  await ensureSchema();
  const found = await getClient().execute({
    sql: `
      SELECT g.secret_hash, g.revoked_at, g.consumed_at, g.expires_at, g.contact_id,
             g.quotation_id, g.workspace_id, g.venture_id, g.customer_id, g.site_id,
             g.version_number, g.document_hash,
             q.current_version,
             v.status AS version_status, v.description, v.total_minor, v.currency,
             v.document_hash AS version_hash, v.sent_at,
             v.labour_quantity_milli, v.labour_unit, v.labour_rate_minor, v.labour_amount_minor,
             v.travel_kilometres_milli, v.distance_basis, v.travel_rate_minor, v.travel_amount_minor,
             v.taxable_amount_minor, v.tax_treatment, v.tax_amount_minor,
             v.tax_rate_numerator, v.tax_rate_denominator,
             c.display_name AS customer_name,
             s.name AS site_name,
             d.decision AS recorded_decision
      FROM frigora_quotation_decision_grants g
      LEFT JOIN frigora_quotations q
        ON q.id = g.quotation_id
       AND q.workspace_id = g.workspace_id
       AND q.venture_id = g.venture_id
      LEFT JOIN frigora_quotation_versions v
        ON v.quotation_id = g.quotation_id
       AND v.workspace_id = g.workspace_id
       AND v.venture_id = g.venture_id
       AND v.version_number = g.version_number
      LEFT JOIN frigora_customers c
        ON c.id = g.customer_id
       AND c.workspace_id = g.workspace_id
       AND c.venture_id = g.venture_id
      LEFT JOIN frigora_sites s
        ON s.id = g.site_id
       AND s.workspace_id = g.workspace_id
       AND s.venture_id = g.venture_id
       AND s.customer_id = g.customer_id
      LEFT JOIN frigora_quotation_decisions d
        ON d.grant_id = g.id
       AND d.workspace_id = g.workspace_id
       AND d.venture_id = g.venture_id
      WHERE g.id = ?
    `,
    args: [grantId],
  });
  const row = found.rows[0] as Record<string, unknown> | undefined;
  const presented = secretHash(secret);
  const stored = row ? cell(row, "secret_hash") : "0".repeat(presented.length);
  if (!sameSecretHash(stored, presented) || !row || !cell(row, "contact_id")) {
    return { state: "invalid" };
  }
  const venture = await getPersistence().ventures.findById(cell(row, "venture_id") as VentureId);
  if (!venture || venture.workspaceId !== cell(row, "workspace_id") || venture.definitionId !== "frigora") {
    return { state: "invalid" };
  }
  if (cell(row, "revoked_at")) {
    await recordCustomerAccess(row, grantId, "revoked", now);
    return { state: "revoked" };
  }
  const version = Number(row.version_number);
  const recorded = cell(row, "recorded_decision");
  if (cell(row, "consumed_at") || recorded === "approved" || recorded === "declined") {
    if (recorded !== "approved" && recorded !== "declined") {
      return { state: "invalid" };
    }
    await recordCustomerAccess(row, grantId, "consumed", now);
    return { state: "used", decision: recorded, version };
  }
  const expiresAt = Date.parse(cell(row, "expires_at"));
  const nowMs = Date.parse(now);
  if (Number.isNaN(expiresAt) || Number.isNaN(nowMs) || expiresAt <= nowMs) {
    await recordCustomerAccess(row, grantId, "expired", now);
    return { state: "expired" };
  }
  const totalMinor = Number(row.total_minor);
  const description = cell(row, "description");
  const customerName = cell(row, "customer_name");
  const siteName = cell(row, "site_name");
  const current = row.current_version == null ? NaN : Number(row.current_version);
  const consistent = cell(row, "version_status") === "awaiting_customer_approval"
    && current === version
    && cell(row, "version_hash") === cell(row, "document_hash")
    && cell(row, "currency") === "ZAR"
    && Number.isInteger(totalMinor)
    && totalMinor >= 0
    && description.length > 0
    && customerName.length > 0
    && siteName.length > 0
    && cell(row, "customer_id").length > 0
    && cell(row, "site_id").length > 0;
  if (!consistent) {
    await recordCustomerAccess(row, grantId, "stale", now);
    return { state: "stale" };
  }
  const issuedAt = cell(row, "sent_at");
  const loadedLines = await readQuotationLineSnapshots(
    { workspaceId: cell(row, "workspace_id") as WorkspaceId, ventureId: cell(row, "venture_id") as VentureId },
    cell(row, "quotation_id"),
    version,
  );
  const snapshot = commercialSnapshot(row, totalMinor);
  if (loadedLines.length > 0 && !snapshot) {
    await recordCustomerAccess(row, grantId, "stale", now);
    return { state: "stale" };
  }
  if (snapshot) {
    const recomputed = quotationOfferHash({
      version,
      description,
      ...snapshot,
      lines: loadedLines.map(offerLineFromSnapshot),
    });
    if (recomputed !== cell(row, "document_hash")) {
      await recordCustomerAccess(row, grantId, "stale", now);
      return { state: "stale" };
    }
  }
  const offerTotalMinor = snapshot
    ? priceQuotationSelection(snapshot, loadedLines.map(offerLineFromSnapshot), []).offerTotalMinor
    : totalMinor;
  await recordCustomerAccess(row, grantId, "presented", now);
  return {
    state: "ready",
    grantId: grantId as FrigoraQuotationDecisionGrantId,
    quotationId: cell(row, "quotation_id") as FrigoraQuotationId,
    workspaceId: cell(row, "workspace_id") as WorkspaceId,
    ventureId: cell(row, "venture_id") as VentureId,
    customerId: cell(row, "customer_id") as FrigoraCustomerId,
    siteId: cell(row, "site_id") as FrigoraSiteId,
    contactId: cell(row, "contact_id") as FrigoraCustomerContactId,
    version,
    description,
    currency: "ZAR",
    totalMinor,
    customerName,
    siteName,
    issuedAt: issuedAt.length > 0 ? issuedAt : null,
    expiresAt: cell(row, "expires_at"),
    commercial: issuedCommercial(row),
    lines: loadedLines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      description: line.description,
      quantityMilli: line.quantityMilli,
      unit: line.unit,
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor: lineTotalMinor(line.quantityMilli, line.unitPriceMinor),
      lineRole: line.lineRole,
      taxTreatment: line.taxTreatment,
    })),
    offerTotalMinor,
  };
}

function commercialSnapshotFromInspected(inspected: ReadyGrant): FrigoraQuotationCommercialSnapshot {
  if (!inspected.commercial) {
    throw new QuotationCommercialError("The issued quotation has no commercial snapshot.");
  }
  return {
    ...inspected.commercial,
    currency: "ZAR",
    totalMinor: inspected.totalMinor,
    taxRuleId: null,
    taxRuleVersion: null,
  };
}

function commercialSnapshot(
  row: Record<string, unknown>,
  totalMinor: number,
): FrigoraQuotationCommercialSnapshot | null {
  const view = issuedCommercial(row);
  if (!view) return null;
  const taxRuleId = cell(row, "tax_rule_id");
  const taxRuleVersion = cell(row, "tax_rule_version");
  return {
    ...view,
    currency: "ZAR",
    totalMinor,
    taxRuleId: taxRuleId.length > 0 ? taxRuleId : null,
    taxRuleVersion: taxRuleVersion.length > 0 ? taxRuleVersion : null,
  };
}

export async function reviewCustomerQuotation(
  _store: FrigoraStore,
  input: { grantId: string; secret: string },
  now: () => string,
): Promise<CustomerQuotationReview> {
  if (!input.grantId || !input.secret) {
    return { state: "invalid" };
  }
  return toPublic(await inspectGrant(input.grantId, input.secret, now()));
}

export async function submitCustomerQuotation(
  store: FrigoraStore,
  input: {
    grantId: string;
    secret: string;
    decision: "approved" | "declined";
    selectedOptionalLineIds?: readonly string[];
  },
  now: () => string,
): Promise<CustomerQuotationSubmission> {
  if (!input.grantId || !input.secret || (input.decision !== "approved" && input.decision !== "declined")) {
    return { state: "invalid" };
  }
  const selectedOptionalLineIds = input.selectedOptionalLineIds ?? [];
  if (input.decision === "declined" && selectedOptionalLineIds.length > 0) {
    return { state: "invalid" };
  }
  const inspected = await inspectGrant(input.grantId, input.secret, now());
  if (inspected.state !== "ready") {
    return inspected;
  }
  const decidedAt = now();
  let selectionLines: Array<{ lineId: string; inclusion: "mandatory" | "selected_optional" }> = [];
  let authorisedTotalMinor: number | undefined;
  if (input.decision === "approved" && inspected.lines.length > 0) {
    if (!inspected.commercial) return { state: "stale" };
    const offerLines = inspected.lines.map((line) => ({
      id: line.id,
      lineNumber: line.lineNumber,
      catalogueItemId: null,
      sku: null,
      description: line.description,
      unit: line.unit,
      quantityMilli: line.quantityMilli,
      unitPriceMinor: line.unitPriceMinor,
      currency: "ZAR" as const,
      taxTreatment: line.taxTreatment,
      lineRole: line.lineRole,
    }));
    try {
      const priced = priceQuotationSelection(
        commercialSnapshotFromInspected(inspected),
        offerLines,
        selectedOptionalLineIds,
      );
      authorisedTotalMinor = priced.authorisedTotalMinor;
    } catch (error) {
      if (error instanceof QuotationCommercialError) return { state: "invalid" };
      throw error;
    }
    selectionLines = inspected.lines
      .filter((line) => line.lineRole === "mandatory" || selectedOptionalLineIds.includes(line.id))
      .map((line) => ({
        lineId: line.id,
        inclusion: line.lineRole === "mandatory" ? "mandatory" as const : "selected_optional" as const,
      }));
  }
  try {
    await store.commitQuotationDecision({
      decisionId: createId<FrigoraQuotationDecisionId>(),
      eventId: createId<FrigoraQuotationEventId>(),
      grantId: inspected.grantId,
      secretHash: secretHash(input.secret),
      quotationId: inspected.quotationId,
      workspaceId: inspected.workspaceId,
      ventureId: inspected.ventureId,
      customerId: inspected.customerId,
      siteId: inspected.siteId,
      decision: input.decision,
      now: decidedAt,
      actorUserId: null,
      actorContactId: inspected.contactId,
      selectionLines,
      authorisedTotalMinor,
      selectedOptionalLineIds: [...selectedOptionalLineIds],
    });
  } catch (error) {
    if (error instanceof FrigoraError) {
      const again = await inspectGrant(input.grantId, input.secret, now());
      if (again.state !== "ready") {
        return again;
      }
      const recorded = await getClient().execute({
        sql: "SELECT decision, version_number FROM frigora_quotation_decisions WHERE grant_id = ?",
        args: [input.grantId],
      });
      const row = recorded.rows[0];
      if (row && (row.decision === "approved" || row.decision === "declined")) {
        return { state: "used", decision: row.decision, version: Number(row.version_number) };
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/quotation decision line is not part of this offer|approved quotation lines are incomplete/i.test(message)) {
      return { state: "invalid" };
    }
    throw error;
  }
  return { state: input.decision, version: inspected.version };
}
