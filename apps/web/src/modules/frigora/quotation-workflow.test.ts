import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FRIGORA_QUOTE_STATUSES,
  canAuthoriseNewQuotedRepair,
  createQuotationDraft,
  currentQuotationVersion,
  decideQuotation,
  quotationStatus,
  quoteMatchesScope,
  reviseQuotation,
  sendQuotation,
} from "./quotation-workflow";

function draft() {
  return createQuotationDraft({
    id: "quote-1",
    scope: { workspaceId: "workspace-a", ventureId: "frigora-a" },
    originalWorkOrderId: "diagnostic-wo-1",
    recommendedActionId: "replace-compressor-1",
    assetId: "cold-room-1",
    description: "Replace compressor",
    totalMinor: 1495000,
    documentHash: "sha-quote-v1",
    actorUserId: "office-user",
    eventId: "created-1",
    occurredAt: "2026-10-24T08:00:00.000Z",
  });
}

function sent() {
  return sendQuotation(draft(), {
    eventId: "sent-1",
    occurredAt: "2026-10-24T08:10:00.000Z",
    actorUserId: "office-user",
    recipient: "client@example.test",
    dispatchEvidenceRef: "outbound-mail-1",
  });
}

function decision(kind: "approved" | "declined") {
  return decideQuotation(sent(), {
    eventId: `decision-${kind}`,
    occurredAt: "2026-10-24T09:00:00.000Z",
    actorUserId: "office-user",
    decision: kind,
    version: 1,
    documentHash: "sha-quote-v1",
    customerDecisionMaker: "customer-approver-1",
    authorityEvidenceRef: "signed-decision-1",
    customerAuthorityVerified: true,
  });
}

test("contract exposes exactly four statuses, without expired or superseded", () => {
  assert.deepEqual([...FRIGORA_QUOTE_STATUSES], [
    "in_preparation", "awaiting_customer_approval", "approved", "declined",
  ]);
});

test("new quotation is in preparation, ZAR cents, linked to diagnostic and asset", () => {
  const quote = draft();
  assert.equal(quotationStatus(quote), "in_preparation");
  assert.equal(currentQuotationVersion(quote).totalMinor, 1495000);
  assert.equal(currentQuotationVersion(quote).currency, "ZAR");
  assert.equal(quote.originalWorkOrderId, "diagnostic-wo-1");
  assert.equal(quote.recommendedActionId, "replace-compressor-1");
  assert.equal(quote.assetId, "cold-room-1");
  assert.equal(canAuthoriseNewQuotedRepair(quote), false);
});

test("send requires an auditable dispatch reference and awaits customer approval", () => {
  assert.throws(
    () => sendQuotation(draft(), {
      eventId: "sent-empty", occurredAt: "2026-10-24T08:10:00.000Z",
      actorUserId: "office-user", recipient: "customer@example.test", dispatchEvidenceRef: "",
    }),
    /Dispatch evidence reference/,
  );
  assert.equal(quotationStatus(sent()), "awaiting_customer_approval");
  assert.equal(canAuthoriseNewQuotedRepair(sent()), false);
});

test("approved quotation is the only state that authorises a new quoted repair", () => {
  const approved = decision("approved");
  assert.equal(canAuthoriseNewQuotedRepair(approved), true);
  assert.equal(quotationStatus(approved), "approved");
  assert.equal(currentQuotationVersion(approved).decision?.documentHash, "sha-quote-v1");
  assert.equal(currentQuotationVersion(approved).decision?.authorityEvidenceRef, "signed-decision-1");
});

test("declined quotation cannot authorise repair but preserves decision evidence", () => {
  const declined = decision("declined");
  assert.equal(quotationStatus(declined), "declined");
  assert.equal(canAuthoriseNewQuotedRepair(declined), false);
  assert.equal(declined.events.at(-1)?.kind, "declined");
  assert.equal(currentQuotationVersion(declined).decision?.customerDecisionMaker, "customer-approver-1");
});

test("customer decision must match current quotation document and version", () => {
  assert.throws(
    () => decideQuotation(sent(), {
      eventId: "bad-version",
      occurredAt: "2026-10-24T09:00:00.000Z",
      actorUserId: "office-user",
      decision: "approved",
      version: 2,
      documentHash: "sha-quote-v1",
      customerDecisionMaker: "customer-approver-1",
      authorityEvidenceRef: "signed-decision-1",
      customerAuthorityVerified: true,
    }),
    /does not match/,
  );
  assert.throws(
    () => decideQuotation(sent(), {
      eventId: "bad-hash",
      occurredAt: "2026-10-24T09:00:00.000Z",
      actorUserId: "office-user",
      decision: "approved",
      version: 1,
      documentHash: "changed-quote",
      customerDecisionMaker: "customer-approver-1",
      authorityEvidenceRef: "signed-decision-1",
      customerAuthorityVerified: true,
    }),
    /does not match/,
  );
});

test("cannot decide draft or approve twice", () => {
  assert.throws(
    () => decideQuotation(draft(), {
      eventId: "early", occurredAt: "2026-10-24T09:00:00.000Z",
      actorUserId: "office-user", decision: "approved", version: 1,
      documentHash: "sha-quote-v1", customerDecisionMaker: "customer-approver-1",
      authorityEvidenceRef: "signed-decision-1", customerAuthorityVerified: true,
    }),
    /Only a sent quotation/,
  );
  const approved = decision("approved");
  assert.throws(
    () => decideQuotation(approved, {
      eventId: "repeat", occurredAt: "2026-10-24T09:01:00.000Z",
      actorUserId: "office-user", decision: "approved", version: 1,
      documentHash: "sha-quote-v1", customerDecisionMaker: "customer-approver-1",
      authorityEvidenceRef: "signed-decision-2", customerAuthorityVerified: true,
    }),
    /Only a sent quotation/,
  );
});

test("declined quote can be revised while original declined version remains traceable", () => {
  const original = decision("declined");
  const revised = reviseQuotation(original, {
    eventId: "revision-2", occurredAt: "2026-10-24T10:00:00.000Z",
    actorUserId: "office-user", description: "Discounted compressor replacement",
    totalMinor: 1250000, documentHash: "sha-quote-v2",
  });
  assert.equal(quotationStatus(revised), "in_preparation");
  assert.equal(revised.versions.length, 2);
  assert.equal(revised.versions[0].status, "declined");
  assert.equal(revised.versions[0].decision?.authorityEvidenceRef, "signed-decision-1");
  assert.equal(revised.versions[0].totalMinor, 1495000);
  assert.equal(revised.versions[1].totalMinor, 1250000);
  assert.equal(revised.versions[1].decision, null);
  assert.equal(canAuthoriseNewQuotedRepair(revised), false);
  assert.equal(original.versions.length, 1);
});

test("approved quote revision does not inherit the old version's authorisation", () => {
  const original = decision("approved");
  const revised = reviseQuotation(original, {
    eventId: "revision-after-approval", occurredAt: "2026-10-24T10:00:00.000Z",
    actorUserId: "office-user", description: "Revised scope",
    totalMinor: 1600000, documentHash: "sha-quote-v2",
  });
  assert.equal(original.versions[0].status, "approved");
  assert.equal(revised.versions[0].status, "approved");
  assert.equal(revised.versions[1].status, "in_preparation");
  assert.equal(canAuthoriseNewQuotedRepair(revised), false);
});

test("sent quote can be revised before decision, preserving its sent snapshot", () => {
  const original = sent();
  const revised = reviseQuotation(original, {
    eventId: "revision-before-decision", occurredAt: "2026-10-24T08:30:00.000Z",
    actorUserId: "office-user", description: "Updated labour scope",
    totalMinor: 1500000, documentHash: "sha-quote-v2",
  });
  assert.equal(revised.versions[0].status, "awaiting_customer_approval");
  assert.equal(revised.versions[0].dispatchEvidenceRef, "outbound-mail-1");
  assert.equal(quotationStatus(revised), "in_preparation");
  assert.equal(canAuthoriseNewQuotedRepair(revised), false);
});

test("duplicate audit event IDs cannot be replayed", () => {
  assert.throws(
    () => sendQuotation(draft(), {
      eventId: "created-1", occurredAt: "2026-10-24T08:10:00.000Z",
      actorUserId: "office-user", recipient: "client@example.test",
      dispatchEvidenceRef: "outbound-mail-1",
    }),
    /Duplicate quotation event/,
  );
});

test("scope helper rejects another workspace or venture", () => {
  const quote = draft();
  assert.equal(quoteMatchesScope(quote, { workspaceId: "workspace-a", ventureId: "frigora-a" }), true);
  assert.equal(quoteMatchesScope(quote, { workspaceId: "workspace-b", ventureId: "frigora-a" }), false);
  assert.equal(quoteMatchesScope(quote, { workspaceId: "workspace-a", ventureId: "frigora-b" }), false);
});

test("invalid ZAR minor-unit amounts are rejected", () => {
  assert.throws(() => createQuotationDraft({
    id: "q", scope: { workspaceId: "w", ventureId: "v" },
    originalWorkOrderId: "o", recommendedActionId: "r",
    description: "Repair", totalMinor: 12.5,
    documentHash: "hash", actorUserId: "office", eventId: "e", occurredAt: "2026-10-24T08:00:00.000Z",
  }), /integer ZAR cents/);
});
