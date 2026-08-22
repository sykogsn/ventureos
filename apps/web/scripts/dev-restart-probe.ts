import { spawn } from "node:child_process";
import {
  IdsDevGuardError,
  assertExecutiveRuntimeHtml,
  assertIdsCssBundle,
  pidsListeningOnPort,
  prepareIdsDevelopment,
  recoverStaleDevServer,
  stylesheetHrefsFromHtml,
  webRootFrom,
} from "./ids-dev-guard";

const LOGIN = "http://127.0.0.1:3000/login";
const READY_TIMEOUT_MS = 90_000;
const RESTARTS = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string): Promise<{ status: number; body: string }> {
  const response = await fetch(url, { redirect: "manual" });
  const body = await response.text();
  return { status: response.status, body };
}

async function waitForPortFree(port: number) {
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    if (pidsListeningOnPort(port).length === 0) {
      return;
    }
    await sleep(250);
  }
  throw new IdsDevGuardError(`Port ${port} is still occupied after recovery.`);
}

async function waitForLogin(): Promise<{ status: number; body: string }> {
  const started = Date.now();
  let lastError = "Dev server did not become reachable.";

  while (Date.now() - started < READY_TIMEOUT_MS) {
    try {
      const result = await fetchText(LOGIN);
      if (result.status === 200) {
        return result;
      }
      lastError = `Login returned HTTP ${result.status}.`;
      if (
        result.body.includes("Can't resolve") ||
        result.body.includes("CssSyntaxError")
      ) {
        lastError = "Login reports a CSS parse or resolve error.";
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(400);
  }

  throw new IdsDevGuardError(
    `Development server did not serve a valid login page. ${lastError}`,
  );
}

async function assertCssFromLogin(html: string) {
  const hrefs = stylesheetHrefsFromHtml(html);
  if (hrefs.length === 0) {
    if (html.includes("--ids-foundation-color-background")) {
      return;
    }
    throw new IdsDevGuardError(
      "Login HTML has no stylesheet href and no inlined IDS tokens.",
    );
  }

  let lastError = "No stylesheet contained IDS tokens.";
  for (const href of hrefs) {
    const url = href.startsWith("http")
      ? href
      : new URL(href, "http://127.0.0.1:3000").toString();
    try {
      const sheet = await fetchText(url);
      if (sheet.status !== 200) {
        lastError = `Stylesheet ${url} returned HTTP ${sheet.status}.`;
        continue;
      }
      assertIdsCssBundle(sheet.body);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new IdsDevGuardError(lastError);
}

function stopChild(pid: number | undefined) {
  if (!pid) {
    return;
  }
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
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

async function runOnce(webRoot: string, attempt: number) {
  recoverStaleDevServer(webRoot);
  await waitForPortFree(3000);
  prepareIdsDevelopment(webRoot, { recover: false, checkLock: true });

  const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(pnpmBin, ["exec", "next", "dev", "--port", "3000"], {
    cwd: webRoot,
    stdio: "pipe",
    shell: true,
    env: process.env,
  });

  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    const login = await waitForLogin();
    assertExecutiveRuntimeHtml(login.body, login.status);
    await assertCssFromLogin(login.body);
    if (
      stderr.includes("CssSyntaxError") ||
      stderr.includes("Can't resolve") ||
      /width\s*>=\s*var\s*\(/.test(stderr)
    ) {
      throw new IdsDevGuardError(
        `Restart ${attempt} logged a CSS parse error.\n${stderr}`,
      );
    }
    console.log(`IDS restart probe ${attempt}/${RESTARTS}: login 200, CSS valid.`);
  } finally {
    stopChild(child.pid);
    recoverStaleDevServer(webRoot);
    await waitForPortFree(3000);
  }
}

async function main() {
  const webRoot = webRootFrom();
  recoverStaleDevServer(webRoot);
  await waitForPortFree(3000);

  for (let attempt = 1; attempt <= RESTARTS; attempt += 1) {
    await runOnce(webRoot, attempt);
  }

  console.log(
    `IDS restart probe: ${RESTARTS} consecutive clean starts. No CSS parse errors.`,
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`IDS restart probe failed.\n${message}`);
  process.exit(1);
});
