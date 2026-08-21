import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sessionCookieOptions } from "./session-cookie";

describe("sessionCookieOptions", () => {
  it("persists the cookie when remember is enabled", () => {
    const options = sessionCookieOptions(true);
    assert.equal(options.httpOnly, true);
    assert.equal(options.maxAge, 60 * 60 * 24 * 14);
  });

  it("omits maxAge so the cookie ends when the browser closes", () => {
    const options = sessionCookieOptions(false);
    assert.equal("maxAge" in options, false);
  });
});
