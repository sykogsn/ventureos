import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolveRouteVentureId } from "./venture-route";

const here = dirname(fileURLToPath(import.meta.url));

const ventures = [
  { id: "co-a", slug: "alpha" },
  { id: "co-b", slug: "beta" },
];

describe("Venture route sync", () => {
  it("keeps the desk-boot company when the route is not company-scoped", () => {
    assert.equal(
      resolveRouteVentureId({
        ventures,
      }),
      undefined,
    );
  });

  it("resolves a company HQ slug without inventing a foreign id", () => {
    assert.equal(
      resolveRouteVentureId({
        routeSlug: "beta",
        ventures,
      }),
      "co-b",
    );
    assert.equal(
      resolveRouteVentureId({
        routeSlug: "missing",
        ventures,
      }),
      undefined,
    );
  });

  it("switches company through the desk boot action, not Runtime", () => {
    const switcher = readFileSync(join(here, "venture-switcher.tsx"), "utf8");
    const select = readFileSync(
      join(here, "../../modules/ventures/select.ts"),
      "utf8",
    );
    assert.match(switcher, /selectVentureAction/);
    assert.doesNotMatch(switcher, /runExecutiveIntelligenceRuntime|core\/runtime/);
    assert.doesNotMatch(select, /runExecutiveIntelligenceRuntime|core\/runtime/);
  });
});
