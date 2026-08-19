import type { UserId, WorkspaceId } from "@/contracts";
import { getPlatform, createEvent, createId, nowIso, slugify, ensureSchema, getPersistence } from "@/platform";
import { membershipAllowsWorkspaceSelection } from "@/modules/workspaces/membership";
import { seedWorkspaceIntelligence } from "@/modules/intelligence/service";

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

export async function createWorkspace(input: {
  userId: UserId;
  name: string;
}): Promise<WorkspaceRecord> {
  await ensureSchema();
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
  await ensureSchema();
  const rows = await getPersistence().organisations.listForUser(userId);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
}

export async function canAccessWorkspace(
  userId: UserId,
  workspaceId: WorkspaceId,
): Promise<boolean> {
  const role = await getPlatform().permissions.roleFor(userId, workspaceId);
  return membershipAllowsWorkspaceSelection(role);
}
