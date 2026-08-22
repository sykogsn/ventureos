import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  TokenCssError,
  assertMediaQueriesAreStatic,
  emitBreakpointCss,
  generateBreakpointCssFromFoundation,
  parseFoundationBreakpoints,
} from "./css-media";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walkCss(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walkCss(path, files);
      continue;
    }
    if (path.endsWith(".css")) {
      files.push(path);
    }
  }
  return files;
}

describe("IDS media-query token pipeline", () => {
  const foundation = readFileSync(join(root, "tokens/foundation.css"), "utf8");
  const generated = generateBreakpointCssFromFoundation(foundation);

  it("parses static foundation breakpoints", () => {
    assert.deepEqual(parseFoundationBreakpoints(foundation), {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    });
  });

  it("emits Tailwind theme breakpoints as resolved lengths", () => {
    assert.match(generated, /--breakpoint-sm: 640px;/);
    assert.match(generated, /--breakpoint-xl: 1280px;/);
    assert.doesNotMatch(generated, /--breakpoint-sm:\s*var\(/);
  });

  it("does not emit custom-media at-rules that Next CSS parse warns on", () => {
    assert.doesNotMatch(generated, /@custom-media/);
  });

  it("rejects @custom-media even without var()", () => {
    assert.throws(
      () =>
        assertMediaQueriesAreStatic(
          "@custom-media --ids-sm (width >= 640px);",
          "fixture",
        ),
      TokenCssError,
    );
  });

  it("rejects foundation breakpoints that use CSS variables", () => {
    assert.throws(
      () =>
        parseFoundationBreakpoints(
          ":root { --ids-foundation-breakpoint-sm: var(--other); }",
        ),
      TokenCssError,
    );
  });

  it("rejects generated CSS that would produce var() media queries", () => {
    assert.throws(
      () =>
        assertMediaQueriesAreStatic(
          "@media (width >= var(--ids-foundation-breakpoint-sm)) { .sm\\:block { display: block; } }",
          "fixture",
        ),
      TokenCssError,
    );
    assert.throws(
      () =>
        assertMediaQueriesAreStatic(
          "@theme inline { --breakpoint-sm: var(--ids-foundation-breakpoint-sm); }",
          "fixture",
        ),
      TokenCssError,
    );
  });

  it("keeps generated/breakpoints.css in sync with foundation.css", () => {
    const onDisk = readFileSync(
      join(root, "tokens/generated/breakpoints.css"),
      "utf8",
    );
    assert.equal(onDisk, generated);
  });

  it("does not emit var() media queries anywhere in IDS CSS", () => {
    for (const file of walkCss(join(root, "tokens")).concat(
      walkCss(join(root, "themes")),
    )) {
      assertMediaQueriesAreStatic(readFileSync(file, "utf8"), file);
    }
  });

  it("does not accept var() theme breakpoints from emitBreakpointCss", () => {
    const css = emitBreakpointCss({
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    });
    assertMediaQueriesAreStatic(css);
  });

  it("does not map Tailwind breakpoints to var() in the web theme file", () => {
    const globals = readFileSync(
      join(root, "../../apps/web/src/app/globals.css"),
      "utf8",
    );
    assertMediaQueriesAreStatic(globals, "apps/web/src/app/globals.css");
  });
});
