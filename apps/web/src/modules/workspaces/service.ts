import type { Role, UserId, WorkspaceId } from "@/contracts";
import { getPlatform, createEvent, createId, nowIso, slugify, ensureSchema, getPersistence } from "@/platform";
import { membershipAllowsWorkspaceSelection } from "@/modules/workspaces/membership";
import { seedWorkspaceIntelligence } from "@/modules/intelligence/service";
import {
  assertCanCreateWorkspace,
  assertWorkspaceKnown,
  type WorkspaceRegistryEntry,
} from "@/core/workspace-registry";

export type WorkspaceRecord = {
  id: WorkspaceId;
  name: string;
  slug: string;
};

async function uniqueSlug(base: string) {
  const store = getPersistence();
  const root = slugify(base);
  let slug = root;
  let n = 0;

  while (await store.organisations.findBySlug(slug)) {
    n += 1;
    slug = `${root}-${n}`;
  }

  return slug;
}

export async function listWorkspaceCatalogue(
  userId: UserId,
): Promise<WorkspaceRegistryEntry[]> {
  await ensureSchema();
  const store = getPersistence();
  const platform = getPlatform();
  const rows = await store.organisations.listForUser(userId);
  const entries: WorkspaceRegistryEntry[] = [];

  for (const row of rows) {
    const role = await platform.permissions.roleFor(userId, row.id);
    if (!membershipAllowsWorkspaceSelection(role)) {
      continue;
    }

    entries.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      role: role as Role,
    });
  }

  return entries;
}

export async function createWorkspace(input: {
  userId: UserId;
  name: string;
  scopeWorkspaceId?: string | null;
}): Promise<WorkspaceRecord> {
  await ensureSchema();
  const catalogue = await listWorkspaceCatalogue(input.userId);
  await assertCanCreateWorkspace({
    userId: input.userId,
    workspaces: catalogue,
    scopeWorkspaceId: input.scopeWorkspaceId ?? null,
    permissions: getPlatform().permissions,
  });

  const store = getPersistence();
  const platform = getPlatform();
  const id = createId<WorkspaceId>();
  const slug = await uniqueSlug(input.name);
  const createdAt = nowIso();
  const name = input.name.trim();

  await store.organisations.insert({
    id,
    name,
    slug,
    createdAt,
  });
  await platform.permissions.grant(input.userId, "owner", id);

  platform.knowledge.upsertEntity({
    id,
    kind: "workspace",
    label: name,
    properties: { slug },
  });
  platform.knowledge.upsertRelation({
    kind: "member_of",
    fromId: input.userId,
    toId: id,
  });
  platform.knowledge.upsertRelation({
    kind: "owns",
    fromId: input.userId,
    toId: id,
  });

  await platform.events.publish(
    createEvent(
      "workspace.created",
      { workspaceId: id, name },
      { actorId: input.userId, workspaceId: id },
    ),
  );

  await seedWorkspaceIntelligence({
    userId: input.userId,
    workspaceId: id,
    founderName: name.replace(/'s workspace$/i, "") || "Founder",
  });

  return { id, name, slug };
}

export async function listWorkspaces(userId: UserId): Promise<WorkspaceRecord[]> {
  const catalogue = await listWorkspaceCatalogue(userId);
  return catalogue.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
  }));
}

export async function canAccessWorkspace(
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<boolean> {
  const catalogue = await listWorkspaceCatalogue(userId);
  try {
    assertWorkspaceKnown(catalogue, workspaceId);
    return true;
  } catch {
    return false;
  }
}
