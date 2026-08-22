import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const index = readFileSync(join(root, "tokens/index.css"), "utf8");
const climate = readFileSync(join(root, "themes/climate.css"), "utf8");
const ventureos = readFileSync(join(root, "tokens/atmosphere/ventureos.css"), "utf8");
const qualora = readFileSync(join(root, "tokens/atmosphere/qualora.css"), "utf8");
const farmora = readFileSync(join(root, "tokens/atmosphere/farmora.css"), "utf8");
const calviora = readFileSync(join(root, "tokens/atmosphere/calviora.css"), "utf8");

const atmospheres = {
  ventureos,
  qualora,
  farmora,
  calviora,
} as const;

describe("Executive Atmosphere tokens", () => {
  it("imports atmosphere files after climate and brand", () => {
    assert.match(index, /atmosphere\/ventureos\.css/);
    assert.match(index, /atmosphere\/qualora\.css/);
    assert.match(index, /atmosphere\/calviora\.css/);
    assert.match(index, /atmosphere\/farmora\.css/);
  });

  it("exposes chrome aliases on climate", () => {
    for (const alias of ["--workspace", "--sidebar", "--toolbar", "--header", "--card", "--overlay"]) {
      assert.ok(climate.includes(alias), `climate missing ${alias}`);
    }
  });

  for (const [id, css] of Object.entries(atmospheres)) {
    it(`${id} dual-writes brand and atmosphere selectors`, () => {
      assert.ok(css.includes(`data-ids-atmosphere="${id}"`));
      assert.ok(css.includes(`data-ids-brand="${id}"`));
    });

    it(`${id} paints workspace, sidebar, and toolbar`, () => {
      assert.ok(css.includes("--workspace"));
      assert.ok(css.includes("--sidebar"));
      assert.ok(css.includes("--toolbar"));
    });
  }

  it("VentureOS HQ retints chrome independently of climate surface fill", () => {
    assert.ok(ventureos.includes("--ids-atmosphere-ventureos-sidebar"));
    assert.ok(ventureos.includes("--ids-atmosphere-ventureos-workspace"));
    assert.ok(ventureos.includes("--ids-atmosphere-ventureos-toolbar"));
  });

  it("keeps Calviora chrome on climate surface fill", () => {
    assert.ok(
      calviora.includes(
        "--ids-atmosphere-calviora-sidebar: var(--ids-foundation-surface-fill)",
      ),
    );
    assert.ok(
      calviora.includes(
        "--ids-atmosphere-calviora-toolbar: var(--ids-foundation-surface-fill)",
      ),
    );
  });
});
