"use server";

import { revalidatePath } from "next/cache";
import type { WorkspaceId } from "@/contracts";
import { getSession } from "@/lib/auth/session";
import {
  commercialItemFieldsFromForm,
  saveCommercialItem,
  saveCommercialItemCost,
  selectCommercialItemForOffice,
  type CommercialItemFieldValues,
} from "@/modules/frigora/app/commercial-catalogue-office";
import { createCommercialCatalogue } from "@/modules/frigora/commercial-catalogue";
import { isFrigoraError } from "@/modules/frigora/errors";
import { createScope } from "@/modules/frigora/service";
import { parseWithFrigora, scopeSchema } from "@/modules/frigora/validation";
import { getPlatform } from "@/platform/kernel";

export type CommercialCatalogueFormState = {
  error?: string;
  message?: string;
  values?: CommercialItemFieldValues;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function cataloguePath(ventureId: string) {
  return `/ventures/${ventureId}/commercial-catalogue`;
}

function catalogueForSession() {
  return createCommercialCatalogue({ permissions: getPlatform().permissions });
}

async function signedScope(formData: FormData, permission: "venture.update" | "venture.read") {
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
    permission,
    resource: { type: "workspace", id: workspaceId as WorkspaceId },
  });
  if (!allowed) {
    const error = permission === "venture.update"
      ? "You do not have permission to change the commercial catalogue."
      : "You do not have permission to read the commercial catalogue.";
    return { error };
  }
  return {
    scope: createScope({ userId: session.id, workspaceId, ventureId }),
    ventureId,
  };
}

export async function saveCommercialItemFormAction(
  _previous: CommercialCatalogueFormState,
  formData: FormData,
): Promise<CommercialCatalogueFormState> {
  const values = commercialItemFieldsFromForm(formData);
  const access = await signedScope(formData, "venture.update");
  if ("error" in access) return { error: access.error, values };
  const saved = await saveCommercialItem(catalogueForSession(), access.scope, formData);
  if (saved.error) return { error: saved.error, values };
  revalidatePath(cataloguePath(access.ventureId));
  return { message: "Commercial item saved." };
}

export async function saveCommercialItemCostFormAction(
  _previous: CommercialCatalogueFormState,
  formData: FormData,
): Promise<CommercialCatalogueFormState> {
  const session = await getSession();
  if (!session) return { error: "You must be signed in." };
  const workspaceId = text(formData, "workspaceId");
  const ventureId = text(formData, "ventureId");
  try {
    parseWithFrigora(scopeSchema, { workspaceId, ventureId });
  } catch (error) {
    if (isFrigoraError(error)) return { error: error.message };
    throw error;
  }
  const saved = await saveCommercialItemCost(
    catalogueForSession(),
    createScope({ userId: session.id, workspaceId, ventureId }),
    formData,
  );
  if (saved.error) return { error: saved.error };
  revalidatePath(cataloguePath(ventureId));
  return { message: "Purchase cost saved." };
}

export async function selectCommercialItemFormAction(
  _previous: CommercialCatalogueFormState,
  formData: FormData,
): Promise<CommercialCatalogueFormState> {
  const access = await signedScope(formData, "venture.read");
  if ("error" in access) return { error: access.error };
  const selected = await selectCommercialItemForOffice(
    catalogueForSession(),
    access.scope,
    text(formData, "id"),
  );
  if (selected.error) return { error: selected.error };
  return { message: "This active item can be used on a new quotation. No quotation line was created." };
}
