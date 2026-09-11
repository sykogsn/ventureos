import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  canonicalAuthUrl,
  canonicalizeLocalOrigin,
  resolveRequestAuthOrigin,
} from "./origin";

const previousAuthUrl = process.env.AUTH_URL;

afterEach(() => {
  if (previousAuthUrl === undefined) {
    delete process.env.AUTH_URL;
  } else {
    process.env.AUTH_URL = previousAuthUrl;
  }
});

describe("auth origin", () => {
  it("keeps localhost and loopback on one OAuth host", () => {
    assert.equal(canonicalizeLocalOrigin("http://127.0.0.1:3000"), "http://localhost:3000");
    assert.equal(canonicalizeLocalOrigin("http://localhost:3000"), "http://localhost:3000");
  });

  it("prefers AUTH_URL so the Google redirect URI stays stable", () => {
    process.env.AUTH_URL = "http://localhost:3000/";
    assert.equal(
      resolveRequestAuthOrigin(new URL("http://127.0.0.1:3000/auth/google")),
      "http://localhost:3000",
    );
  });

  it("moves the OAuth start onto the canonical host before Google sees it", () => {
    delete process.env.AUTH_URL;
    const target = canonicalAuthUrl(
      new URL("http://127.0.0.1:3000/auth/google?next=%2Fdashboard"),
    );
    assert.equal(target?.origin, "http://localhost:3000");
    assert.equal(target?.pathname, "/auth/google");
    assert.equal(canonicalAuthUrl(new URL("http://localhost:3000/auth/google")), null);
  });
});
