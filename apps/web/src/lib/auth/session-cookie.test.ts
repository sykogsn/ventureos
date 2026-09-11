import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTH_COOKIES,
  expireAuthCookies,
  expiredAuthCookieOptions,
  sessionCookieOptions,
} from "./session-cookie";

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

  it("expires every auth cookie on the same path so logout cannot leave a live token", () => {
    const expired = expiredAuthCookieOptions();
    assert.equal(expired.path, "/");
    assert.equal(expired.maxAge, 0);

    const jar = new Map<string, { value: string; maxAge?: number; path?: string }>();
    expireAuthCookies({
      set(name, value, options) {
        jar.set(name, { value, maxAge: options.maxAge, path: options.path });
      },
    });

    assert.equal(jar.size, AUTH_COOKIES.length);
    for (const name of AUTH_COOKIES) {
      const cookie = jar.get(name);
      assert.equal(cookie?.value, "");
      assert.equal(cookie?.maxAge, 0);
      assert.equal(cookie?.path, "/");
    }
  });
});
