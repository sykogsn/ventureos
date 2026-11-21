import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { DomainEvent } from "../../contracts";
import type { UserId, WorkspaceId } from "../../contracts";
import { getPlatform } from "../../platform/kernel";
import { createId } from "../../platform/ids";
import { ensureSchema } from "../../platform/persistence/db";
import {
  getPersistence,
  resetPersistenceLifecycle,
} from "../../platform/persistence/repositories/sqlite";
import { WorkspaceAccessError, inviteWorkspaceMember } from "../workspaces/access";
import { sendAuthMail, takeAuthMailOutbox } from "./mail";

const NOW = "2026-09-27T12:00:00.000Z";
const LIVE_TOKEN = "live-invitation-token-must-not-be-logged";

function captureConsole() {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((value) => String(value)).join(" "));
  };
  return {
    lines,
    restore() {
      console.log = original;
    },
  };
}

function assignEnv(name: "NODE_ENV" | "RESEND_API_KEY", value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else Reflect.set(process.env, name, value);
}

function withEnv(values: { NODE_ENV?: string; RESEND_API_KEY?: string }) {
  const previousEnv = process.env.NODE_ENV;
  const previousKey = process.env.RESEND_API_KEY;
  assignEnv("NODE_ENV", values.NODE_ENV);
  assignEnv("RESEND_API_KEY", values.RESEND_API_KEY);
  return () => {
    assignEnv("NODE_ENV", previousEnv);
    assignEnv("RESEND_API_KEY", previousKey);
  };
}

describe("auth mail delivery boundary", () => {
  after(() => {
    getPlatform().scheduler.stopAll();
  });

  beforeEach(async () => {
    await resetPersistenceLifecycle(":memory:");
    await ensureSchema();
    takeAuthMailOutbox();
  });

  it("fails closed in production and does not log the invitation token", async () => {
    const restore = withEnv({ NODE_ENV: "production" });
    const logs = captureConsole();
    try {
      await assert.rejects(
        () =>
          sendAuthMail({
            to: "invitee@ventureos.test",
            subject: "Join a VentureOS workspace",
            text: `Open this link to accept:\nhttp://localhost:3000/invite?token=${LIVE_TOKEN}\n`,
          }),
        /Email delivery is not configured/,
      );
      assert.equal(takeAuthMailOutbox().length, 0);
      assert.equal(logs.lines.some((line) => line.includes(LIVE_TOKEN)), false);
      assert.equal(logs.lines.some((line) => line.includes("token=")), false);
    } finally {
      logs.restore();
      restore();
    }
  });

  it("keeps a development outbox without writing the token to the console", async () => {
    const restore = withEnv({ NODE_ENV: "development" });
    const logs = captureConsole();
    try {
      await sendAuthMail({
        to: "invitee@ventureos.test",
        subject: "Join a VentureOS workspace",
        text: `Open this link to accept:\nhttp://localhost:3000/invite?token=${LIVE_TOKEN}\n`,
      });
      const mail = takeAuthMailOutbox();
      assert.equal(mail.length, 1);
      assert.equal(mail[0]?.text.includes(LIVE_TOKEN), true);
      assert.equal(logs.lines.some((line) => line.includes(LIVE_TOKEN)), false);
      assert.equal(logs.lines.some((line) => line.includes("token=")), false);
      assert.equal(
        logs.lines.some((line) => line.includes("[auth-mail] Join a VentureOS workspace → invitee@ventureos.test")),
        true,
      );
    } finally {
      logs.restore();
      restore();
    }
  });

  it("revokes a committed invitation when production delivery is not configured", async () => {
    // Use a disposable file-backed database for this production-mode scenario.
    // Production storage guards must remain enabled, not bypassed for tests.
    const root = mkdtempSync(join(tmpdir(), "vos-auth-mail-prod-"));
    const databaseUrl = `file:${join(root, "mail-fixture.db").replaceAll("\\", "/")}`;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousRoot = process.env.VENTUREOS_PERSISTENT_ROOT;
    try {
      await resetPersistenceLifecycle(databaseUrl);
      await ensureSchema();
      const ownerId = createId<UserId>();
    const workspaceId = createId<WorkspaceId>();
    await getPersistence().users.insert({
      id: ownerId,
      email: "owner-mail@ventureos.test",
      name: "Owner",
      passwordHash: "not-used",
      createdAt: NOW,
    });
    await getPersistence().organisations.insert({
      id: workspaceId,
      name: "North",
      slug: workspaceId,
      createdAt: NOW,
    });
    await getPersistence().memberships.insert({
      workspaceId,
      userId: ownerId,
      role: "owner",
      createdAt: NOW,
    });

    const events: DomainEvent[] = [];
    const stop = getPlatform().events.subscribe("workspace.member.invited", (event) => {
      events.push(event);
    });
    // The pinned database selection, environment URL and volume root must agree
    // when the production persistence guard validates the write transaction.
    process.env.DATABASE_URL = databaseUrl;
    process.env.VENTUREOS_PERSISTENT_ROOT = root;
    const restore = withEnv({ NODE_ENV: "production" });
    const logs = captureConsole();
    try {
      await assert.rejects(
        () =>
          inviteWorkspaceMember({
            actorId: ownerId,
            workspaceId,
            email: "new-member@ventureos.test",
            role: "member",
            origin: "http://localhost:3000",
          }),
        (error: unknown) =>
          error instanceof Error &&
          !(error instanceof WorkspaceAccessError) &&
          /Email delivery is not configured/.test(error.message),
      );
      assert.equal(events.length, 0);
      const invitations = await getPersistence().invitations.listByWorkspace(workspaceId);
      assert.equal(invitations.length, 1);
      assert.ok(invitations[0]?.revokedAt);
      assert.equal(invitations[0]?.activeSlot, null);
      assert.equal(invitations[0]?.acceptedAt, null);
      assert.equal(logs.lines.some((line) => line.includes("token=")), false);
      assert.equal(takeAuthMailOutbox().length, 0);
    } finally {
      stop();
      logs.restore();
      restore();
    }
    } finally {
      // Close the file-backed client before removing the temporary database.
      await resetPersistenceLifecycle(":memory:");
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
      if (previousRoot === undefined) delete process.env.VENTUREOS_PERSISTENT_ROOT;
      else process.env.VENTUREOS_PERSISTENT_ROOT = previousRoot;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
