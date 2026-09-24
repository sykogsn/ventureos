import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeInternalPath } from "./next-path";

describe("safeInternalPath", () => {
  it("returns the requested app path", () => {
    assert.equal(safeInternalPath("/settings"), "/settings");
    assert.equal(safeInternalPath("/ventures/launch"), "/ventures/launch");
    assert.equal(safeInternalPath("/frigora"), "/frigora");
    assert.equal(
      safeInternalPath("/ventures/ven-1/work/assigned"),
      "/ventures/ven-1/work/assigned",
    );
    assert.equal(
      safeInternalPath("/ventures/ven-1/work/assigned?from=pwa"),
      "/ventures/ven-1/work/assigned?from=pwa",
    );
  });

  it("keeps an internal query string", () => {
    assert.equal(safeInternalPath("/ventures?view=board"), "/ventures?view=board");
  });

  it("rejects missing, external, and auth paths", () => {
    assert.equal(safeInternalPath(null), "/dashboard");
    assert.equal(safeInternalPath(""), "/dashboard");
    assert.equal(safeInternalPath("https://example.com"), "/dashboard");
    assert.equal(safeInternalPath("//example.com"), "/dashboard");
    assert.equal(safeInternalPath("/\\example.com"), "/dashboard");
    assert.equal(safeInternalPath("/login"), "/dashboard");
    assert.equal(safeInternalPath("/signup"), "/dashboard");
    assert.equal(safeInternalPath("/login?next=/settings"), "/dashboard");
    assert.equal(safeInternalPath("/sw.js"), "/dashboard");
    assert.equal(safeInternalPath("/offline.html"), "/dashboard");
    assert.equal(safeInternalPath("/manifest.webmanifest"), "/dashboard");
    assert.equal(safeInternalPath("/frigora-icon/192"), "/dashboard");
  });
});
