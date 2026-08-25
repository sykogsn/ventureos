import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../..");
const authRoot = join(webSrc, "modules/auth");
const proxySource = readFileSync(join(webSrc, "proxy.ts"), "utf8");
const screens = readFileSync(join(authRoot, "screens.tsx"), "utf8");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, files);
      continue;
    }
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      if (path.endsWith(".test.ts") || path.endsWith(".test.tsx")) {
        continue;
      }
      files.push(path);
    }
  }
  return files;
}

describe("auth credential persistence", () => {
  it("does not write credentials to web storage", () => {
    for (const file of walk(authRoot)) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /sessionStorage/);
      assert.doesNotMatch(source, /localStorage/);
    }
  });

  it("does not prefill the login form from application state", () => {
    const login = screens.slice(
      screens.indexOf("export function LoginScreen"),
      screens.indexOf("function AuthAccountForm"),
    );
    assert.doesNotMatch(login, /defaultValue/);
    assert.match(login, /autoComplete="username"/);
    assert.match(login, /autoComplete="current-password"/);
    assert.match(login, /autoComplete="on"/);
  });

  it("applies no-store navigation headers through the auth proxy", () => {
    assert.match(proxySource, /applyAuthNavigationHeaders/);
    const nextConfig = readFileSync(join(webSrc, "../next.config.js"), "utf8");
    assert.match(nextConfig, /no-store/);
  });
});
