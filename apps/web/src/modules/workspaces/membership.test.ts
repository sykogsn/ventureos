import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, UserId, WorkspaceId } from "../../contracts";
import { createPermissionService, type MembershipStore } from "../../platform/permissions/service";
import { membershipAllowsWorkspaceSelection } from "./membership";

describe("workspace membership validation", () => {
  it("does not switch workspace without a membership role", () => {
    assert.equal(membershipAllowsWorkspaceSelection(null), false);
  });

  it("allows workspace selection when a membership role exists", () => {
    assert.equal(membershipAllowsWorkspaceSelection("member"), true);
    assert.equal(membershipAllowsWorkspaceSelection("owner"), true);
  });

  it("roleFor returns null for an unknown workspace", async () => {
    const roles = new Map<string, Role>();
    const store: MembershipStore = {
      async getRole(userId, workspaceId) {
        return roles.get(`${userId}:${workspaceId}`) ?? null;
      },
      async setRole(userId, workspaceId, role) {
        roles.set(`${userId}:${workspaceId}`, role);
      },
    };
    const permissions = createPermissionService(store);
    const userId = "user-1" as UserId;
    const workspaceId = "ws-foreign" as WorkspaceId;
    assert.equal(await permissions.roleFor(userId, workspaceId), null);
    assert.equal(
      membershipAllowsWorkspaceSelection(await permissions.roleFor(userId, workspaceId)),
      false,
    );
  });
});
