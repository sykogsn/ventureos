import { createId, nowIso } from "@/platform/ids";
import { FrigoraError } from "./errors";
import type { FrigoraStore } from "./store";
import {
  quotationTaxCorrectionBlocker,
  quotationTaxSendBlocker,
  SARS_ZA_VAT_STANDARD_RULE,
  type TaxConfigurationRecord,
  type TaxRegistrationState,
} from "./tax-configuration";
import type { FrigoraQuotationCommercialSnapshot } from "./quotation-commercial";
import type { FrigoraPersistedQuoteVersion, FrigoraScope } from "./types";
import { parseWithFrigora } from "./validation";
import { z } from "zod";

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.");
const optionalText = z.string().trim().transform((value) => (value.length === 0 ? null : value)).nullable().optional();
const optionalDate = z.preprocess(
  (value) => (value == null || value === "" ? null : value),
  dateText.nullable(),
);

const draftSchema = z.object({
  jurisdiction: z.literal("ZA"),
  registrationState: z.enum(["unverified", "pending_review", "registered", "not_registered"]),
  registrationNumber: optionalText,
  liabilityDate: optionalDate,
  taxRuleId: optionalText,
  evidenceReference: optionalText,
}).strict();

const verifySchema = z.object({
  jurisdiction: z.literal("ZA"),
  registrationState: z.enum(["registered", "not_registered"]),
  registrationNumber: optionalText,
  liabilityDate: optionalDate,
  taxRuleId: optionalText,
  evidenceReference: z.string().trim().min(1, "Evidence reference is required."),
}).strict();

function nextVersion(existing: readonly { version: number }[]) {
  return existing.reduce((max, item) => Math.max(max, item.version), 0) + 1;
}

function dateOnly(iso: string) {
  return iso.slice(0, 10);
}

async function posture(store: FrigoraStore, scope: FrigoraScope) {
  const [rules, configurations, events] = await Promise.all([
    store.listTaxRules(),
    store.listTaxConfigurations(scope.workspaceId, scope.ventureId),
    store.listTaxConfigurationEvents(scope.workspaceId, scope.ventureId),
  ]);
  return { rules, configurations, events };
}

export async function getTaxPosture(store: FrigoraStore, scope: FrigoraScope) {
  return posture(store, scope);
}

export async function assertTaxAllowsQuotationSend(
  store: FrigoraStore,
  scope: FrigoraScope,
  version: FrigoraPersistedQuoteVersion,
  asOfIso: string,
) {
  const current = await posture(store, scope);
  const blocker = quotationTaxSendBlocker({
    configurations: current.configurations,
    rules: current.rules,
    commercial: version.commercial,
    asOfDate: dateOnly(asOfIso),
  });
  if (blocker) {
    throw new FrigoraError("tax_configuration_blocked", blocker);
  }
}

export async function assertTaxAllowsQuotationCorrection(
  store: FrigoraStore,
  scope: FrigoraScope,
  commercial: FrigoraQuotationCommercialSnapshot,
  asOfIso: string,
) {
  const current = await posture(store, scope);
  const blocker = quotationTaxCorrectionBlocker({
    configurations: current.configurations,
    rules: current.rules,
    commercial,
    asOfDate: dateOnly(asOfIso),
  });
  if (blocker) {
    throw new FrigoraError("tax_configuration_blocked", blocker);
  }
}

function activationBlocker(input: {
  registrationState: TaxRegistrationState;
  registrationNumber: string | null;
  liabilityDate: string | null;
  taxRuleId: string | null;
  evidenceReference: string | null;
  rules: Awaited<ReturnType<FrigoraStore["listTaxRules"]>>;
}): string | null {
  if (!input.evidenceReference?.trim()) {
    return "Activation needs an evidence reference. A public SARS page is not evidence of this venture's registration.";
  }
  if (input.registrationState === "not_registered") {
    if (input.taxRuleId) {
      return "A not-registered configuration cannot name a VAT rule or charge VAT.";
    }
    return null;
  }
  if (input.registrationState !== "registered") {
    return "Activation needs an explicit registered or not-registered state supported by evidence. Unverified and pending states cannot be activated.";
  }
  if (!input.registrationNumber || !input.liabilityDate || !input.taxRuleId) {
    return "A registered configuration needs a registration number, liability date, and an approved tax rule.";
  }
  const rule = input.rules.find((candidate) => candidate.id === input.taxRuleId);
  if (!rule || rule.status !== "approved") {
    return "The selected rule is not approved. Recording or viewing the public SARS reference does not activate this venture.";
  }
  if (rule.jurisdiction !== "ZA" || rule.id !== SARS_ZA_VAT_STANDARD_RULE.id) {
    return "The selected rule is outside the verified SARS standard-rate reference.";
  }
  if (input.liabilityDate < rule.effectiveFrom) {
    return "The liability date is before the approved rule's effective date.";
  }
  if (rule.effectiveUntil && input.liabilityDate > rule.effectiveUntil) {
    return "The liability date is after the approved rule expired.";
  }
  return null;
}

async function writeConfiguration(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: {
    jurisdiction: "ZA";
    registrationState: TaxRegistrationState;
    registrationNumber: string | null;
    liabilityDate: string | null;
    taxRuleId: string | null;
    evidenceReference: string | null;
    status: "draft" | "pending_review" | "verified";
    eventKind: string;
    eventSummary: string;
  },
): Promise<TaxConfigurationRecord> {
  const existing = await store.listTaxConfigurations(scope.workspaceId, scope.ventureId);
  if (input.status === "verified" && existing.some((configuration) => configuration.status === "verified")) {
    throw new FrigoraError(
      "tax_configuration_blocked",
      "A verified configuration is already active. Revoke it before activating a replacement, so two verified configurations do not conflict.",
    );
  }
  const occurredAt = nowIso();
  const id = createId<string>();
  await store.insertTaxConfiguration({
    id,
    workspaceId: scope.workspaceId,
    ventureId: scope.ventureId,
    version: nextVersion(existing),
    jurisdiction: input.jurisdiction,
    registrationState: input.registrationState,
    registrationNumber: input.registrationNumber,
    liabilityDate: input.liabilityDate,
    taxRuleId: input.taxRuleId,
    evidenceReference: input.evidenceReference,
    status: input.status,
    createdByUserId: scope.userId,
    createdAt: occurredAt,
    verifiedByUserId: input.status === "verified" ? scope.userId : null,
    verifiedAt: input.status === "verified" ? occurredAt : null,
    eventId: createId<string>(),
    eventKind: input.eventKind,
    eventSummary: input.eventSummary,
  });
  const saved = (await store.listTaxConfigurations(scope.workspaceId, scope.ventureId)).find(
    (configuration) => configuration.id === id,
  );
  if (!saved) {
    throw new FrigoraError("invalid_input", "Tax configuration was not saved.");
  }
  return saved;
}

export async function saveTaxConfigurationDraft(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: unknown,
) {
  const parsed = parseWithFrigora(draftSchema, input);
  return writeConfiguration(store, scope, {
    jurisdiction: parsed.jurisdiction,
    registrationState: parsed.registrationState,
    registrationNumber: parsed.registrationNumber ?? null,
    liabilityDate: parsed.liabilityDate ?? null,
    taxRuleId: parsed.taxRuleId ?? null,
    evidenceReference: parsed.evidenceReference ?? null,
    status: "draft",
    eventKind: "draft_saved",
    eventSummary: "Tax configuration draft saved. A draft is not verified and cannot authorise sending.",
  });
}

export async function submitTaxConfigurationForReview(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: unknown,
) {
  const parsed = parseWithFrigora(draftSchema, input);
  return writeConfiguration(store, scope, {
    jurisdiction: parsed.jurisdiction,
    registrationState: parsed.registrationState,
    registrationNumber: parsed.registrationNumber ?? null,
    liabilityDate: parsed.liabilityDate ?? null,
    taxRuleId: parsed.taxRuleId ?? null,
    evidenceReference: parsed.evidenceReference ?? null,
    status: "pending_review",
    eventKind: "submitted_for_review",
    eventSummary: "Tax configuration submitted for review. Pending review does not authorise sending.",
  });
}

export async function verifyTaxConfiguration(
  store: FrigoraStore,
  scope: FrigoraScope,
  input: unknown,
) {
  const parsed = parseWithFrigora(verifySchema, input);
  const rules = await store.listTaxRules();
  const blocker = activationBlocker({
    registrationState: parsed.registrationState,
    registrationNumber: parsed.registrationNumber ?? null,
    liabilityDate: parsed.liabilityDate ?? null,
    taxRuleId: parsed.taxRuleId ?? null,
    evidenceReference: parsed.evidenceReference,
    rules,
  });
  if (blocker) {
    throw new FrigoraError("tax_configuration_blocked", blocker);
  }
  return writeConfiguration(store, scope, {
    jurisdiction: parsed.jurisdiction,
    registrationState: parsed.registrationState,
    registrationNumber: parsed.registrationState === "registered" ? parsed.registrationNumber ?? null : null,
    liabilityDate: parsed.registrationState === "registered" ? parsed.liabilityDate ?? null : null,
    taxRuleId: parsed.registrationState === "registered" ? parsed.taxRuleId ?? null : null,
    evidenceReference: parsed.evidenceReference,
    status: "verified",
    eventKind: "verified",
    eventSummary: parsed.registrationState === "registered"
      ? "Registered tax configuration verified. The registration number is stored on the configuration, not in this audit summary."
      : "Not-registered tax configuration verified. This verification does not authorise charging VAT.",
  });
}

export async function approveReferenceTaxRule(store: FrigoraStore, scope: FrigoraScope) {
  const approved = await store.setTaxRuleStatus({
    id: SARS_ZA_VAT_STANDARD_RULE.id,
    from: "reference",
    to: "approved",
    actorUserId: scope.userId,
    at: nowIso(),
  });
  if (!approved) {
    const rules = await store.listTaxRules();
    const rule = rules.find((candidate) => candidate.id === SARS_ZA_VAT_STANDARD_RULE.id);
    if (rule?.status === "approved") {
      return rule;
    }
    throw new FrigoraError(
      "tax_configuration_blocked",
      "The public SARS reference could not be approved. Approval of a rule does not verify this venture.",
    );
  }
  const rules = await store.listTaxRules();
  const rule = rules.find((candidate) => candidate.id === SARS_ZA_VAT_STANDARD_RULE.id);
  if (!rule) {
    throw new FrigoraError("not_found", "The SARS reference rule was not found.");
  }
  return rule;
}

export async function revokeVerifiedTaxConfiguration(
  store: FrigoraStore,
  scope: FrigoraScope,
  configurationId: string,
) {
  try {
    await store.revokeTaxConfiguration({
      id: configurationId,
      workspaceId: scope.workspaceId,
      ventureId: scope.ventureId,
      eventId: createId<string>(),
      actorUserId: scope.userId,
      at: nowIso(),
    });
  } catch (error) {
    if (error instanceof FrigoraError) throw error;
    throw new FrigoraError(
      "tax_configuration_blocked",
      "Only a verified configuration can be revoked. Revocation does not rewrite sent quotations.",
    );
  }
}
