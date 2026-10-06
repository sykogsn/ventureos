import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EntityLink } from "./entity-link";
import { EntityTrail } from "./entity-trail";
import { ventureEntityPath } from "./entity-routes";
import { NAVIGATION_AFFORDANCE_STANDARD } from "./standard";
import type { EntityRouteResolver } from "./types";

function anchors(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => ({
    attrs: match[1] ?? "",
    text: (match[2] ?? "").replace(/<[^>]+>/g, ""),
    href: /href="([^"]*)"/.exec(match[1] ?? "")?.[1] ?? "",
  }));
}

describe("VentureOS navigation affordance primitives", () => {
  it("builds encoded venture-scoped destinations without product assumptions", () => {
    assert.equal(
      ventureEntityPath("ven/other", "records", "record 1"),
      "/ventures/ven%2Fother/records/record%201",
    );
  });

  it("supports venture-owned route resolution without owning domain meaning", () => {
    type SyntheticReference = {
      kind: "record" | "unsupported";
      id: string;
    };
    type SyntheticContext = { ventureId: string };

    const resolveSyntheticRoute: EntityRouteResolver<
      SyntheticReference,
      SyntheticContext
    > = (reference, context) =>
      reference.kind === "record"
        ? ventureEntityPath(context.ventureId, "records", reference.id)
        : null;

    const supported = resolveSyntheticRoute(
      { kind: "record", id: "rec 1" },
      { ventureId: "ven-1" },
    );
    const unsupported = resolveSyntheticRoute(
      { kind: "unsupported", id: "ghost" },
      { ventureId: "ven-1" },
    );

    assert.equal(supported, "/ventures/ven-1/records/rec%201");
    assert.equal(unsupported, null);

    const unsupportedMarkup = renderToStaticMarkup(
      <EntityLink href={unsupported}>Unsupported record</EntityLink>,
    );
    assert.equal(anchors(unsupportedMarkup).length, 0);
    assert.match(unsupportedMarkup, /Unsupported record/);
    assert.equal(unsupportedMarkup.includes("href="), false);
  });

  it("renders a semantic link only when a supported destination exists", () => {
    const linked = renderToStaticMarkup(
      <EntityLink href="/ventures/ven-1/records/rec-1">REC-1</EntityLink>,
    );
    const linkedAnchors = anchors(linked);
    assert.equal(linkedAnchors.length, 1);
    assert.equal(linkedAnchors[0]?.href, "/ventures/ven-1/records/rec-1");
    assert.match(linkedAnchors[0]?.attrs ?? "", /vos-entity-link/);
    assert.equal((linkedAnchors[0]?.attrs ?? "").includes("onclick"), false);

    const plain = renderToStaticMarkup(<EntityLink href={null}>REC-1</EntityLink>);
    assert.equal(anchors(plain).length, 0);
    assert.match(plain, /REC-1/);
    assert.equal(plain.includes("href="), false);
  });

  it("keeps the current trail item non-navigable with current-page semantics", () => {
    const html = renderToStaticMarkup(
      <EntityTrail
        items={[
          { key: "collection", label: "Records", href: "/ventures/ven-1/records" },
          { key: "parent", label: "Parent without route", href: null },
          { key: "current", label: "REC-1", href: "/should-not-be-used", current: true },
        ]}
      />,
    );

    const found = anchors(html);
    assert.equal(found.length, 1);
    assert.equal(found[0]?.text, "Records");
    assert.equal(found[0]?.href, "/ventures/ven-1/records");
    assert.match(html, /Parent without route/);
    assert.match(html, /aria-current="page"/);
    assert.equal(html.includes("/should-not-be-used"), false);
  });

  it("defines a venture-neutral generation standard", () => {
    const standard = JSON.stringify(NAVIGATION_AFFORDANCE_STANDARD);
    assert.match(standard, /Generated ventures/);
    assert.match(standard, /supported destination/);
    assert.match(standard, /workspace and venture context/);
    assert.doesNotMatch(standard, /Frigora/);
  });

  it("exposes the entity trail through the shared page shell", () => {
    const frame = readFileSync(join(process.cwd(), "src/core/shell/page-frame.tsx"), "utf8");
    const header = readFileSync(join(process.cwd(), "src/core/shell/page-header.tsx"), "utf8");
    assert.match(frame, /trail\?: ReactNode/);
    assert.match(frame, /trail=\{trail\}/);
    assert.match(header, /trail\?: ReactNode/);
    assert.match(header, /\{trail\}/);
  });

  it("inherits the certified entity-link interaction treatment", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    assert.match(css, /@utility vos-entity-link/);
    assert.match(css, /\.vos-entity-link:hover/);
    assert.match(css, /\.vos-entity-link:focus-visible/);
    assert.equal(css.includes(".vos-entity-link:visited"), false);
  });

  it("keeps the core navigation module free of product imports", () => {
    const root = join(process.cwd(), "src/core/navigation");
    for (const file of [
      "entity-link.tsx",
      "entity-trail.tsx",
      "entity-routes.ts",
      "types.ts",
      "standard.ts",
    ]) {
      const source = readFileSync(join(root, file), "utf8");
      assert.equal(source.includes("@/modules/frigora"), false);
      assert.equal(source.includes("modules/frigora"), false);
    }
  });
});
