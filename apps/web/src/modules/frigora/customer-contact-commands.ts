import { createHash, randomBytes } from "node:crypto";
import { createId, nowIso } from "@/platform/ids";
import { getClient } from "@/platform/persistence/db";
import { getPersistence } from "@/platform/persistence/repositories";
import { FrigoraError } from "./errors";
import {
  assertVerifiedSender,
  canonicalMailPayload,
  formatVentureSender,
  FrigoraMailDeliveryError,
  mailPayloadFingerprint,
  quotationDecisionReviewLink,
  resolveFrigoraMailProvider,
  resolveFrigoraPublicOrigin,
  resolveVerifiedMailDomains,
  normalizeContactEmail,
  type FrigoraMailMessage,
  type FrigoraMailRuntime,
} from "./mail";
import {
  QUOTATION_DECISION_GRANT_TTL_MS,
  assertPersistedOfferDocument,
  quotationDecisionGrantSecretHash,
} from "./quotation-commands";
import {
  beginQuotationCustomerDelivery,
  beginQuotationCustomerProviderRequest,
  claimQuotationCustomerDelivery,
  clearCustomerDeliveryExecuting,
  commitDeliveryPayloadKeyRestoredAudit,
  findQuotationCustomerDelivery,
  noteCustomerDeliveryExecuting,
  recordQuotationCustomerDeliveryResult,
  releaseQuotationCustomerDeliveryClaim,
  watchQuotationCustomerProviderRequest,
  type QuotationCustomerDeliveryRecord,
} from "./quotation-customer-delivery";
import { classifyDeliveryPayload, encryptDeliveryPayload, requireDeliveryPayloadKeyRing } from "./quotation-delivery-payload";
import type { FrigoraStore } from "./store";
import type {
  ConfirmFrigoraContactEmailInput,
  CreateFrigoraCustomerContactInput,
  DesignateFrigoraQuotationContactInput,
  DeliverFrigoraQuotationDecisionGrantInput,
  FrigoraContactVerificationChallengeId,
  FrigoraContactVerificationDispatch,
  FrigoraCustomerContact,
  FrigoraCustomerContactAccess,
  FrigoraCustomerContactId,
  FrigoraCustomerId,
  FrigoraQuotationDecisionGrantId,
  FrigoraQuotationDeliveryResult,
  FrigoraQuotationId,
  FrigoraScope,
  FrigoraSiteId,
  FrigoraSupervisedVerification,
  FrigoraVentureMailIdentity,
  RecordFrigoraSupervisedVerificationInput,
  SetFrigoraVentureMailIdentityInput,
  UpdateFrigoraCustomerContactInput,
} from "./types";
import {
  confirmFrigoraContactEmailSchema,
  createFrigoraCustomerContactSchema,
  designateFrigoraQuotationContactSchema,
  recordFrigoraSupervisedVerificationSchema,
  deliverFrigoraQuotationDecisionGrantSchema,
  parseWithFrigora,
  setFrigoraVentureMailIdentitySchema,
  updateFrigoraCustomerContactSchema,
} from "./validation";

const CONTACT_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function challengeHash(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

async function requireFrigoraVenture(scope: FrigoraScope) {
  const venture = await getPersistence().ventures.findById(scope.ventureId);
  if (!venture || venture.workspaceId !== scope.workspaceId) {
    throw new FrigoraError("not_found", "Venture was not found.");
  }
  if (venture.definitionId !== "frigora") {
    throw new FrigoraError("not_frigora", "Venture is not Frigora.");
  }
}

async function requireActiveContact(store: FrigoraStore, scope: FrigoraScope, contactId: string) {
  const contact = await store.findCustomerContact(
    scope.workspaceId,
    scope.ventureId,
    contactId as FrigoraCustomerContactId,
  );
  if (!contact || contact.status !== "active") {
    throw new FrigoraError("not_found", "Customer contact was not found.");
  }
  return contact;
}

function auditActor(scope: FrigoraScope) {
  return {
    userId: scope.userId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
  };
}

async function recordAudit(action: string, scope: FrigoraScope, metadata: Record<string, string>) {
  const actor = auditActor(scope);
  await getClient().execute({
    sql: `
      INSERT INTO audit_events (
        id, action, occurred_at, actor_user_id, actor_kind,
        actor_agent_instance_id, actor_component, workspace_id, venture_id, metadata_json
      ) VALUES (?, ?, ?, ?, 'human', NULL, NULL, ?, ?, ?)
    `,
    args: [
      createId(),
      action,
      new Date().toISOString(),
      actor.userId,
      actor.workspaceId,
      actor.ventureId,
      JSON.stringify(metadata),
    ],
  });
}

function requireMail(runtime: FrigoraMailRuntime) {
  const domains = resolveVerifiedMailDomains(runtime);
  if (domains.length === 0) {
    throw new FrigoraError("mail_not_configured", "Frigora mail is not configured.");
  }
  return {
    domains,
    provider: resolveFrigoraMailProvider(runtime.provider, runtime.env),
  };
}

async function sendOrRevoke(input: {
  provider: ReturnType<typeof resolveFrigoraMailProvider>;
  from: string;
  to: string;
  subject: string;
  text: string;
  revoke: () => Promise<void>;
}) {
  let result;
  try {
    result = await input.provider.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (error) {
    const outcome = error instanceof FrigoraMailDeliveryError && error.outcome === "rejected"
      ? "rejected"
      : "unknown";
    await revokeUnusedSecret(input.revoke, outcome);
    throw new FrigoraError(
      outcome === "rejected" ? "delivery_failed" : "delivery_unknown",
      outcome === "rejected"
        ? "The mail provider rejected the message. The unused secret is revoked. This is not inbox delivery."
        : "The mail provider did not confirm acceptance. The unused secret is revoked. This is not inbox delivery. It was not sent again.",
    );
  }
  if (result.outcome !== "accepted_by_provider" || !result.providerMessageId) {
    const outcome = result.outcome === "rejected" ? "rejected" : "unknown";
    await revokeUnusedSecret(input.revoke, outcome);
    throw new FrigoraError(
      outcome === "rejected" ? "delivery_failed" : "delivery_unknown",
      outcome === "rejected"
        ? "The mail provider rejected the message. The unused secret is revoked. This is not inbox delivery."
        : "The mail provider did not confirm acceptance. The unused secret is revoked. This is not inbox delivery. It was not sent again.",
    );
  }
  return result.providerMessageId;
}

async function revokeUnusedSecret(
  revoke: () => Promise<void>,
  outcome: "rejected" | "unknown",
) {
  try {
    await revoke();
  } catch {
    throw new FrigoraError(
      outcome === "rejected" ? "delivery_failed" : "delivery_unknown",
      outcome === "rejected"
        ? "The mail provider rejected the message. The unused secret could not be revoked and may still be usable. This is not inbox delivery."
        : "The mail provider did not confirm acceptance. The unused secret could not be revoked and may still be usable. This is not inbox delivery. It was not sent again.",
    );
  }
}

export async function createCustomerContact(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: CreateFrigoraCustomerContactInput,
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  const parsed = parseWithFrigora(createFrigoraCustomerContactSchema, input);
  await requireFrigoraVenture(scope);
  const id = createId<FrigoraCustomerContactId>();
  const createdAt = now();
  await store.insertCustomerContact({
    id,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    customerId: parsed.customerId as FrigoraCustomerId,
    siteId: parsed.siteId as FrigoraSiteId,
    displayName: parsed.displayName,
    email: normalizeContactEmail(parsed.email),
    createdByUserId: scope.userId,
    createdAt,
  });
  return requireActiveContact(store, scope, id);
}

export async function updateCustomerContact(
  store: FrigoraStore,
  scope: FrigoraScope,
  contactId: FrigoraCustomerContactId,
  input: UpdateFrigoraCustomerContactInput,
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  const parsed = parseWithFrigora(updateFrigoraCustomerContactSchema, input);
  await requireFrigoraVenture(scope);
  await requireActiveContact(store, scope, contactId);
  await store.updateCustomerContact({
    contactId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    displayName: parsed.displayName,
    email: normalizeContactEmail(parsed.email),
    updatedAt: now(),
    actorUserId: scope.userId,
  });
  return requireActiveContact(store, scope, contactId);
}

async function requireQuotation(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
) {
  const quotation = await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId);
  if (!quotation) {
    throw new FrigoraError("not_found", "Quotation was not found.");
  }
  return quotation;
}

async function requireQuotationContact(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  contactId: FrigoraCustomerContactId,
) {
  const quotation = await requireQuotation(store, scope, quotationId);
  const contact = await store.findCustomerContact(scope.workspaceId, scope.ventureId, contactId);
  if (!contact || contact.customerId !== quotation.customerId || contact.siteId !== quotation.siteId) {
    throw new FrigoraError("not_found", "Customer contact was not found.");
  }
  return { quotation, contact };
}

export async function listQuotationCustomerContacts(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
): Promise<FrigoraCustomerContactAccess[]> {
  await requireFrigoraVenture(scope);
  const quotation = await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId);
  if (!quotation) {
    return [];
  }
  return store.listCustomerContactsForSite(
    scope.workspaceId,
    scope.ventureId,
    quotation.customerId,
    quotation.siteId,
  );
}

export async function createQuotationCustomerContact(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: { displayName: string; email: string },
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  const quotation = await requireQuotation(store, scope, quotationId);
  return createCustomerContact(
    store,
    scope,
    {
      customerId: quotation.customerId,
      siteId: quotation.siteId,
      displayName: input.displayName,
      email: input.email,
    },
    now,
  );
}

export async function updateQuotationCustomerContact(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  contactId: FrigoraCustomerContactId,
  input: UpdateFrigoraCustomerContactInput,
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  await requireQuotationContact(store, scope, quotationId, contactId);
  return updateCustomerContact(store, scope, contactId, input, now);
}

export async function recordSupervisedContactVerification(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  contactId: FrigoraCustomerContactId,
  input: RecordFrigoraSupervisedVerificationInput,
  now: () => string = nowIso,
): Promise<FrigoraSupervisedVerification> {
  const parsed = parseWithFrigora(recordFrigoraSupervisedVerificationSchema, input);
  await requireFrigoraVenture(scope);
  const { contact } = await requireQuotationContact(store, scope, quotationId, contactId);
  if (contact.status !== "active") {
    throw new FrigoraError("invalid_status", "Customer contact is not active.");
  }
  const id = createId();
  const verifiedAt = now();
  await store.recordSupervisedVerification({
    id,
    contactId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    method: parsed.method,
    evidenceNote: parsed.evidenceNote,
    actorUserId: scope.userId,
    verifiedAt,
  });
  const recorded = (await store.listSupervisedVerifications(scope.workspaceId, scope.ventureId, contactId))
    .find((verification) => verification.id === id);
  if (!recorded) {
    throw new FrigoraError("not_found", "Supervised verification was not recorded.");
  }
  return recorded;
}

export async function revokeSupervisedContactVerification(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  contactId: FrigoraCustomerContactId,
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  await requireFrigoraVenture(scope);
  await requireQuotationContact(store, scope, quotationId, contactId);
  await store.revokeSupervisedVerification({
    contactId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    actorUserId: scope.userId,
    revokedAt: now(),
  });
  return requireActiveContact(store, scope, contactId);
}

export async function designateQuotationContact(
  store: FrigoraStore,
  scope: FrigoraScope,
  contactId: FrigoraCustomerContactId,
  input: DesignateFrigoraQuotationContactInput,
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  const parsed = parseWithFrigora(designateFrigoraQuotationContactSchema, input);
  await requireFrigoraVenture(scope);
  await requireActiveContact(store, scope, contactId);
  const designatedAt = now();
  await store.designateQuotationContact({
    contactId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    basis: parsed.basis,
    actorUserId: scope.userId,
    designatedAt,
  });
  return requireActiveContact(store, scope, contactId);
}

export async function revokeQuotationContactDesignation(
  store: FrigoraStore,
  scope: FrigoraScope,
  contactId: FrigoraCustomerContactId,
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  await requireFrigoraVenture(scope);
  await requireActiveContact(store, scope, contactId);
  const revokedAt = now();
  await store.revokeQuotationContactDesignation({
    contactId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    actorUserId: scope.userId,
    revokedAt,
  });
  return requireActiveContact(store, scope, contactId);
}

export async function revokeCustomerContact(
  store: FrigoraStore,
  scope: FrigoraScope,
  contactId: FrigoraCustomerContactId,
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  await requireFrigoraVenture(scope);
  const revokedAt = now();
  await store.revokeCustomerContact({
    contactId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    actorUserId: scope.userId,
    revokedAt,
  });
  const contact = await store.findCustomerContact(scope.workspaceId, scope.ventureId, contactId);
  if (!contact) {
    throw new FrigoraError("not_found", "Customer contact was not found.");
  }
  return contact;
}

export async function setVentureMailIdentity(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: SetFrigoraVentureMailIdentityInput,
  runtime: FrigoraMailRuntime,
  now: () => string = nowIso,
): Promise<FrigoraVentureMailIdentity> {
  const parsed = parseWithFrigora(setFrigoraVentureMailIdentitySchema, input);
  await requireFrigoraVenture(scope);
  const domains = resolveVerifiedMailDomains(runtime);
  if (domains.length === 0) {
    throw new FrigoraError("mail_not_configured", "Frigora mail is not configured.");
  }
  const fromEmail = assertVerifiedSender(parsed.fromEmail, domains);
  const fromName = parsed.fromName.trim();
  formatVentureSender(fromName, fromEmail);
  const identity: FrigoraVentureMailIdentity = {
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    fromName,
    fromEmail,
    updatedByUserId: scope.userId,
    updatedAt: now(),
  };
  await store.saveVentureMailIdentity(identity);
  return identity;
}

export async function requestCustomerContactVerification(
  store: FrigoraStore,
  scope: FrigoraScope,
  contactId: FrigoraCustomerContactId,
  runtime: FrigoraMailRuntime,
  now: () => string = nowIso,
): Promise<FrigoraContactVerificationDispatch> {
  await requireFrigoraVenture(scope);
  const contact = await requireActiveContact(store, scope, contactId);
  const { domains, provider } = requireMail(runtime);
  const identity = await store.findVentureMailIdentity(scope.workspaceId, scope.ventureId);
  if (!identity) {
    throw new FrigoraError("mail_not_configured", "The venture sender identity is not configured.");
  }
  const fromEmail = assertVerifiedSender(identity.fromEmail, domains);
  const createdAt = now();
  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) {
    throw new FrigoraError("invalid_input", "Verification time is invalid.");
  }
  const secret = randomBytes(32).toString("base64url");
  const challengeId = createId<FrigoraContactVerificationChallengeId>();
  const expiresAt = new Date(createdAtMs + CONTACT_VERIFICATION_TTL_MS).toISOString();
  await store.insertContactVerificationChallenge({
    id: challengeId,
    contactId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    customerId: contact.customerId,
    siteId: contact.siteId,
    secretHash: challengeHash(secret),
    expiresAt,
    createdAt,
  });
  let providerMessageId: string;
  try {
    providerMessageId = await sendOrRevoke({
      provider,
      from: formatVentureSender(identity.fromName, fromEmail),
      to: contact.email,
      subject: "Confirm this email for quotation decisions",
      text: [
        `${contact.displayName}, confirm that this mailbox can receive Frigora quotation decisions.`,
        "Verification code:",
        secret,
        `This code expires at ${expiresAt} and can be used once.`,
        "Confirming this mailbox does not establish legal identity or organisational authority.",
      ].join("\n"),
      revoke: () => store.revokeContactVerificationChallenge({
        id: challengeId,
        workspaceId: scope.workspaceId,
        ventureId: scope.ventureId,
        revokedAt: createdAt,
      }),
    });
  } catch (error) {
    const code = error instanceof FrigoraError ? error.code : "delivery_unknown";
    try {
      await recordAudit("frigora.customer_contact.verification_dispatch_failed", scope, {
        challengeId,
        contactId,
        workspaceId: scope.workspaceId,
        ventureId: scope.ventureId,
        outcome: code,
      });
    } catch {
      throw new FrigoraError(
        code === "delivery_failed" || code === "delivery_unknown" || code === "customer_delivery_unavailable"
          ? code
          : "delivery_unknown",
        `${error instanceof FrigoraError ? error.message : "The mail provider did not confirm acceptance."} The failure record was not saved.`,
      );
    }
    throw error;
  }
  return {
    challengeId,
    contactId,
    expiresAt,
    outcome: "accepted_by_provider",
    providerMessageId,
  };
}

export async function confirmCustomerContactEmail(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: ConfirmFrigoraContactEmailInput,
  now: () => string = nowIso,
): Promise<FrigoraCustomerContact> {
  const parsed = parseWithFrigora(confirmFrigoraContactEmailSchema, input);
  await requireFrigoraVenture(scope);
  const binding = await store.findContactVerificationBinding(
    scope.workspaceId,
    scope.ventureId,
    parsed.challengeId as FrigoraContactVerificationChallengeId,
  );
  if (!binding) {
    throw new FrigoraError("invalid_input", "Verification challenge is not valid.");
  }
  const contactId = binding.contactId;
  await store.consumeContactVerificationChallenge({
    id: parsed.challengeId as FrigoraContactVerificationChallengeId,
    contactId: contactId as FrigoraCustomerContactId,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    secretHash: challengeHash(parsed.secret),
    now: now(),
  });
  return requireActiveContact(store, scope, contactId);
}

function decisionMessage(input: {
  from: string;
  to: string;
  displayName: string;
  version: number;
  customerName: string;
  siteName: string;
  origin: string;
  grantId: string;
  secret: string;
  expiresAt: string;
}): FrigoraMailMessage {
  const link = quotationDecisionReviewLink(input.origin, input.grantId, input.secret);
  return {
    from: input.from,
    to: input.to,
    subject: "Quotation awaiting your decision",
    text: [
      `${input.displayName}, quotation version ${input.version} for ${input.customerName} at ${input.siteName} is awaiting your decision.`,
      "Open the link below. The part after # stays in your browser and is not sent when the page first loads.",
      link,
      `This link expires at ${input.expiresAt} and can be used once.`,
      "Holding this link does not by itself prove legal identity or organisational authority.",
      "Acceptance of this message by the mail provider is not proof it reached your inbox.",
    ].join("\n"),
  };
}

async function finishCustomerDelivery(
  operation: QuotationCustomerDeliveryRecord,
  provider: ReturnType<typeof resolveFrigoraMailProvider>,
  now: string,
  actorUserId: FrigoraScope["userId"],
): Promise<FrigoraQuotationDeliveryResult> {
  const claim = await claimQuotationCustomerDelivery(operation, now);
  if (claim.action === "accepted") {
    return {
      grantId: claim.record.grantId as FrigoraQuotationDeliveryResult["grantId"],
      contactId: claim.record.contactId as FrigoraCustomerContactId,
      outcome: "accepted_by_provider",
      providerMessageId: claim.record.providerMessageId ?? "",
    };
  }
  if (claim.action === "rejected") {
    throw new FrigoraError(
      "delivery_failed",
      "The mail provider rejected the message. The decision grant is revoked. The failure record was saved. This is not inbox delivery.",
    );
  }
  if (claim.action === "reconcile") {
    throw new FrigoraError(
      "delivery_unknown",
      "This delivery needs reconciliation. The same idempotency key was not sent again. This is not inbox delivery.",
    );
  }
  if (claim.action === "in_flight") {
    throw new FrigoraError(
      "delivery_unknown",
      "Another delivery attempt holds this operation. The provider was not called again. This is not inbox delivery.",
    );
  }
  if (claim.action === "payload_blocked") {
    throw new FrigoraError(
      "delivery_unknown",
      "The stored delivery payload cannot be read. The provider was not called. This is not inbox delivery.",
    );
  }
  noteCustomerDeliveryExecuting(claim.record.id);
  let stopProviderWatch: () => void = () => undefined;
  try {
  const armed = await beginQuotationCustomerProviderRequest({ record: claim.record, now });
  if (!armed) {
    throw new FrigoraError(
      "delivery_unknown",
      "The provider request could not be fenced. The provider was not called. This is not inbox delivery.",
    );
  }
  stopProviderWatch = watchQuotationCustomerProviderRequest(armed, now);
  const classified = classifyDeliveryPayload({
    stored: armed.payloadText,
    deliveryId: armed.id,
    fingerprint: armed.payloadFingerprint,
    ring: requireDeliveryPayloadKeyRing(),
  });
  if (classified.kind !== "readable") {
    stopProviderWatch();
    stopProviderWatch = () => undefined;
    clearCustomerDeliveryExecuting(armed.id);
    await releaseQuotationCustomerDeliveryClaim(armed, now);
    throw new FrigoraError(
      "delivery_unknown",
      "The stored delivery payload cannot be read. The provider was not called. This is not inbox delivery.",
    );
  }
  if (classified.encoding === "encrypted" && classified.keyId) {
    try {
      await commitDeliveryPayloadKeyRestoredAudit(armed, classified.keyId, now);
    } catch (error) {
      stopProviderWatch();
      stopProviderWatch = () => undefined;
      clearCustomerDeliveryExecuting(armed.id);
      await releaseQuotationCustomerDeliveryClaim(armed, now);
      throw error;
    }
  }
  const payload = JSON.parse(classified.plaintext) as FrigoraMailMessage;
  let outcome: "accepted_by_provider" | "rejected_by_provider" | "outcome_unknown" = "outcome_unknown";
  let providerMessageId: string | null = null;
  try {
    const result = await provider.send({
      ...payload,
      idempotencyKey: armed.idempotencyKey,
    });
    if (result.outcome === "accepted_by_provider" && result.providerMessageId) {
      outcome = "accepted_by_provider";
      providerMessageId = result.providerMessageId;
    } else if (result.outcome === "rejected") {
      outcome = "rejected_by_provider";
    }
  } catch (error) {
    if (error instanceof FrigoraMailDeliveryError && error.outcome === "rejected") {
      outcome = "rejected_by_provider";
    }
  }
  let saved: QuotationCustomerDeliveryRecord;
  try {
    saved = await recordQuotationCustomerDeliveryResult({
      record: armed,
      outcome,
      providerMessageId,
      now,
      actorUserId,
    });
  } catch (error) {
    stopProviderWatch();
    stopProviderWatch = () => undefined;
    clearCustomerDeliveryExecuting(armed.id);
    await releaseQuotationCustomerDeliveryClaim(armed, now);
    if (outcome === "accepted_by_provider") {
      throw new FrigoraError(
        "customer_delivery_unavailable",
        "The mail provider accepted the message. This is not inbox delivery. The acceptance record was not saved. Do not send it again.",
      );
    }
    throw error;
  }
  if (outcome === "accepted_by_provider") {
    return {
      grantId: saved.grantId as FrigoraQuotationDeliveryResult["grantId"],
      contactId: saved.contactId as FrigoraCustomerContactId,
      outcome: "accepted_by_provider",
      providerMessageId: saved.providerMessageId ?? "",
    };
  }
  if (outcome === "rejected_by_provider") {
    throw new FrigoraError(
      "delivery_failed",
      "The mail provider rejected the message. The decision grant is revoked. The failure record was saved. This is not inbox delivery.",
    );
  }
  throw new FrigoraError(
    "delivery_unknown",
    "The mail provider did not confirm acceptance. The same decision grant and delivery operation remain in place. This is not inbox delivery. It was not sent again.",
  );
  } finally {
    stopProviderWatch();
    clearCustomerDeliveryExecuting(claim.record.id);
  }
}

export async function deliverQuotationDecisionGrant(
  store: FrigoraStore,
  scope: FrigoraScope,
  quotationId: FrigoraQuotationId,
  input: DeliverFrigoraQuotationDecisionGrantInput,
  runtime: FrigoraMailRuntime,
  now: () => string = nowIso,
  beforeGuardedWrite?: () => Promise<void>,
): Promise<FrigoraQuotationDeliveryResult> {
  const parsed = parseWithFrigora(deliverFrigoraQuotationDecisionGrantSchema, input);
  await requireFrigoraVenture(scope);
  const quotation = await store.findPersistedQuotation(scope.workspaceId, scope.ventureId, quotationId);
  if (!quotation) {
    throw new FrigoraError("not_found", "Quotation was not found.");
  }
  const { domains, provider } = requireMail(runtime);
  const identity = await store.findVentureMailIdentity(scope.workspaceId, scope.ventureId);
  if (!identity) {
    throw new FrigoraError("mail_not_configured", "The venture sender identity is not configured.");
  }
  const fromEmail = assertVerifiedSender(identity.fromEmail, domains);
  const from = formatVentureSender(identity.fromName, fromEmail);
  const origin = resolveFrigoraPublicOrigin(runtime);
  const customer = await store.findCustomer(scope.workspaceId, scope.ventureId, quotation.customerId);
  const site = await store.findSite(scope.workspaceId, scope.ventureId, quotation.siteId);
  if (!customer || !site) {
    throw new FrigoraError("not_found", "Quotation was not found.");
  }
  const contact = await requireActiveContact(store, scope, parsed.contactId);
  if (contact.customerId !== quotation.customerId || contact.siteId !== quotation.siteId) {
    throw new FrigoraError("decision_rejected", "Customer contact is not authorised for this quotation.");
  }
  if (!contact.emailVerifiedAt) {
    throw new FrigoraError("decision_rejected", "Customer contact email is not verified.");
  }
  if (!contact.designation || contact.designation.revokedAt) {
    throw new FrigoraError(
      "decision_rejected",
      "Customer contact is not designated to decide this quotation.",
    );
  }
  if (quotation.currentVersion !== parsed.expectedCurrentVersion) {
    throw new FrigoraError(
      "quotation_conflict",
      "This quotation changed since you opened it. Refresh before trying again.",
    );
  }
  const current = quotation.versions.find((version) => version.version === quotation.currentVersion);
  if (!current || current.status !== "awaiting_customer_approval") {
    throw new FrigoraError(
      "invalid_status",
      "A decision grant can only be issued for the current sent quotation version.",
    );
  }
  if (beforeGuardedWrite) await beforeGuardedWrite();
  await assertPersistedOfferDocument(scope, quotationId, current.version);
  const issuedAt = now();
  const issuedAtMs = Date.parse(issuedAt);
  if (Number.isNaN(issuedAtMs)) {
    throw new FrigoraError("invalid_input", "Decision time is invalid.");
  }
  const existing = await findQuotationCustomerDelivery(quotationId, current.version, contact.id);
  const secret = randomBytes(32).toString("base64url");
  const grantId = createId<FrigoraQuotationDecisionGrantId>();
  const deliveryId = createId();
  const expiresAt = new Date(issuedAtMs + QUOTATION_DECISION_GRANT_TTL_MS).toISOString();
  const draftPayload = canonicalMailPayload(decisionMessage({
    from,
    to: contact.email,
    displayName: contact.displayName,
    version: current.version,
    customerName: customer.displayName,
    siteName: site.name,
    origin,
    grantId,
    secret,
    expiresAt,
  }));
  const payloadFingerprint = mailPayloadFingerprint(JSON.parse(draftPayload) as FrigoraMailMessage);
  const keyRing = requireDeliveryPayloadKeyRing();
  const storedPayload = encryptDeliveryPayload({
    ring: keyRing,
    deliveryId,
    fingerprint: payloadFingerprint,
    plaintext: draftPayload,
  });
  const operation = existing ?? await beginQuotationCustomerDelivery({
    grant: {
      id: grantId,
      secretHash: quotationDecisionGrantSecretHash(secret),
      quotationId,
      workspaceId: scope.workspaceId,
      ventureId: scope.ventureId,
      customerId: quotation.customerId,
      siteId: quotation.siteId,
      version: current.version,
      documentHash: current.documentHash,
      expiresAt,
      issuedAt,
      issuedByUserId: scope.userId,
      contactId: contact.id,
      eligibility: "mailbox",
    },
    deliveryId,
    payloadText: storedPayload,
    payloadFingerprint,
  });
  return finishCustomerDelivery(operation, provider, now(), scope.userId);
}
