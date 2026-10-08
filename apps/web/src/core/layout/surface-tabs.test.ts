import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildVentureSurfaceLinks } from "../../modules/frigora/app/nav";

const here = dirname(fileURLToPath(import.meta.url));
const primitives = readFileSync(join(here, "primitives.tsx"), "utf8");

const surfaceTabFace = primitives.split(
  "export function SurfaceTabFace("
)[1]?.split("export function Sequence(")[0];

const surfaceTabs = primitives.split(
  "export function SurfaceTabs("
)[1]?.split("export function SurfaceTabFace(")[0];

describe("F3.2 responsive surface navigation", () => {
  it("keeps active and inactive labels on one line", () => {
    assert.ok(surfaceTabFace);

    const nowrap = surfaceTabFace.match(/whitespace-nowrap/g) ?? [];
    const inlineFlex = surfaceTabFace.match(/inline-flex/g) ?? [];

    assert.equal(nowrap.length, 2);
    assert.equal(inlineFlex.length, 2);
  });

  it("preserves the active-state indicator", () => {
    assert.ok(surfaceTabFace);
    assert.match(surfaceTabFace, /border-b-2 border-accent/);
  });

  it("preserves horizontal navigation scrolling", () => {
    assert.ok(surfaceTabs);
    assert.match(surfaceTabs, /overflow-x-auto/);
  });

  it("preserves the five Frigora navigation destinations", () => {
    const links = buildVentureSurfaceLinks({
      ventureId: "frigora-test",
      slug: "frigora",
      definitionId: "frigora",
      companyHomeHref: "/ventures/hq/frigora",
    });

    assert.deepEqual(
      links.map((link) => link.label),
      ["Operations", "My Work", "Work", "Customers", "Catalogue"]
    );
  });
});
