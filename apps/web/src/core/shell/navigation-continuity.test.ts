import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = join(dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = join(webSrc, "app");
const appSegment = join(appRoot, "(app)");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("Authenticated navigation keeps the shell mounted", () => {
  it("does not register a root loading fallback above OsShell", () => {
    assert.equal(existsSync(join(appRoot, "loading.tsx")), false);
  });

  it("does not register full-page loading fallbacks inside the desk", () => {
    const loaders = walk(appSegment)
      .filter((file) => file.endsWith("loading.tsx"))
      .map((file) => relative(webSrc, file).replaceAll("\\", "/"));
    assert.deepEqual(loaders, []);
  });

  it("deduplicates session, desk boot, and read-only intelligence per request", () => {
    const session = readFileSync(join(webSrc, "lib/auth/session.ts"), "utf8");
    const boot = readFileSync(join(webSrc, "modules/intelligence/boot.ts"), "utf8");
    const service = readFileSync(
      join(webSrc, "modules/intelligence/service.ts"),
      "utf8",
    );
    const request = readFileSync(
      join(webSrc, "modules/intelligence/request.ts"),
      "utf8",
    );

    assert.match(session, /export const getSession = cache\(/);
    assert.match(boot, /export const bootDesk = cache\(/);
    assert.match(service, /export const loadVentureIntelligence = cache\(/);
    assert.match(request, /loadVentureIntelligence/);
    assert.doesNotMatch(request, /executeIntelligenceRuntime/);
  });

  it("keeps OsShell as the persistent desk frame", () => {
    const layout = readFileSync(join(appSegment, "layout.tsx"), "utf8");
    const shell = readFileSync(join(webSrc, "core/shell/os-shell.tsx"), "utf8");
    assert.match(layout, /<OsShell/);
    assert.match(shell, /<Sidebar \/>/);
    assert.match(shell, /<TopNav \/>/);
    assert.match(shell, /<NavigationProgress \/>/);
    assert.match(shell, /<WorkspaceMain>\{children\}<\/WorkspaceMain>/);
  });
});
