import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import type { Role, UserId, VentureId, WorkspaceId } from "@/contracts";
import type { PersistedVenture } from "@/platform/persistence/repositories/ports";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence, resetPersistenceLifecycle } from "@/platform/persistence/repositories";
import { getPlatform } from "@/platform/kernel";
import { closeFrigoraPersistenceAfterFile } from "../test-persistence-lifecycle";
import { chooseFrigoraDirectAccess } from "./direct-access";
import { listAuthorisedFrigoraVentures } from "./direct-access-resolve";

const NOW = "2026-11-19T00:00:00.000Z";

closeFrigoraPersistenceAfterFile();

after(() => {
  getPlatform().scheduler.stopAll();
});

beforeEach(async () => {
  await resetPersistenceLifecycle(":memory:");
  await ensureSchema();
});

async function addUser(id: string) {
  await getPersistence().users.insert({
    id: id as UserId,
    email: `${id}@example.com`,
    name: id,
    passwordHash: "not-used",
    createdAt: NOW,
  });
}

async function addWorkspace(id: string, name: string) {
  await getPersistence().organisations.insert({
    id: id as WorkspaceId,
    name,
    slug: id,
    createdAt: NOW,
  });
}

async function addMember(workspaceId: string, userId: string, role: Role) {
  await getPersistence().memberships.setRole({
    userId: userId as UserId,
    workspaceId: workspaceId as WorkspaceId,
    role,
    createdAt: NOW,
  });
}

async function addVenture(input: {
  id: string;
  workspaceId: string;
  name: string;
  definitionId: string;
}) {
  await getPersistence().ventures.insert(
    ventureRow({
      id: input.id as VentureId,
      workspaceId: input.workspaceId as WorkspaceId,
      name: input.name,
      slug: input.id,
      definitionId: input.definitionId,
    }),
  );
}

function ventureRow(overrides: Partial<PersistedVenture> = {}): PersistedVenture {
  return {
    id: "ven-frigora" as VentureId,
    workspaceId: "ws-frigora" as WorkspaceId,
    name: "Frigora One",
    slug: "frigora-one",
    stage: "Idea",
    href: "/ventures/hq/frigora-one",
    foundedAt: NOW,
    category: "Operations",
    owner: "Founder",
    hqSummary: "Open.",
    genome: {
      thesis: "Keep the cold chain honest.",
      category: "Operations",
      stage: "Idea",
      goal: "Admit operational identity.",
      posture: "human-led",
      risk: "focused",
      motion: "Serve refrigeration sites.",
      cadence: "Weekly",
    },
    mission: {
      today: {
        title: "",
        ask: "",
        whyNow: "",
        ifDeferred: "",
        timeNeeded: "",
        actionLabel: "",
        actionHref: "/dashboard",
        attention: "hold",
        founderAsk: "",
        active: false,
      },
      sprint: { name: "", objective: "", tasks: [] },
    },
    launchDraft: {},
    documents: { documents: [] },
    risk: { headline: "", signals: [] },
    definitionId: "frigora",
    definitionVersion: "0.2.0",
    lifecycle: "operating",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("authorised Frigora workspace resolution", () => {
  it("uses the Frigora membership rather than the earlier workspace", async () => {
    await addUser("user-owner");
    await addWorkspace("ws-alpha", "Alpha Desk");
    await addWorkspace("ws-zeta", "Zeta Frigora");
    await addMember("ws-alpha", "user-owner", "owner");
    await addMember("ws-zeta", "user-owner", "owner");
    await addVenture({
      id: "ven-desk",
      workspaceId: "ws-alpha",
      name: "Desk Company",
      definitionId: "ventureos.company",
    });
    await addVenture({
      id: "ven-zeta",
      workspaceId: "ws-zeta",
      name: "Zeta Cold",
      definitionId: "frigora",
    });

    const ventures = await listAuthorisedFrigoraVentures("user-owner" as UserId);
    assert.deepEqual(
      ventures.map((venture) => venture.workspaceId),
      ["ws-zeta"],
    );
    assert.deepEqual(chooseFrigoraDirectAccess(ventures), {
      mode: "open",
      path: "/ventures/ven-zeta/operations",
      workspaceId: "ws-zeta",
      ventureId: "ven-zeta",
    });
  });

  it("keeps every authorised Frigora company for an explicit choice", async () => {
    await addUser("user-multi");
    await addWorkspace("ws-one", "One");
    await addWorkspace("ws-two", "Two");
    await addMember("ws-one", "user-multi", "admin");
    await addMember("ws-two", "user-multi", "member");
    await addVenture({
      id: "ven-one",
      workspaceId: "ws-one",
      name: "Plant One",
      definitionId: "frigora",
    });
    await addVenture({
      id: "ven-two",
      workspaceId: "ws-two",
      name: "Plant Two",
      definitionId: "frigora",
    });

    const ventures = await listAuthorisedFrigoraVentures("user-multi" as UserId);
    assert.deepEqual(
      ventures.map((venture) => [venture.id, venture.role]),
      [
        ["ven-one", "admin"],
        ["ven-two", "member"],
      ],
    );
    assert.deepEqual(chooseFrigoraDirectAccess(ventures), { mode: "choose" });
    const fieldChoice = chooseFrigoraDirectAccess([ventures[1]!]);
    assert.equal(fieldChoice.mode, "open");
    if (fieldChoice.mode === "open") {
      assert.equal(fieldChoice.path, "/ventures/ven-two/work/assigned");
      assert.equal(fieldChoice.workspaceId, "ws-two");
    }
  });

  it("does not reveal a Frigora company from another workspace", async () => {
    await addUser("user-owner");
    await addUser("user-outsider");
    await addWorkspace("ws-secret", "Secret");
    await addWorkspace("ws-own", "Own Desk");
    await addMember("ws-secret", "user-owner", "owner");
    await addMember("ws-own", "user-outsider", "owner");
    await addVenture({
      id: "ven-secret",
      workspaceId: "ws-secret",
      name: "Secret Cold",
      definitionId: "frigora",
    });
    await addVenture({
      id: "ven-own",
      workspaceId: "ws-own",
      name: "Own Company",
      definitionId: "ventureos.company",
    });

    const ventures = await listAuthorisedFrigoraVentures("user-outsider" as UserId);
    assert.equal(
      ventures.some((venture) => venture.id === "ven-secret"),
      false,
    );
    assert.deepEqual(ventures, []);
  });

  it("sends a field member to My Work inside that member's workspace", async () => {
    await addUser("user-field");
    await addWorkspace("ws-field", "Field Co");
    await addMember("ws-field", "user-field", "member");
    await addVenture({
      id: "ven-field",
      workspaceId: "ws-field",
      name: "Field Cold",
      definitionId: "frigora",
    });

    const ventures = await listAuthorisedFrigoraVentures("user-field" as UserId);
    assert.equal(ventures.length, 1);
    assert.equal(ventures[0]?.role, "member");
    const choice = chooseFrigoraDirectAccess(ventures);
    assert.equal(choice.mode, "open");
    if (choice.mode === "open") {
      assert.equal(choice.path, "/ventures/ven-field/work/assigned");
      assert.equal(choice.workspaceId, "ws-field");
    }
  });
});
