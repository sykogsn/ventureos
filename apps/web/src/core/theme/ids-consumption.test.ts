import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const globals = readFileSync(join(webRoot, "src/app/globals.css"), "utf8");
const climate = readFileSync(
  join(webRoot, "../../packages/ids/themes/climate.css"),
  "utf8",
);
const theme = readFileSync(
  join(webRoot, "src/core/theme/theme-provider.tsx"),
  "utf8",
);

describe("IDS consumption", () => {
  it("projects Tailwind colour roles through climate aliases", () => {
    assert.match(globals, /--color-background:\s*var\(--background\)/);
    assert.match(globals, /--color-foreground:\s*var\(--text-primary\)/);
    assert.match(globals, /--color-accent:\s*var\(--accent\)/);
    assert.doesNotMatch(
      globals,
      /--color-background:\s*var\(--ids-foundation-color-background\)/,
    );
  });

  it("paints surfaces, fields, and buttons through climate aliases", () => {
    assert.match(globals, /@utility ids-surface \{[\s\S]*background:\s*var\(--surface\)/);
    assert.match(globals, /@utility ids-surface-card \{[\s\S]*background:\s*var\(--card\)/);
    assert.match(globals, /@utility vos-field \{[\s\S]*background:\s*var\(--surface\)/);
    assert.match(
      globals,
      /@utility vos-btn-secondary \{[\s\S]*background:\s*var\(--surface\)/,
    );
    assert.match(globals, /body \{\s*background:\s*var\(--workspace\)/);
    assert.equal(globals.includes("var(--ids-foundation-surface-fill)"), false);
  });

  it("keeps climate aliases as the retint layer", () => {
    assert.match(climate, /--background:\s*var\(--ids-foundation-color-background\)/);
    assert.match(climate, /--workspace:\s*var\(--background\)/);
    assert.match(climate, /--overlay:\s*var\(--ids-foundation-color-overlay\)/);
  });

  it("persists climate on the html class", () => {
    assert.match(theme, /attribute="class"/);
    assert.match(theme, /storageKey="theme"/);
    assert.match(theme, /enableSystem/);
  });
});
