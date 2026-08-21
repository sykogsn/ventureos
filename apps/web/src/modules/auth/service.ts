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
import { decideGoogleSignIn } from "@/modules/auth/google-account";
import { sendAuthMail } from "@/modules/auth/mail";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetLive,
  passwordResetExpiry,
} from "@/modules/auth/password-reset";

export type UserRecord = {
  id: UserId;
  email: string;
  name: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function unusablePasswordHash() {
  return bcrypt.hash(crypto.randomUUID(), 12);
}

async function hasPasswordIdentity(userId: UserId) {
  const identities = await getPersistence().identities.listForUser(userId);
  return identities.some((item) => item.provider === "password");
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

export async function requestPasswordReset(input: { email: string; origin: string }) {
  await ensureSchema();
  const store = getPersistence();
  const email = normalizeEmail(input.email);
  const user = await store.users.findByEmail(email);
  if (!user) {
    return;
  }

  await store.passwordResetTokens.deleteExpired(nowIso());
  await store.passwordResetTokens.deleteUnusedForUser(user.id);

  const token = createPasswordResetToken();
  const createdAt = nowIso();
  await store.passwordResetTokens.insert({
    id: createId(),
    userId: user.id,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: passwordResetExpiry(),
    usedAt: null,
    createdAt,
  });

  const resetUrl = `${input.origin.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await sendAuthMail({
    to: user.email,
    subject: "Reset your VentureOS password",
    text: `Use this link within one hour to choose a new password:\n\n${resetUrl}\n`,
  });
}

export async function resetPasswordWithToken(input: { token: string; password: string }) {
  await ensureSchema();
  const store = getPersistence();
  await store.passwordResetTokens.deleteExpired(nowIso());
  const row = await store.passwordResetTokens.findByTokenHash(
    hashPasswordResetToken(input.token),
  );

  if (!row || !isPasswordResetLive(row.expiresAt, row.usedAt, nowIso())) {
    throw new Error("This reset link is invalid or has expired.");
  }

  const user = await store.users.findById(row.userId);
  if (!user) {
    throw new Error("This reset link is invalid or has expired.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  await store.users.updatePasswordHash(user.id, passwordHash);

  const identities = await store.identities.listForUser(user.id);
  const passwordIdentity = identities.find((item) => item.provider === "password");
  if (passwordIdentity) {
    await store.identities.updateSecretHash(passwordIdentity.id, passwordHash);
  } else {
    await store.identities.insert({
      id: createId(),
      userId: user.id,
      provider: "password",
      providerSubject: user.email,
      secretHash: passwordHash,
      createdAt: nowIso(),
    });
  }

  await store.passwordResetTokens.markUsed(row.id, nowIso());
  await store.sessions.deleteByUserId(user.id);

  return { id: user.id, email: user.email, name: user.name };
}

export type GoogleSignInResult =
  | { status: "signed-in"; user: UserRecord }
  | { status: "link-after-password"; email: string; subject: string; name: string };

export async function completeGoogleSignIn(profile: {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
}): Promise<GoogleSignInResult> {
  await ensureSchema();
  const store = getPersistence();
  const email = normalizeEmail(profile.email);
  const googleIdentity = await store.identities.findByProvider("google", profile.subject);
  const emailOwner = await store.users.findByEmail(email);
  const decision = decideGoogleSignIn({
    emailVerified: profile.emailVerified,
    googleSubjectOwnerId: googleIdentity?.userId ?? null,
    emailOwner: emailOwner
      ? {
          id: emailOwner.id,
          hasPasswordIdentity: await hasPasswordIdentity(emailOwner.id),
        }
      : null,
  });

  if (decision.action === "reject") {
    throw new Error(
      decision.reason === "unverified-email"
        ? "Google did not verify that email."
        : "That email is already on a desk.",
    );
  }

  if (decision.action === "sign-in") {
    const user = await store.users.findById(decision.userId as UserId);
    if (!user) {
      throw new Error("Google sign-in could not complete.");
    }
    return { status: "signed-in", user: { id: user.id, email: user.email, name: user.name } };
  }

  if (decision.action === "link-after-password") {
    return {
      status: "link-after-password",
      email,
      subject: profile.subject,
      name: profile.name.trim() || email,
    };
  }

  const id = createId<UserId>();
  const createdAt = nowIso();
  const name = profile.name.trim() || email;
  await store.users.insert({
    id,
    email,
    name,
    passwordHash: await unusablePasswordHash(),
    createdAt,
  });
  await store.identities.insert({
    id: createId(),
    userId: id,
    provider: "google",
    providerSubject: profile.subject,
    secretHash: null,
    createdAt,
  });

  const platform = getPlatform();
  platform.knowledge.upsertEntity({
    id,
    kind: "user",
    label: name,
    properties: { email },
  });
  await platform.events.publish(
    createEvent("user.registered", { userId: id, email, provider: "google" }, { actorId: id }),
  );
  await createWorkspace({
    userId: id,
    name: `${name}'s workspace`,
  });

  return { status: "signed-in", user: { id, email, name } };
}

export async function linkGoogleAfterPassword(input: {
  userId: UserId;
  email: string;
  subject: string;
}) {
  await ensureSchema();
  const store = getPersistence();
  const user = await store.users.findById(input.userId);
  if (!user || user.email !== normalizeEmail(input.email)) {
    return;
  }

  const existing = await store.identities.findByProvider("google", input.subject);
  if (existing) {
    return;
  }

  await store.identities.insert({
    id: createId(),
    userId: user.id,
    provider: "google",
    providerSubject: input.subject,
    secretHash: null,
    createdAt: nowIso(),
  });
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
