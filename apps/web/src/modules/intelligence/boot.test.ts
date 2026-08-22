import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { Role, UserId, VentureId, WorkspaceId } from "../../contracts";
import { DEFAULT_VENTURE_DEFINITION_REF } from "../../core/venture-definition";
import { assembleDeskBoot } from "./boot";

const here = dirname(fileURLToPath(import.meta.url));

describe("Desk boot", () => {
  it("resolves session, workspace, and company without calling Runtime", () => {
    const boot = assembleDeskBoot({
      userId: "user-1" as UserId,
      workspaces: [
        {
          id: "ws-a" as WorkspaceId,
          name: "Desk A",
          slug: "desk-a",
          role: "owner" as Role,
        },
      ],
      ventures: [
        {
          id: "co-a" as VentureId,
          workspaceId: "ws-a" as WorkspaceId,
          name: "Alpha",
          slug: "alpha",
          definition: DEFAULT_VENTURE_DEFINITION_REF,
        },
        {
          id: "co-b" as VentureId,
          workspaceId: "ws-a" as WorkspaceId,
          name: "Beta",
          slug: "beta",
          definition: DEFAULT_VENTURE_DEFINITION_REF,
        },
        {
          id: "co-other" as VentureId,
          workspaceId: "ws-other" as WorkspaceId,
          name: "Other",
          slug: "other",
          definition: DEFAULT_VENTURE_DEFINITION_REF,
        },
      ],
      requestedWorkspaceId: "ws-a",
      requestedVentureId: "co-b",
    });

    assert.ok(boot);
    assert.equal(boot.workspaces.length, 1);
    assert.equal(boot.workspace.id, "ws-a");
    assert.deepEqual(boot.ventures.map((item) => item.id), ["co-a", "co-b"]);
    assert.equal(boot.activeVenture?.id, "co-b");
  });

  it("does not import Runtime", () => {
    const source = readFileSync(join(here, "boot.ts"), "utf8");
    assert.doesNotMatch(source, /runExecutiveIntelligenceRuntime|core\/runtime/);
  });
});
