import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import { persistFoundedCompany } from "@/modules/intelligence/service";
import { emptyLaunchDraft } from "@/modules/ventures/launch/types";
import { ensureSchema, getPersistence } from "@/platform";
import { getPlatform } from "@/platform/kernel";

export type VentureRecord = {
  id: VentureId;
  workspaceId: WorkspaceId;
  name: string;
  slug: string;
  definitionId: string;
};

export async function createVenture(input: {
  userId: UserId;
  workspaceId: WorkspaceId;
  name: string;
}): Promise<VentureRecord> {
  const company = await persistFoundedCompany({
    userId: input.userId,
    workspaceId: input.workspaceId,
    draft: {
      ...emptyLaunchDraft,
      name: input.name.trim(),
      productId: "ventureos.company",
      categoryId: "other",
      stageId: "idea",
      goalId: "mvp",
      aiEnabled: false,
      executiveIds: [],
    },
  });

  return {
    id: company.venture.identity.id as VentureId,
    workspaceId: input.workspaceId,
    name: company.venture.identity.name,
    slug: company.slug,
    definitionId: company.venture.definition?.id ?? "ventureos.company",
  };
}

export async function listVentures(
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<VentureRecord[]> {
  await ensureSchema();
  const platform = getPlatform();
  const allowed = await platform.permissions.can({
    userId,
    permission: "venture.read",
    resource: { type: "workspace", id: workspaceId },
  });

  if (!allowed) {
    return [];
  }

  const rows = await getPersistence().ventures.listByWorkspace(workspaceId);
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    definitionId: row.definitionId,
  }));
}

export async function getVenture(
  userId: UserId,
  ventureId: VentureId,
): Promise<VentureRecord | null> {
  await ensureSchema();
  const row = await getPersistence().ventures.findById(ventureId);
  if (!row) {
    return null;
  }

  const platform = getPlatform();
  const allowed = await platform.permissions.can({
    userId,
    permission: "venture.read",
    resource: { type: "workspace", id: row.workspaceId },
  });

  if (!allowed) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    definitionId: row.definitionId,
  };
}
