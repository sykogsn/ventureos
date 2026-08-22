import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IdsDevGuardError,
  assertExecutiveRuntimeHtml,
  assertIdsCssBundle,
  assertIdsSourceGraph,
  idsRootFromWeb,
  isPidAlive,
  stylesheetHrefsFromHtml,
  webRootFrom,
} from "./ids-dev-guard";

describe("IDS development guard", () => {
  it("accepts the live source graph", () => {
    const webRoot = webRootFrom();
    assertIdsSourceGraph(webRoot, idsRootFromWeb(webRoot));
  });

  it("rejects login HTML that is a CSS compile error", () => {
    assert.throws(
      () =>
        assertExecutiveRuntimeHtml(
          'CssSyntaxError: Can\'t resolve \'./generated/breakpoints.css\'',
          500,
        ),
      IdsDevGuardError,
    );
  });

  it("accepts a login document with IDS bind and next-themes boot", () => {
    assert.doesNotThrow(() =>
      assertExecutiveRuntimeHtml(
        '<html data-ids-brand="ventureos" data-ids-atmosphere="ventureos"><script>localStorage.getItem("theme")</script></html>',
        200,
      ),
    );
  });

  it("extracts stylesheet hrefs and requires Executive Dark tokens", () => {
    const hrefs = stylesheetHrefsFromHtml(
      '<link rel="stylesheet" href="/_next/static/chunks/tokens.css">',
    );
    assert.deepEqual(hrefs, ["/_next/static/chunks/tokens.css"]);
    assert.doesNotThrow(() =>
      assertIdsCssBundle(
        ":root{--ids-foundation-color-background:#f7f6f3}.dark{--ids-foundation-color-background:#12141a}",
      ),
    );
  });

  it("treats this process as alive", () => {
    assert.equal(isPidAlive(process.pid), true);
  });

  it("rejects a served bundle that still contains invalid media CSS", () => {
    assert.throws(
      () =>
        assertIdsCssBundle(
          "@custom-media --ids-sm (width >= 640px); :root{--ids-foundation-color-background:#f7f6f3}.dark{--ids-foundation-color-background:#12141a}",
        ),
      IdsDevGuardError,
    );
  });
});
