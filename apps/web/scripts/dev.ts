import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  IdsDevGuardError,
  assertExecutiveRuntimeHtml,
  assertIdsCssBundle,
  prepareIdsDevelopment,
  stylesheetHrefsFromHtml,
  webRootFrom,
} from "./ids-dev-guard";

const LOGIN = "http://127.0.0.1:3000/login";
const READY_TIMEOUT_MS = 90_000;

/** Local `next dev` only: use the Windows CA store. Does not disable TLS verification. */
function developmentEnvWithSystemCa(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const current = env.NODE_OPTIONS ?? "";
  if (/(?:^|\s)--use-system-ca(?:\s|$)/.test(current)) {
    return env;
  }

  return {
    ...env,
    NODE_OPTIONS: current.trim() ? `${current.trim()} --use-system-ca` : "--use-system-ca",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(
  url: string,
): Promise<{ status: number; body: string }> {
  const response = await fetch(url, { redirect: "manual" });
  const body = await response.text();
  return { status: response.status, body };
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
        lastError =
          "Login still reports a CSS resolve error after regenerate. Turbopack did not pick up generated IDS files.";
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(400);
  }

  throw new IdsDevGuardError(
    `Development server did not serve a valid login page within ${READY_TIMEOUT_MS / 1000}s. ${lastError}`,
  );
}

async function assertCssFromLogin(html: string) {
  const hrefs = stylesheetHrefsFromHtml(html);
  if (hrefs.length === 0) {
    if (html.includes("--ids-foundation-color-background")) {
      return;
    }
    throw new IdsDevGuardError(
      "Login HTML has no stylesheet href and no inlined IDS tokens. The CSS bundle was not served.",
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

async function main() {
  const webRoot = webRootFrom();
  prepareIdsDevelopment(webRoot);

  const nextBin = join(webRoot, "node_modules/next/dist/bin/next");
  const child = spawn(
    process.execPath,
    ["--use-system-ca", nextBin, "dev", "--port", "3000"],
    {
      cwd: webRoot,
      stdio: "inherit",
      env: developmentEnvWithSystemCa(process.env),
      windowsHide: true,
    },
  );

  const fail = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`IDS development guard failed.\n${message}`);
    if (child.pid && process.platform === "win32") {
      spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      child.kill();
    }
    process.exit(1);
  };

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  try {
    const login = await waitForLogin();
    assertExecutiveRuntimeHtml(login.body, login.status);
    await assertCssFromLogin(login.body);
    console.log(
      "IDS development guard: login is 200, tokens are in the CSS bundle, ThemeProvider boot script is present.",
    );
  } catch (error) {
    fail(error);
  }
}

void main();
