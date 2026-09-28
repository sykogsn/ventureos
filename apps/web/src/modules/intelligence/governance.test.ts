import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role, UserId, WorkspaceId } from "../../contracts";
import { createPermissionService, type MembershipStore } from "../../platform/permissions/service";
import { FOUNDER_DECISION_PERMISSION } from "./governance";

function storeWith(role: Role | null): MembershipStore {
  return {
    async getRole() {
      return role;
    },
    async setRole() {},
  };
}

describe("founder decision authorisation", () => {
  it("uses venture.update and does not add a permission", () => {
    assert.equal(FOUNDER_DECISION_PERMISSION, "venture.update");
  });

  it("allows owners and admins to record a founder decision", async () => {
    const userId = "user-1" as UserId;
    const workspaceId = "ws-1" as WorkspaceId;
    for (const role of ["owner", "admin"] as const) {
      const permissions = createPermissionService(storeWith(role));
      assert.equal(
        await permissions.can({
          userId,
          permission: FOUNDER_DECISION_PERMISSION,
          resource: { type: "workspace", id: workspaceId },
        }),
        true,
        role,
      );
    }
  });

  it("does not allow members to record a founder decision", async () => {
    const permissions = createPermissionService(storeWith("member"));
    assert.equal(
      await permissions.can({
        userId: "user-1" as UserId,
        permission: FOUNDER_DECISION_PERMISSION,
        resource: { type: "workspace", id: "ws-1" as WorkspaceId },
      }),
      false,
    );
  });
});

import {
  INTELLIGENCE_READ_PERMISSION,
  INTELLIGENCE_WRITE_PERMISSION,
} from "./governance";
describe("operational intelligence permissions", () => {
  for (const role of ["owner", "admin", "member", null] as const) {
    it("uses live role permissions for " + role, async () => {
      const permissions = createPermissionService(storeWith(role));
      const check = {
        userId: "actor" as UserId,
        resource: {
          type: "workspace" as const,
          id: "workspace" as WorkspaceId,
        },
      };
      assert.equal(
        await permissions.can({
          ...check,
          permission: INTELLIGENCE_READ_PERMISSION,
        }),
        role !== null,
      );
      assert.equal(
        await permissions.can({
          ...check,
          permission: INTELLIGENCE_WRITE_PERMISSION,
        }),
        role === "owner" || role === "admin",
      );
    });
  }
});
