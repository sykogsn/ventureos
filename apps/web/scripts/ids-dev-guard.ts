import {
  assertGeneratedCssIsValid,
  assertIdsCssTreeIsValid,
  generateBreakpointCssFromFoundation,
} from "../../../packages/ids/tokens/css-media";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export class IdsDevGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdsDevGuardError";
  }
}

export type LockInfo = {
  pid: number;
  port: number;
  hostname?: string;
};

export function webRootFrom(moduleUrl = import.meta.url): string {
  return join(dirname(fileURLToPath(moduleUrl)), "..");
}

export function idsRootFromWeb(webRoot: string): string {
  return join(webRoot, "../../packages/ids");
}

export function runIdsGenerate(idsRoot: string): void {
  const foundation = readFileSync(join(idsRoot, "tokens/foundation.css"), "utf8");
  const emitted = generateBreakpointCssFromFoundation(foundation);
  const outputPath = join(idsRoot, "tokens/generated/breakpoints.css");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, emitted);
  assertGeneratedCssIsValid(emitted, outputPath);
  assertIdsCssTreeIsValid(idsRoot);
}

export function assertIdsSourceGraph(webRoot: string, idsRoot: string): void {
  const globals = readFileSync(join(webRoot, "src/app/globals.css"), "utf8");
  const layout = readFileSync(join(webRoot, "src/app/layout.tsx"), "utf8");
  const providers = readFileSync(join(webRoot, "src/app/providers.tsx"), "utf8");
  const theme = readFileSync(
    join(webRoot, "src/core/theme/theme-provider.tsx"),
    "utf8",
  );
  const themeToggle = readFileSync(
    join(webRoot, "src/core/shell/theme-toggle.tsx"),
    "utf8",
  );
  const appearance = readFileSync(
    join(webRoot, "src/modules/settings/appearance.tsx"),
    "utf8",
  );
  const tokensIndex = readFileSync(join(idsRoot, "tokens/index.css"), "utf8");
  const generatedPath = join(idsRoot, "tokens/generated/breakpoints.css");

  if (!globals.includes('@import "@repo/ids/tokens.css"')) {
    throw new IdsDevGuardError(
      "globals.css does not import @repo/ids/tokens.css. The Executive Design System is disconnected.",
    );
  }
  if (!layout.includes('import "./globals.css"')) {
    throw new IdsDevGuardError(
      "Root layout does not import globals.css. Design tokens cannot load.",
    );
  }
  if (!layout.includes("<Providers>") || !providers.includes("ThemeProvider")) {
    throw new IdsDevGuardError(
      "ThemeProvider is not mounted from the root layout Providers tree.",
    );
  }
  if (!theme.includes('attribute="class"') || !theme.includes("NextThemesProvider")) {
    throw new IdsDevGuardError(
      "ThemeProvider is not configured to apply climate via html class.",
    );
  }
  if (!themeToggle.includes("useTheme") || !themeToggle.includes("setTheme")) {
    throw new IdsDevGuardError(
      "Header ThemeToggle is not connected to next-themes.",
    );
  }
  if (!appearance.includes("useTheme") || !appearance.includes("setTheme")) {
    throw new IdsDevGuardError(
      "Settings Appearance selector is not connected to next-themes.",
    );
  }
  if (!tokensIndex.includes('./generated/breakpoints.css')) {
    throw new IdsDevGuardError(
      "IDS tokens/index.css does not import generated/breakpoints.css.",
    );
  }
  if (!existsSync(generatedPath)) {
    throw new IdsDevGuardError(
      "tokens/generated/breakpoints.css is missing after generate. Token pipeline failed.",
    );
  }
  const generated = readFileSync(generatedPath, "utf8");
  try {
    assertGeneratedCssIsValid(generated, generatedPath);
    assertIdsCssTreeIsValid(idsRoot);
  } catch (error) {
    throw new IdsDevGuardError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function generatedTokenStamp(idsRoot: string): string {
  const generated = readFileSync(
    join(idsRoot, "tokens/generated/breakpoints.css"),
    "utf8",
  );
  return createHash("sha256").update(generated).digest("hex");
}

export function invalidateStaleTurbopackCache(
  webRoot: string,
  stamp: string,
): void {
  const stampPath = join(webRoot, ".next/dev/ids-token-stamp");
  const previous = existsSync(stampPath)
    ? readFileSync(stampPath, "utf8").trim()
    : "";
  if (previous === stamp) {
    return;
  }

  const cacheDir = join(webRoot, ".next/dev/cache");
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
  mkdirSync(dirname(stampPath), { recursive: true });
  writeFileSync(stampPath, `${stamp}\n`);
}

export function readDevLock(webRoot: string): LockInfo | null {
  const lockPath = join(webRoot, ".next/dev/lock");
  if (!existsSync(lockPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as {
      pid?: number;
      port?: number;
      hostname?: string;
    };
    if (!parsed.pid || !parsed.port) {
      return null;
    }
    return {
      pid: parsed.pid,
      port: parsed.port,
      hostname: parsed.hostname,
    };
  } catch {
    return null;
  }
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

export function pidsListeningOnPort(port: number): number[] {
  const pids = new Set<number>();
  if (process.platform === "win32") {
    const result = spawnSync("netstat", ["-ano"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const lines = (result.stdout ?? "").split(/\r?\n/);
    const needle = `:${port}`;
    for (const line of lines) {
      if (!line.includes(needle) || !/LISTENING/i.test(line)) {
        continue;
      }
      const pid = Number(line.trim().split(/\s+/).at(-1));
      if (Number.isInteger(pid) && pid > 0) {
        pids.add(pid);
      }
    }
    return [...pids];
  }

  const result = spawnSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" });
  for (const line of (result.stdout ?? "").split(/\r?\n/)) {
    const pid = Number(line.trim());
    if (Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }
  return [...pids];
}

export function recoverStaleDevServer(webRoot: string, port = 3000): string[] {
  const recovered: string[] = [];
  const lockPath = join(webRoot, ".next/dev/lock");
  const lock = readDevLock(webRoot);

  if (lock) {
    if (isPidAlive(lock.pid)) {
      killProcessTree(lock.pid);
      recovered.push(`stopped lock PID ${lock.pid}`);
    }
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
      recovered.push("removed stale .next/dev/lock");
    }
  }

  for (const pid of pidsListeningOnPort(port)) {
    if (pid === process.pid) {
      continue;
    }
    if (isPidAlive(pid)) {
      killProcessTree(pid);
      recovered.push(`stopped listener PID ${pid} on port ${port}`);
    }
  }

  if (existsSync(lockPath) && !readDevLock(webRoot)) {
    unlinkSync(lockPath);
  }

  return recovered;
}

export function assertDevLockIsClear(webRoot: string): void {
  const lockPath = join(webRoot, ".next/dev/lock");
  const lock = readDevLock(webRoot);
  if (!lock) {
    return;
  }
  if (!isPidAlive(lock.pid)) {
    unlinkSync(lockPath);
    return;
  }
  throw new IdsDevGuardError(
    [
      `A Next.js dev server is already running (PID ${lock.pid} on port ${lock.port}).`,
      "That process can keep a failed CSS graph after generated IDS files appear.",
      "Recover, then start again so Turbopack reloads tokens:",
      "  pnpm --filter web recover-dev",
      "  pnpm --filter web dev",
    ].join("\n"),
  );
}

export function assertExecutiveRuntimeHtml(html: string, status: number): void {
  if (status !== 200) {
    const hint = html.includes("Can't resolve")
      ? " CSS failed to resolve generated IDS files."
      : "";
    throw new IdsDevGuardError(
      `Login returned HTTP ${status}, expected 200.${hint} The development server is not serving the Executive Design System.`,
    );
  }
  if (html.includes("CssSyntaxError") || html.includes("Can't resolve")) {
    throw new IdsDevGuardError(
      "Login HTML contains a CSS compilation error. Generated IDS tokens did not load.",
    );
  }
  if (!html.includes('data-ids-brand="ventureos"')) {
    throw new IdsDevGuardError(
      "Login HTML is missing data-ids-brand. Root layout did not render.",
    );
  }
  if (!html.includes('data-ids-atmosphere="ventureos"')) {
    throw new IdsDevGuardError(
      "Login HTML is missing data-ids-atmosphere. Atmosphere bind did not render.",
    );
  }
  if (!html.includes("localStorage.getItem")) {
    throw new IdsDevGuardError(
      "next-themes boot script is missing. ThemeProvider is not mounted.",
    );
  }
}

export function stylesheetHrefsFromHtml(html: string): string[] {
  const hrefs: string[] = [];
  const pattern = /href="([^"]+\.css[^"]*)"/g;
  for (const match of html.matchAll(pattern)) {
    if (match[1]) {
      hrefs.push(match[1]);
    }
  }
  return hrefs;
}

export function assertIdsCssBundle(css: string): void {
  if (css.includes("Can't resolve") || css.includes("CssSyntaxError")) {
    throw new IdsDevGuardError("Served CSS bundle contains a compilation error.");
  }
  if (css.includes("@custom-media") || /width\s*>=\s*var\s*\(/.test(css)) {
    throw new IdsDevGuardError(
      "Served CSS bundle contains invalid generated media CSS (@custom-media or width >= var()).",
    );
  }
  if (!css.includes("--ids-foundation-color-background")) {
    throw new IdsDevGuardError(
      "Served CSS bundle is missing IDS foundation colour tokens.",
    );
  }
  if (!css.includes(".dark") || !css.includes("#12141a")) {
    throw new IdsDevGuardError(
      "Served CSS bundle is missing Executive Dark climate rules.",
    );
  }
}

export function prepareIdsDevelopment(
  webRoot = webRootFrom(),
  options: {
    checkLock?: boolean;
    recover?: boolean;
    invalidateDevCache?: boolean;
  } = {},
): string {
  const recover = options.recover ?? true;
  const checkLock = options.checkLock ?? !recover;
  const invalidateDevCache = options.invalidateDevCache ?? true;
  const idsRoot = idsRootFromWeb(webRoot);
  if (recover) {
    recoverStaleDevServer(webRoot);
  }
  runIdsGenerate(idsRoot);
  assertIdsSourceGraph(webRoot, idsRoot);
  if (checkLock) {
    assertDevLockIsClear(webRoot);
  }
  const stamp = generatedTokenStamp(idsRoot);
  if (invalidateDevCache) {
    invalidateStaleTurbopackCache(webRoot, stamp);
  }
  return stamp;
}

function invokedAsCli() {
  const argv = (process.argv[1] ?? "").replaceAll("\\", "/");
  return argv.endsWith("/ids-dev-guard.ts") || argv.endsWith("ids-dev-guard.ts");
}

if (invokedAsCli()) {
  try {
    const forBuild = process.argv.includes("--build");
    prepareIdsDevelopment(webRootFrom(), {
      checkLock: !forBuild,
      invalidateDevCache: !forBuild,
      recover: !forBuild,
    });
    console.log("IDS development guard: generated tokens are present and the source graph is valid.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`IDS development guard failed.\n${message}`);
    process.exit(1);
  }
}
