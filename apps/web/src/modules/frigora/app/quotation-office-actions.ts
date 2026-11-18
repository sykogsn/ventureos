"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { WorkspaceId } from "@/contracts";
import { getSession } from "@/lib/auth/session";
import { FrigoraError, isFrigoraError } from "@/modules/frigora/errors";
import {
  officeQuotationFieldsFromForm,
  parseOfficeQuotationFields,
  type OfficeQuotationFieldValues,
} from "@/modules/frigora/app/quotation-office";
import { createScope, getFrigoraService } from "@/modules/frigora/service";
import type {
  FrigoraCustomerContactId,
  FrigoraQuotationDecisionGrantId,
  FrigoraQuotationId,
} from "@/modules/frigora/types";
import { parseWithFrigora, scopeSchema } from "@/modules/frigora/validation";
import { getPlatform } from "@/platform/kernel";

export type OfficeQuotationFormState = {
  error?: string;
  values?: OfficeQuotationFieldValues;
  /** Shown once to the signed-in office user. Not emailed and not delivery. */
  testOnlyPath?: string;
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function quotationPath(ventureId: string, quotationId?: string) {
  const base = `/ventures/${ventureId}/quotations`;
  return quotationId ? `${base}/${quotationId}` : base;
}

async function authorisedScope(formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { error: "You must be signed in." as const };
  }
  const workspaceId = text(formData, "workspaceId");
  const ventureId = text(formData, "ventureId");
  try {
    parseWithFrigora(scopeSchema, { workspaceId, ventureId });
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message };
    }
    throw error;
  }
  const allowed = await getPlatform().permissions.can({
    userId: session.id,
    permission: "venture.update",
    resource: { type: "workspace", id: workspaceId as WorkspaceId },
  });
  if (!allowed) {
    return { error: "You do not have permission to change a quotation." as const };
  }
  return {
    scope: createScope({ userId: session.id, workspaceId, ventureId }),
    ventureId,
  };
}

export async function createOfficeQuotationFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const values = officeQuotationFieldsFromForm(formData);
  const access = await authorisedScope(formData);
  if ("error" in access) {
    return { error: access.error, values };
  }
  const parsed = parseOfficeQuotationFields(values);
  if (!parsed.ok) {
    return { error: parsed.error, values };
  }
  if (!values.recommendedActionId.trim()) {
    return { error: "Choose the recommended action this quotation prices.", values };
  }
  try {
    const quotation = await getFrigoraService().createQuotation(access.scope, {
      recommendedActionId: values.recommendedActionId.trim(),
      description: parsed.description,
      commercial: parsed.commercial,
    });
    revalidatePath(quotationPath(access.ventureId));
    redirect(quotationPath(access.ventureId, quotation.id));
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message, values };
    }
    throw error;
  }
}

export async function correctOfficeQuotationFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const values = officeQuotationFieldsFromForm(formData);
  const access = await authorisedScope(formData);
  if ("error" in access) {
    return { error: access.error, values };
  }
  const parsed = parseOfficeQuotationFields(values);
  if (!parsed.ok) {
    return { error: parsed.error, values };
  }
  const quotationId = text(formData, "quotationId");
  const expectedCurrentVersion = Number(text(formData, "expectedCurrentVersion"));
  if (!quotationId || !Number.isInteger(expectedCurrentVersion) || expectedCurrentVersion < 1) {
    return { error: "The draft to correct is missing. Refresh the quotation and try again.", values };
  }
  try {
    await getFrigoraService().correctQuotation(access.scope, quotationId as FrigoraQuotationId, {
      expectedCurrentVersion,
      description: parsed.description,
      commercial: parsed.commercial,
    });
    revalidatePath(quotationPath(access.ventureId, quotationId));
    redirect(quotationPath(access.ventureId, quotationId));
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message, values };
    }
    throw error;
  }
}

export async function reviseOfficeQuotationFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const values = officeQuotationFieldsFromForm(formData);
  const access = await authorisedScope(formData);
  if ("error" in access) {
    return { error: access.error, values };
  }
  const parsed = parseOfficeQuotationFields(values);
  if (!parsed.ok) {
    return { error: parsed.error, values };
  }
  const quotationId = text(formData, "quotationId");
  const expectedCurrentVersion = Number(text(formData, "expectedCurrentVersion"));
  if (!quotationId || !Number.isInteger(expectedCurrentVersion) || expectedCurrentVersion < 1) {
    return { error: "The quotation to revise is missing. Refresh the quotation and try again.", values };
  }
  try {
    await getFrigoraService().reviseQuotation(access.scope, quotationId as FrigoraQuotationId, {
      expectedCurrentVersion,
      description: parsed.description,
      commercial: parsed.commercial,
    });
    revalidatePath(quotationPath(access.ventureId, quotationId));
    redirect(quotationPath(access.ventureId, quotationId));
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message, values };
    }
    throw error;
  }
}

/**
 * Office issue prepares a held delivery record. It does not email the customer
 * or create a decision grant. A blocked or failed issue is returned as an error.
 */
export async function issueOfficeQuotationFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const values = officeQuotationFieldsFromForm(formData);
  const access = await authorisedScope(formData);
  if ("error" in access) {
    return { error: access.error, values };
  }
  const quotationId = text(formData, "quotationId");
  const recipient = text(formData, "recipient").trim();
  const expectedCurrentVersion = Number(text(formData, "expectedCurrentVersion"));
  if (!quotationId || !recipient || !Number.isInteger(expectedCurrentVersion) || expectedCurrentVersion < 1) {
    return {
      error: "A recipient and the current draft version are required before issue can be checked.",
      values,
    };
  }
  try {
    const issued = await getFrigoraService().issueQuotation(access.scope, quotationId as FrigoraQuotationId, {
      expectedCurrentVersion,
      recipient,
    });
    if (issued.emailed || issued.customerDelivery !== "not_sent" || issued.delivery.state !== "held_pending_customer_access") {
      return {
        error: "Issue preparation did not stay held. No customer email was sent.",
        values,
      };
    }
    revalidatePath(quotationPath(access.ventureId, quotationId));
    redirect(quotationPath(access.ventureId, quotationId));
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message, values };
    }
    throw error;
  }
}

export async function activateOfficeCustomerAccessFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const access = await authorisedScope(formData);
  if ("error" in access) {
    return { error: access.error };
  }
  const quotationId = text(formData, "quotationId");
  const expectedCurrentVersion = Number(text(formData, "expectedCurrentVersion"));
  if (!quotationId || !Number.isInteger(expectedCurrentVersion) || expectedCurrentVersion < 1) {
    return { error: "The issued quotation version is missing. Refresh and try again." };
  }
  try {
    const activated = await getFrigoraService().activateQuotationCustomerAccess(
      access.scope,
      quotationId as FrigoraQuotationId,
      { expectedCurrentVersion },
    );
    revalidatePath(quotationPath(access.ventureId, quotationId));
    return { testOnlyPath: activated.testOnlyPath };
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function revokeOfficeCustomerAccessFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const access = await authorisedScope(formData);
  if ("error" in access) {
    return { error: access.error };
  }
  const quotationId = text(formData, "quotationId");
  const grantId = text(formData, "grantId");
  if (!quotationId || !grantId) {
    return { error: "The customer access grant is missing. Refresh and try again." };
  }
  try {
    await getFrigoraService().revokeQuotationCustomerAccess(
      access.scope,
      grantId as FrigoraQuotationDecisionGrantId,
    );
    revalidatePath(quotationPath(access.ventureId, quotationId));
    redirect(quotationPath(access.ventureId, quotationId));
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

async function mutateQuotationContact(
  formData: FormData,
  mutate: (access: { scope: ReturnType<typeof createScope>; ventureId: string; quotationId: string }) => Promise<void>,
): Promise<OfficeQuotationFormState> {
  const access = await authorisedScope(formData);
  if ("error" in access) {
    return { error: access.error };
  }
  const quotationId = text(formData, "quotationId");
  if (!quotationId) {
    return { error: "The quotation is missing. Refresh and try again." };
  }
  try {
    await mutate({ scope: access.scope, ventureId: access.ventureId, quotationId });
    revalidatePath(quotationPath(access.ventureId, quotationId));
    redirect(quotationPath(access.ventureId, quotationId));
  } catch (error) {
    if (isFrigoraError(error)) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function createOfficeQuotationContactFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  return mutateQuotationContact(formData, async ({ scope, quotationId }) => {
    await getFrigoraService().createQuotationCustomerContact(scope, quotationId as FrigoraQuotationId, {
      displayName: text(formData, "displayName"),
      email: text(formData, "email"),
    });
  });
}

export async function correctOfficeQuotationContactFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const contactId = text(formData, "contactId");
  if (!contactId) {
    return { error: "The customer contact is missing. Refresh and try again." };
  }
  return mutateQuotationContact(formData, async ({ scope, quotationId }) => {
    await getFrigoraService().updateQuotationCustomerContact(
      scope,
      quotationId as FrigoraQuotationId,
      contactId as FrigoraCustomerContactId,
      {
        displayName: text(formData, "displayName"),
        email: text(formData, "email"),
      },
    );
  });
}

export async function recordOfficeSupervisedVerificationFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const contactId = text(formData, "contactId");
  const method = text(formData, "method");
  if (!contactId) {
    return { error: "The customer contact is missing. Refresh and try again." };
  }
  if (method !== "telephone" && method !== "in_person") {
    return { error: "Supervised verification method is not recognised." };
  }
  return mutateQuotationContact(formData, async ({ scope, quotationId }) => {
    await getFrigoraService().recordSupervisedContactVerification(
      scope,
      quotationId as FrigoraQuotationId,
      contactId as FrigoraCustomerContactId,
      { method, evidenceNote: text(formData, "evidenceNote") },
    );
  });
}

export async function revokeOfficeSupervisedVerificationFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const contactId = text(formData, "contactId");
  if (!contactId) {
    return { error: "The customer contact is missing. Refresh and try again." };
  }
  return mutateQuotationContact(formData, async ({ scope, quotationId }) => {
    await getFrigoraService().revokeSupervisedContactVerification(
      scope,
      quotationId as FrigoraQuotationId,
      contactId as FrigoraCustomerContactId,
    );
  });
}

export async function designateOfficeQuotationContactFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const contactId = text(formData, "contactId");
  if (!contactId) {
    return { error: "The customer contact is missing. Refresh and try again." };
  }
  return mutateQuotationContact(formData, async ({ scope, quotationId }) => {
    const service = getFrigoraService();
    const quotation = await service.getQuotation(scope, quotationId as FrigoraQuotationId);
    const contact = await service.getCustomerContact(scope, contactId as FrigoraCustomerContactId);
    if (!quotation || !contact || contact.customerId !== quotation.customerId || contact.siteId !== quotation.siteId) {
      throw new FrigoraError("not_found", "Customer contact was not found.");
    }
    await service.designateQuotationContact(scope, contactId as FrigoraCustomerContactId, {
      basis: text(formData, "basis"),
    });
  });
}

export async function revokeOfficeQuotationDesignationFormAction(
  _previous: OfficeQuotationFormState,
  formData: FormData,
): Promise<OfficeQuotationFormState> {
  const contactId = text(formData, "contactId");
  if (!contactId) {
    return { error: "The customer contact is missing. Refresh and try again." };
  }
  return mutateQuotationContact(formData, async ({ scope, quotationId }) => {
    const service = getFrigoraService();
    const quotation = await service.getQuotation(scope, quotationId as FrigoraQuotationId);
    const contact = await service.getCustomerContact(scope, contactId as FrigoraCustomerContactId);
    if (!quotation || !contact || contact.customerId !== quotation.customerId || contact.siteId !== quotation.siteId) {
      throw new FrigoraError("not_found", "Customer contact was not found.");
    }
    await service.revokeQuotationContactDesignation(scope, contactId as FrigoraCustomerContactId);
  });
}
