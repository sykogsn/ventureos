import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST } from "./capture-gate";
import { shouldBlockFrigoraFieldMutation } from "@/modules/frigora/app/pwa/connectivity";

const WEB_ROOT = join(process.cwd(), "src");
const WEB_APP = join(process.cwd());
const VISIT_PATH = "/ventures/v/work/wo/visit/vi";
const ALLOWED = [
  "recordTechnicalFinding",
  "recordFieldCapture",
  "recordVisitEvidence",
] as const;
const CONTROL_TAGS = ["button", "input", "select", "textarea"] as const;

function read(rel: string) {
  return readFileSync(join(WEB_ROOT, rel), "utf8");
}

function offlinePointerBlock(css: string) {
  const start = css.indexOf("html[data-frigora-offline]");
  const end = css.indexOf('a[href="#main-content"]');
  assert.ok(start >= 0 && end > start, "offline pointer block missing");
  return css.slice(start, end);
}

function notCapture(operation: string) {
  return `:not([data-frigora-offline-capture="${operation}"])`;
}

describe("F33-04 offline pointer allowlist", () => {
  it("1-3. allowlisted capture controls are the only pointer-interactable offline forms", () => {
    const css = offlinePointerBlock(read("app/globals.css"));
    assert.deepEqual([...FRIGORA_OFFLINE_CAPTURE_OPERATION_ALLOWLIST], [...ALLOWED]);
    for (const operation of ALLOWED) {
      assert.match(css, new RegExp(notCapture(operation).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    for (const tag of CONTROL_TAGS) {
      assert.match(
        css,
        new RegExp(
          `${ALLOWED.map((op) => notCapture(op).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("")}\\s*${tag}`,
        ),
      );
    }
    assert.match(css, /pointer-events:\s*none/);
    assert.equal(css.includes("html[data-frigora-offline] form button,"), false);
    assert.equal(css.includes("html[data-frigora-offline] form input,"), false);
  });

  it("4. unrelated forms remain pointer-blocked offline", () => {
    const css = offlinePointerBlock(read("app/globals.css"));
    assert.match(css, /form:not\(\[data-frigora-offline-capture="recordTechnicalFinding"\]\)/);
    assert.doesNotMatch(css, /form\[data-frigora-offline-capture\] (button|input)/);
    assert.equal(css.includes('data-frigora-offline-capture="recordPartUsage"'), false);
  });

  it("5. removeVisitEvidence remains online-only", () => {
    const css = offlinePointerBlock(read("app/globals.css"));
    const removeForm = read("modules/frigora/app/forms/remove-visit-evidence-form.tsx");
    assert.equal(css.includes('data-frigora-offline-capture="removeVisitEvidence"'), false);
    assert.match(removeForm, /data-frigora-online-only-operation="removeVisitEvidence"/);
    assert.equal(removeForm.includes("data-frigora-offline-capture"), false);
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, VISIT_PATH, {
        operationType: "removeVisitEvidence",
      }),
      true,
    );
  });

  it("6. linkVisitEvidence remains online-only and has no capture form", () => {
    const css = offlinePointerBlock(read("app/globals.css"));
    const visitForm = read("modules/frigora/app/forms/record-visit-evidence-form.tsx");
    const recorder = read("modules/frigora/app/screens/visit-recorder-screen.tsx");
    assert.equal(css.includes('data-frigora-offline-capture="linkVisitEvidence"'), false);
    assert.equal(visitForm.includes("linkVisitEvidence"), false);
    assert.equal(recorder.includes("linkVisitEvidence"), false);
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, VISIT_PATH, {
        operationType: "linkVisitEvidence",
      }),
      true,
    );
  });

  it("7. connectivity guard still rejects prohibited offline submissions", () => {
    assert.equal(
      shouldBlockFrigoraFieldMutation(false, VISIT_PATH, {
        operationType: "recordPartUsage",
      }),
      true,
    );
    assert.equal(shouldBlockFrigoraFieldMutation(false, VISIT_PATH), true);
    const banner = read("modules/frigora/app/pwa/connectivity-banner.tsx");
    assert.match(banner, /isFrigoraOfflineCaptureOperationAllowed/);
    assert.match(banner, /preventDefault/);
  });

  it("8-9. allowed captures stay local-only and reconnect does not submit", () => {
    for (const operation of ALLOWED) {
      assert.equal(
        shouldBlockFrigoraFieldMutation(false, VISIT_PATH, { operationType: operation }),
        false,
      );
    }
    const banner = read("modules/frigora/app/pwa/connectivity-banner.tsx");
    assert.equal(banner.includes("submitClientFieldCapture"), false);
    assert.equal(banner.includes("submitClientVisitEvidence"), false);
    assert.equal(banner.includes("submitClientTechnicalFinding"), false);
    assert.equal(banner.includes("submitPending"), false);
    const onlineHandler = banner.slice(
      banner.indexOf('window.addEventListener("online"'),
      banner.indexOf("return () =>"),
    );
    assert.equal(onlineHandler.includes("submit"), false);
  });

  it("10. no Service Worker mutation queue is introduced", () => {
    const sw = readFileSync(join(WEB_APP, "public", "sw.js"), "utf8");
    assert.doesNotMatch(
      sw,
      /outbox|clientOperationId|submitClientFieldCapture|submitClientVisitEvidence|BackgroundSync/,
    );
    assert.equal(sw.includes("indexedDB"), false);
  });

  it("pending rows expose exact operation identity for selector targeting", () => {
    for (const rel of [
      "modules/frigora/app/forms/record-field-capture-form.tsx",
      "modules/frigora/app/forms/record-visit-evidence-form.tsx",
      "modules/frigora/app/forms/record-technical-finding-form.tsx",
    ]) {
      const source = read(rel);
      assert.match(source, /data-frigora-client-operation-id=\{envelope\.clientOperationId\}/);
      assert.match(source, /data-frigora-offline-operation=\{envelope\.operationType\}/);
    }
  });
});
