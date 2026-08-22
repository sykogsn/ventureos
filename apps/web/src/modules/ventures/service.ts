import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import {
  assertVentureInWorkspace,
  toVentureRegistryEntry,
  type VentureRegistryEntry,
} from "@/core/venture-registry";
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
  definitionVersion: string;
};

function toRecord(entry: VentureRegistryEntry): VentureRecord {
  return {
    id: entry.id,
    workspaceId: entry.workspaceId,
    name: entry.name,
    slug: entry.slug,
    definitionId: entry.definition.id,
    definitionVersion: entry.definition.version,
  };
}

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
    definitionVersion: company.venture.definition?.version ?? "1.0.0",
  };
}

export async function listVentureCatalogue(
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<VentureRegistryEntry[]> {
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
  return rows.map((row) =>
    toVentureRegistryEntry({
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      slug: row.slug,
      definitionId: row.definitionId,
      definitionVersion: row.definitionVersion,
    }),
  );
}

export async function listVentures(
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<VentureRecord[]> {
  const catalogue = await listVentureCatalogue(userId, workspaceId);
  return catalogue.map(toRecord);
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

  const catalogue = await listVentureCatalogue(userId, row.workspaceId);
  try {
    return toRecord(assertVentureInWorkspace(catalogue, ventureId, row.workspaceId));
  } catch {
    return null;
  }
}
