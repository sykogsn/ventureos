import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { AgentInstanceId, VentureId, WorkspaceId } from "@/contracts/ids";
import {
  authoriseApprover,
  WORKFORCE_APPROVAL_PERMISSION,
} from "@/core/workforce/approval";

const here = dirname(fileURLToPath(import.meta.url));

describe("workforce approval authorisation", () => {
  it("reuses venture.update and does not add a permission", async () => {
    assert.equal(WORKFORCE_APPROVAL_PERMISSION, "venture.update");
    const permissions = await readFile(
      join(here, "../../contracts/permissions.ts"),
      "utf8",
    );
    assert.doesNotMatch(permissions, /workforce\.approve|agent\.approve/);
  });

  it("rejects agents and missing humans", () => {
    assert.equal(authoriseApprover(undefined).ok, false);
    const agent = authoriseApprover({
      kind: "agent",
      agentInstanceId: "instance-1" as AgentInstanceId,
      workspaceId: "ws-1" as WorkspaceId,
      ventureId: "venture-1" as VentureId,
    });
    assert.equal(agent.ok, false);
    if (!agent.ok) {
      assert.equal(agent.reason, "AGENT_CANNOT_APPROVE");
    }
  });
});
