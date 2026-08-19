import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveVentureProjectionWorkspace } from "./workspace-scope";

describe("venture workspace projection", () => {
  it("projects the venture workspace even when the cookie names another workspace", () => {
    assert.equal(
      resolveVentureProjectionWorkspace({
        ventureWorkspaceId: "ws-venture",
        cookieWorkspaceId: "ws-cookie",
      }),
      "ws-venture",
    );
  });

  it("does not fall back to the cookie when the venture is missing", () => {
    assert.equal(
      resolveVentureProjectionWorkspace({
        ventureWorkspaceId: null,
        cookieWorkspaceId: "ws-cookie",
      }),
      null,
    );
  });
});
