import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const surfaces = readFileSync(join(root, "tokens/surfaces.css"), "utf8");
const climate = readFileSync(join(root, "themes/climate.css"), "utf8");

const required = [
  "--ids-foundation-surface-fill",
  "--ids-foundation-surface-fill-elevated",
  "--ids-foundation-surface-hover",
  "--ids-foundation-surface-selected",
  "--ids-foundation-surface-focus",
  "--ids-foundation-surface-glass-fill",
  "--ids-foundation-surface-glass-blur",
  "--ids-foundation-surface-border",
  "--ids-foundation-surface-border-subtle",
  "--ids-foundation-surface-border-selected",
  "--ids-foundation-surface-border-focus",
  "--ids-foundation-surface-radius",
  "--ids-foundation-surface-radius-chrome",
  "--ids-foundation-surface-shadow-raised",
  "--ids-foundation-surface-shadow-modal",
  "--ids-foundation-surface-elevation-raised",
];

const aliases = [
  "--surface-hover",
  "--surface-selected",
  "--surface-focus",
  "--surface-glass",
];

describe("IDS executive surface tokens", () => {
  for (const token of required) {
    it(`defines ${token}`, () => {
      assert.ok(surfaces.includes(token), `missing ${token}`);
    });
  }

  it("does not redefine colour hex", () => {
    assert.equal((surfaces.match(/#[0-9a-fA-F]{3,8}/g) ?? []).length, 0);
  });

  for (const alias of aliases) {
    it(`exposes alias ${alias}`, () => {
      assert.ok(climate.includes(alias), `climate missing ${alias}`);
    });
  }
});
