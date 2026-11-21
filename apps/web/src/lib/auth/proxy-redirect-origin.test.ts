import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { resolveProxyRedirectOrigin } from "./proxy-redirect-origin";

const PUBLIC_ORIGIN = "https://frigora.ventureoperatingsystem.co.za";
const INTERNAL_REQUEST = "http://localhost:10000/frigora/enter?next=%2Fwork";

function resolve(nodeEnv: string, authUrl?: string, requestUrl = INTERNAL_REQUEST) {
  return resolveProxyRedirectOrigin({ nodeEnv, authUrl, requestUrl });
}

describe("Frigora proxy public redirect origin", () => {
  it("never redirects to Render localhost in production", () => {
    const origin = resolve("production", PUBLIC_ORIGIN);
    assert.equal(origin, PUBLIC_ORIGIN);
    for (const path of [
      "/login?next=%2Ffrigora%2Fenter",
      "/frigora/enter",
      "/ventures/ven-1/work/assigned",
      "/dashboard",
    ]) {
      const redirectUrl: URL = new URL(path, origin);
      assert.equal(redirectUrl.origin, PUBLIC_ORIGIN);
      assert.equal(redirectUrl.hostname.includes("localhost"), false);
    }
    assert.equal(resolve("production", `${PUBLIC_ORIGIN}/`), PUBLIC_ORIGIN);
  });

  it("fails closed when AUTH_URL is missing or not the approved hostname", () => {
    assert.throws(() => resolve("production"), /production_auth_url_missing/);
    for (const url of [
      "http://localhost:10000",
      "https://evil.example",
      "http://frigora.ventureoperatingsystem.co.za",
      "https://frigora.ventureoperatingsystem.co.za.evil.example",
      `${PUBLIC_ORIGIN}/invite`,
      `${PUBLIC_ORIGIN}/?next=/admin`,
      `${PUBLIC_ORIGIN}/#fragment`,
      `https://user:pass@frigora.ventureoperatingsystem.co.za`,
      "not-an-absolute-url",
    ]) {
      assert.throws(() => resolve("production", url), /production_auth_url_invalid/, url);
    }
  });

  it("preserves existing request-base behaviour in development", () => {
    assert.equal(resolve("development"), INTERNAL_REQUEST);
    assert.equal(resolve("test", PUBLIC_ORIGIN), INTERNAL_REQUEST);
    assert.equal(new URL("/login", resolve("development")).origin, "http://localhost:10000");
  });

  it("routes every proxy redirect through the validated base", () => {
    const source = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");
    assert.match(source, /function redirectBase\(request: NextRequest\)/);
    assert.match(source, /resolveProxyRedirectOrigin\(/);
    assert.match(source, /new URL\("\/login", redirectBase\(request\)\)/);
    assert.match(source, /new URL\(FRIGORA_DIRECT_ENTRY_PATH, redirectBase\(request\)\)/);
    assert.match(source, /new URL\(frigoraLogin \?\? "\/dashboard", redirectBase\(request\)\)/);
    assert.doesNotMatch(source, /new URL\([^\n]+request\.url\)/);
  });
});
