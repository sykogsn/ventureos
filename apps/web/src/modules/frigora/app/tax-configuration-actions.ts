"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isFrigoraError } from "@/modules/frigora/errors";
import { getSession } from "@/lib/auth/session";
import { createScope, getFrigoraService } from "@/modules/frigora/service";
import { parseWithFrigora, scopeSchema } from "@/modules/frigora/validation";
import { getPlatform } from "@/platform/kernel";
import type { WorkspaceId } from "@/contracts";

export type TaxConfigurationFormState = {
  error?: string;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function authorised(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." as const };
  const workspaceId = text(formData, "workspaceId");
  const ventureId = text(formData, "ventureId");
  try {
    parseWithFrigora(scopeSchema, { workspaceId, ventureId });
  } catch (error) {
    if (isFrigoraError(error)) return { error: error.message };
    throw error;
  }
  const allowed = await getPlatform().permissions.can({
    userId: session.id,
    permission: "venture.update",
    resource: { type: "workspace", id: workspaceId as WorkspaceId },
  });
  if (!allowed) {
    return { error: "You do not have permission to change tax configuration." as const };
  }
  return { scope: createScope({ userId: session.id, workspaceId, ventureId }), ventureId };
}

function payload(formData: FormData) {
  return {
    jurisdiction: "ZA" as const,
    registrationState: text(formData, "registrationState"),
    registrationNumber: text(formData, "registrationNumber"),
    liabilityDate: text(formData, "liabilityDate"),
    taxRuleId: text(formData, "taxRuleId"),
    evidenceReference: text(formData, "evidenceReference"),
  };
}

async function run(
  formData: FormData,
  command: "draft" | "review" | "verify" | "approve" | "revoke",
): Promise<TaxConfigurationFormState> {
  const access = await authorised(formData);
  if ("error" in access) return { error: access.error };
  const service = getFrigoraService();
  try {
    if (command === "draft") {
      await service.saveTaxConfigurationDraft(access.scope, payload(formData));
    } else if (command === "review") {
      await service.submitTaxConfigurationForReview(access.scope, payload(formData));
    } else if (command === "verify") {
      await service.verifyTaxConfiguration(access.scope, payload(formData));
    } else if (command === "approve") {
      await service.approveReferenceTaxRule(access.scope);
    } else {
      await service.revokeVerifiedTaxConfiguration(access.scope, text(formData, "configurationId"));
    }
    revalidatePath(`/ventures/${access.ventureId}/quotations/tax`);
    redirect(`/ventures/${access.ventureId}/quotations/tax`);
  } catch (error) {
    if (isFrigoraError(error)) return { error: error.message };
    throw error;
  }
}

export async function saveTaxDraftFormAction(_previous: TaxConfigurationFormState, formData: FormData) {
  return run(formData, "draft");
}

export async function submitTaxReviewFormAction(_previous: TaxConfigurationFormState, formData: FormData) {
  return run(formData, "review");
}

export async function verifyTaxFormAction(_previous: TaxConfigurationFormState, formData: FormData) {
  return run(formData, "verify");
}

export async function approveTaxRuleFormAction(_previous: TaxConfigurationFormState, formData: FormData) {
  return run(formData, "approve");
}

export async function revokeTaxFormAction(_previous: TaxConfigurationFormState, formData: FormData) {
  return run(formData, "revoke");
}
