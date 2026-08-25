import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const authRoot = join(dirname(fileURLToPath(import.meta.url)));
const surface = readFileSync(join(authRoot, "presentation/surface.tsx"), "utf8");
const screens = readFileSync(join(authRoot, "screens.tsx"), "utf8");

describe("auth password visibility", () => {
  it("toggles password fields with a non-submitting button", () => {
    assert.match(surface, /type="button"/);
    assert.match(surface, /Show password/);
    assert.match(surface, /Hide password/);
    assert.match(surface, /from "lucide-react"/);
    assert.match(surface, /<Eye /);
    assert.match(surface, /<EyeOff /);
    assert.match(surface, /aria-pressed=\{revealed\}/);
    assert.doesNotMatch(surface, /sessionStorage|localStorage/);
  });

  it("covers sign-in, create-account, and reset password fields", () => {
    assert.match(screens, /id="password"[\s\S]*type="password"/);
    assert.match(screens, /id={`\$\{mode\}-password`}[\s\S]*type="password"/);
    assert.match(screens, /id="new-password"[\s\S]*type="password"/);
    assert.match(screens, /id="confirm-password"[\s\S]*type="password"/);
  });
});
