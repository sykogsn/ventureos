import bcrypt from "bcryptjs";
import type { UserId } from "@/contracts";
import {
  createEvent,
  createId,
  ensureSchema,
  getPersistence,
  getPlatform,
  nowIso,
} from "@/platform";
import { createWorkspace } from "@/modules/workspaces/service";
import type { AuthProvider } from "@/platform/persistence/repositories/ports";

export type UserRecord = {
  id: UserId;
  email: string;
  name: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<UserRecord> {
  await ensureSchema();
  const store = getPersistence();
  const platform = getPlatform();
  const email = normalizeEmail(input.email);
  const name = input.name.trim();

  const existing = await store.users.findByEmail(email);
  if (existing) {
    throw new Error("An account with that email already exists.");
  }

  const id = createId<UserId>();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const createdAt = nowIso();

  await store.users.insert({
    id,
    email,
    name,
    passwordHash,
    createdAt,
  });
  await store.identities.insert({
    id: createId(),
    userId: id,
    provider: "password",
    providerSubject: email,
    secretHash: passwordHash,
    createdAt,
  });

  platform.knowledge.upsertEntity({
    id,
    kind: "user",
    label: name,
    properties: { email },
  });

  await platform.events.publish(
    createEvent("user.registered", { userId: id, email }, { actorId: id }),
  );

  await createWorkspace({
    userId: id,
    name: `${name}'s workspace`,
  });

  return { id, email, name };
}

export async function authenticateUser(input: {
  email: string;
  password: string;
}): Promise<UserRecord> {
  await ensureSchema();
  const store = getPersistence();
  const email = normalizeEmail(input.email);
  const identity = await store.identities.findByProvider("password", email);
  const user = identity
    ? await store.users.findById(identity.userId)
    : await store.users.findByEmail(email);

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const secret = identity?.secretHash ?? user.passwordHash;
  const matches = await bcrypt.compare(input.password, secret);
  if (!matches) {
    throw new Error("Invalid email or password.");
  }

  if (!identity) {
    await store.identities.insert({
      id: createId(),
      userId: user.id,
      provider: "password",
      providerSubject: email,
      secretHash: user.passwordHash,
      createdAt: nowIso(),
    });
  }

  const platform = getPlatform();
  await platform.events.publish(
    createEvent(
      "user.authenticated",
      { userId: user.id },
      { actorId: user.id },
    ),
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

export async function linkAuthIdentity(input: {
  userId: UserId;
  provider: Exclude<AuthProvider, "password">;
  providerSubject: string;
}) {
  await ensureSchema();
  const store = getPersistence();
  const existing = await store.identities.findByProvider(
    input.provider,
    input.providerSubject,
  );
  if (existing) {
    throw new Error("That identity is already linked.");
  }

  await store.identities.insert({
    id: createId(),
    userId: input.userId,
    provider: input.provider,
    providerSubject: input.providerSubject,
    secretHash: null,
    createdAt: nowIso(),
  });
}

export async function issueSession(user: UserRecord) {
  await ensureSchema();
  const store = getPersistence();
  await store.sessions.deleteExpired(nowIso());
  const id = createId();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await store.sessions.insert({
    id,
    userId: user.id,
    expiresAt,
    createdAt,
  });
  return id;
}
