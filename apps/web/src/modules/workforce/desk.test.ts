import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { listCommandContributions, listNavContributions } from "@/extensions";
import {
  resolveWorkforceDeskState,
  WORKFORCE_VERIFICATION_LANGUAGE,
} from "@/modules/workforce/desk";

const root = dirname(fileURLToPath(import.meta.url));
const deskScreen = readFileSync(join(root, "desk-screen.tsx"), "utf8");
const page = readFileSync(
  join(root, "../../app/(app)/workforce/page.tsx"),
  "utf8",
);
const loading = readFileSync(
  join(root, "../../app/(app)/workforce/loading.tsx"),
  "utf8",
);
const builtin = readFileSync(
  join(root, "../../extensions/builtin.ts"),
  "utf8",
);

const forbiddenPresentation = [
  "listWorkforceInstancesAction",
  "listWorkforceRunsAction",
  "inspectWorkforceRunAction",
  "listWorkforceInstancesFromSession",
  "listWorkforceRunsFromSession",
  "inspectWorkforceRunFromSession",
  "createWorkforceRunFromSession",
  "activate",
  "CONFIRM",
  "DISMISS",
  "Evidence Pack",
  "CQC",
];

describe("workforce desk D0", () => {
  it("registers Operate → Workforce without using the Bot icon or /agents", () => {
    const workforce = listNavContributions().find((item) => item.id === "workforce");
    const office = listNavContributions().find((item) => item.id === "agents");

    assert.ok(workforce);
    assert.equal(workforce?.label, "Workforce");
    assert.equal(workforce?.href, "/workforce");
    assert.equal(workforce?.section, "operate");
    assert.equal(workforce?.icon, "users");
    assert.notEqual(workforce?.icon, "bot");

    assert.ok(office);
    assert.equal(office?.href, "/agents");
    assert.equal(office?.label, "Executive Office");
    assert.equal(office?.icon, "bot");
  });

  it("registers command navigation to Workforce without making agents the primary term", () => {
    const command = listCommandContributions().find(
      (item) => item.id === "nav.workforce",
    );

    assert.ok(command);
    assert.equal(command?.title, "Go to Workforce");
    assert.equal(command?.href, "/workforce");
    assert.equal(command?.group, "navigation");
    assert.deepEqual(command?.keywords, ["workforce", "employees", "runs"]);
    assert.doesNotMatch(command?.title ?? "", /\bagents\b/i);
    assert.equal(command?.keywords?.includes("agents"), false);
  });

  it("resolves D0 scope states without Workforce data", () => {
    assert.equal(
      resolveWorkforceDeskState({
        hasWorkspace: false,
        canOperate: false,
        companyCount: 0,
      }),
      "workspace-required",
    );
    assert.equal(
      resolveWorkforceDeskState({
        hasWorkspace: true,
        canOperate: false,
        companyCount: 2,
      }),
      "unauthorised",
    );
    assert.equal(
      resolveWorkforceDeskState({
        hasWorkspace: true,
        canOperate: true,
        companyCount: 0,
      }),
      "company-required",
    );
    assert.equal(
      resolveWorkforceDeskState({
        hasWorkspace: true,
        canOperate: true,
        companyCount: 1,
      }),
      "ready",
    );
  });

  it("keeps locked verification language and executive empty-state copy", () => {
    assert.match(
      WORKFORCE_VERIFICATION_LANGUAGE,
      /independently observed the intended execution state/,
    );
    assert.match(
      WORKFORCE_VERIFICATION_LANGUAGE,
      /does not mean the AI judgement is correct, complete, or regulator-accepted/,
    );
    assert.match(deskScreen, /WORKFORCE_VERIFICATION_LANGUAGE/);
    assert.match(deskScreen, /A workspace is required/);
    assert.match(deskScreen, /Operating authority is required/);
    assert.match(deskScreen, /No company on this desk/);
    assert.match(deskScreen, /Found Company/);
    assert.match(deskScreen, /workforce-employees-heading/);
    assert.match(deskScreen, /workforce-runs-heading/);
    assert.doesNotMatch(deskScreen, /No items/);
    assert.doesNotMatch(deskScreen, /chatbot|playground|prompt editor/i);
  });

  it("does not fetch Workforce data or couple Qualora review into D0 presentation", () => {
    for (const source of [deskScreen, page, loading]) {
      for (const forbidden of forbiddenPresentation) {
        assert.equal(
          source.includes(forbidden),
          false,
          `${forbidden} must not appear in D0 presentation`,
        );
      }
    }
    assert.match(page, /WORKFORCE_APPROVAL_PERMISSION/);
    assert.match(page, /permissions\.can/);
    assert.doesNotMatch(page, /listWorkforce/);
    assert.doesNotMatch(builtin, /icon: "bot",\s*[\s\S]*id: "workforce"/);
  });
});
