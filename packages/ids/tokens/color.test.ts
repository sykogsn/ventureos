import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const foundation = readFileSync(join(root, "tokens/foundation.css"), "utf8");
const climate = readFileSync(join(root, "themes/climate.css"), "utf8");

const requiredFoundation = [
  "--ids-foundation-color-background",
  "--ids-foundation-color-surface",
  "--ids-foundation-color-surface-elevated",
  "--ids-foundation-color-border",
  "--ids-foundation-color-divider",
  "--ids-foundation-color-text-primary",
  "--ids-foundation-color-text-secondary",
  "--ids-foundation-color-text-muted",
  "--ids-foundation-color-text-disabled",
  "--ids-foundation-color-text-inverse",
  "--ids-foundation-color-brand-primary",
  "--ids-foundation-color-brand-primary-hover",
  "--ids-foundation-color-brand-primary-active",
  "--ids-foundation-color-success",
  "--ids-foundation-color-warning",
  "--ids-foundation-color-danger",
  "--ids-foundation-color-info",
  "--ids-foundation-color-chart-1",
  "--ids-foundation-color-chart-8",
];

const requiredAliases = [
  "--background",
  "--surface",
  "--surface-elevated",
  "--border",
  "--divider",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--text-disabled",
  "--text-inverse",
  "--brand-primary",
  "--brand-primary-hover",
  "--brand-primary-active",
  "--success",
  "--warning",
  "--danger",
  "--info",
  "--chart-1",
  "--chart-8",
];

function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `missing ${selector}`);
  const brace = css.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(brace, i + 1);
    }
  }
  throw new Error(`unclosed ${selector}`);
}

describe("IDS executive colour tokens", () => {
  const light = block(foundation, ":root");
  const dark = block(foundation, ".dark");

  for (const token of requiredFoundation) {
    it(`defines ${token} in Executive Light and Executive Dark`, () => {
      assert.ok(light.includes(token), `light missing ${token}`);
      assert.ok(dark.includes(token), `dark missing ${token}`);
    });
  }

  it("does not introduce a third climate selector", () => {
    assert.equal((foundation.match(/color-scheme:/g) ?? []).length, 2);
  });

  for (const alias of requiredAliases) {
    it(`exposes alias ${alias}`, () => {
      assert.ok(climate.includes(alias), `climate missing ${alias}`);
    });
  }
});
