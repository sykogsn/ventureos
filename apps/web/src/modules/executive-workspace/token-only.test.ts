import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, files);
      continue;
    }
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      files.push(path);
    }
  }
  return files;
}

const forbidden = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\brgb\(/,
  /\boklch\(/,
  /data-venture/,
  /supabase/i,
  /w-\[20rem\]/,
  /w-\[22rem\]/,
  /fonts\.googleapis/,
  /SAMPLE_/,
  /£1\.8/,
];

describe("executive-workspace token consumption", () => {
  const files = walk(root).filter((file) => !file.endsWith(".test.ts"));

  it("scans presentation files", () => {
    assert.ok(files.length > 0);
  });

  for (const file of files) {
    it(`${file.slice(root.length + 1)} contains no workshop tokens or hex`, () => {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        assert.equal(pattern.test(source), false, `${pattern}`);
      }
    });
  }
});
