import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeInternalPath } from "./next-path";

describe("safeInternalPath", () => {
  it("returns the requested app path", () => {
    assert.equal(safeInternalPath("/settings"), "/settings");
    assert.equal(safeInternalPath("/ventures/launch"), "/ventures/launch");
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
  });
});
