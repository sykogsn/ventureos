import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { Role, UserId, WorkspaceId } from "../../contracts";
import { createPermissionService, type MembershipStore } from "../../platform/permissions/service";
import {
  assertCanCreateWorkspace,
  assertWorkspaceKnown,
  canFoundFirstWorkspace,
  resolveWorkspace,
} from "./index";
import type { WorkspaceRegistryEntry } from "./types";

const here = dirname(fileURLToPath(import.meta.url));

function entry(
  id: string,
  role: Role = "owner",
): WorkspaceRegistryEntry {
  return {
    id: id as WorkspaceId,
    name: id,
    slug: id,
    role,
  };
}

describe("Workspace Registry", () => {
  it("lists only resolved entries and falls back to the first allowed workspace", () => {
    const workspaces = [entry("ws-a"), entry("ws-b")];
    assert.equal(resolveWorkspace(workspaces, "ws-b")?.id, "ws-b");
    assert.equal(resolveWorkspace(workspaces, "ws-foreign")?.id, "ws-a");
    assert.equal(resolveWorkspace([], "ws-a"), null);
  });

  it("fails closed on an unknown workspace id", () => {
    assert.throws(() => assertWorkspaceKnown([entry("ws-a")], "ws-missing"), {
      message: "Unknown workspace.",
    });
  });

  it("allows founding the first workspace and asserts workspace.create after that", async () => {
    assert.equal(canFoundFirstWorkspace(0), true);
    assert.equal(canFoundFirstWorkspace(1), false);

    const roles = new Map<string, Role>([["user-1:ws-a", "member"]]);
    const store: MembershipStore = {
      async getRole(userId, workspaceId) {
        return roles.get(`${userId}:${workspaceId}`) ?? null;
      },
      async setRole() {
        return undefined;
      },
    };
    const permissions = createPermissionService(store);

    await assert.rejects(
      () =>
        assertCanCreateWorkspace({
          userId: "user-1" as UserId,
          workspaces: [entry("ws-a", "member")],
          scopeWorkspaceId: "ws-a",
          permissions,
        }),
      { message: "You cannot create a workspace." },
    );

    roles.set("user-1:ws-a", "owner");
    await assertCanCreateWorkspace({
      userId: "user-1" as UserId,
      workspaces: [entry("ws-a", "owner")],
      scopeWorkspaceId: "ws-a",
      permissions,
    });
  });

  it("does not import Runtime", () => {
    const source = [
      readFileSync(join(here, "registry.ts"), "utf8"),
      readFileSync(join(here, "assert.ts"), "utf8"),
      readFileSync(join(here, "types.ts"), "utf8"),
    ].join("\n");
    assert.doesNotMatch(source, /runExecutiveIntelligenceRuntime|core\/runtime/);
  });
});
