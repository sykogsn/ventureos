import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildVentureSurfaceLinks } from "@/modules/frigora/app/nav";

const WEB_ROOT = join(process.cwd(), "src");
const OFFICE_ROUTES = [
  "app/(app)/ventures/[ventureId]/quotations/page.tsx",
  "app/(app)/ventures/[ventureId]/quotations/[quotationId]/page.tsx",
  "app/(app)/ventures/[ventureId]/quotations/tax/page.tsx",
  "app/(app)/ventures/[ventureId]/commercial-catalogue/page.tsx",
  "app/(app)/ventures/[ventureId]/customers/page.tsx",
  "app/(app)/ventures/[ventureId]/customers/[customerId]/page.tsx",
  "app/(app)/ventures/[ventureId]/customers/[customerId]/sites/[siteId]/page.tsx",
  "app/(app)/ventures/[ventureId]/customers/[customerId]/sites/[siteId]/assets/[assetId]/page.tsx",
] as const;

describe("Frigora office access protection", () => {
  it("fails closed for Members at the office-context gate", () => {
    const context = readFileSync(join(WEB_ROOT, "modules/frigora/app/context.ts"), "utf8");
    assert.match(context, /export async function requireFrigoraOfficeContext/);
    assert.match(context, /if \(!ctx\.canWrite\) notFound\(\)/);
    assert.match(context, /requireFrigoraOpsContext\(ventureIdParam\)/);
  });

  it("checks office permission before showing each direct customer and commercial route", () => {
    for (const route of OFFICE_ROUTES) {
      const src = readFileSync(join(WEB_ROOT, route), "utf8");
      assert.match(src, /requireFrigoraOfficeContext\(ventureId\)/, route);
      assert.doesNotMatch(src, /requireFrigoraOpsContext\(ventureId\)/, route);
    }
  });

  it("does not show pricing, customer directories or office work tabs to field Members", () => {
    const input = {
      ventureId: "ven-1",
      slug: "frigora-one",
      definitionId: "frigora",
      companyHomeHref: "/ventures/hq/frigora-one",
    };
    const field = buildVentureSurfaceLinks(input).map((tab) => tab.label);
    assert.deepEqual(field, ["My Work", "Catalogue"]);
    const office = buildVentureSurfaceLinks({ ...input, canAccessOffice: true, canManageTeam: true })
      .map((tab) => tab.label);
    assert.deepEqual(office, [
      "Operations", "Team & Access", "My Work", "Work",
      "Customers", "Catalogue", "Commercial Catalogue", "Quotations",
    ]);
    const platform = buildVentureSurfaceLinks({ ...input, definitionId: "ventureos.company" });
    assert.equal(platform.some((tab) => tab.label === "My Work"), false);
  });

  it("derives the field-versus-office navigation from authenticated workspace membership", () => {
    const layout = readFileSync(join(WEB_ROOT, "app/(app)/ventures/[ventureId]/layout.tsx"), "utf8");
    assert.match(layout, /permissions\.roleFor\(session\.id, venture\.workspaceId\)/);
    assert.match(layout, /canAccessOffice=\{canManageTeam\}/);
    assert.match(layout, /memberRole === "owner" \|\| memberRole === "admin"/);
  });
});
