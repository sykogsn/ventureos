import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TokenCssError,
  assertGeneratedCssIsValid,
  assertIdsCssTreeIsValid,
  generateBreakpointCssFromFoundation,
} from "./css-media";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const foundationPath = join(root, "tokens/foundation.css");
const outputPath = join(root, "tokens/generated/breakpoints.css");

export function generateIdsTokens(idsRoot = root): string {
  const foundation = readFileSync(join(idsRoot, "tokens/foundation.css"), "utf8");
  const emitted = generateBreakpointCssFromFoundation(foundation);
  const dest = join(idsRoot, "tokens/generated/breakpoints.css");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, emitted);
  assertGeneratedCssIsValid(emitted, dest);
  assertIdsCssTreeIsValid(idsRoot);
  return emitted;
}

function main() {
  const check = process.argv.includes("--check");
  const foundation = readFileSync(foundationPath, "utf8");
  const emitted = generateBreakpointCssFromFoundation(foundation);

  if (check) {
    let current: string;
    try {
      current = readFileSync(outputPath, "utf8");
    } catch {
      throw new TokenCssError(
        "tokens/generated/breakpoints.css is missing. Run `pnpm --filter @repo/ids generate` before starting the app.",
      );
    }
    if (current !== emitted) {
      throw new TokenCssError(
        "tokens/generated/breakpoints.css is stale. Run `pnpm --filter @repo/ids generate`.",
      );
    }
    assertGeneratedCssIsValid(current, outputPath);
    assertIdsCssTreeIsValid(root);
    return;
  }

  generateIdsTokens(root);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
