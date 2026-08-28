import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { UserId, VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId } from "@/contracts/ids";
import { QUALORA_EVIDENCE_ANALYST_DEFINITION } from "@/modules/qualora/definition";
import {
  deriveEmployeeLabelFromDefinitionId,
  loadWorkforceEmployeeDirectory,
  projectReadiness,
  projectWorkforceEmployeeDirectoryEntry,
} from "@/modules/workforce/employees-read-model";
import type { WorkforceAgentInstanceView } from "@/modules/workforce/session-entry";

const root = dirname(fileURLToPath(import.meta.url));
const employeeDirectory = readFileSync(
  join(root, "employee-directory.tsx"),
  "utf8",
);

const userId = "user-operator" as UserId;
const memberId = "user-member" as UserId;
const ventureId = "venture-home" as VentureId;
const workspaceId = "ws-home" as WorkspaceId;

function session(id = userId) {
  return { id, email: `${id}@ventureos.test`, name: "Operator" };
}

function instanceView(
  overrides: Partial<WorkforceAgentInstanceView> = {},
): WorkforceAgentInstanceView {
  return {
    id: "instance-1" as AgentInstanceId,
    definitionId: QUALORA_EVIDENCE_ANALYST_DEFINITION.id,
    definitionVersion: QUALORA_EVIDENCE_ANALYST_DEFINITION.version,
    workspaceId,
    ventureId,
    status: "active",
    ...overrides,
  };
}

describe("workforce employee directory read model", () => {
  it("derives fallback labels from definitionId without Qualora imports in projection", () => {
    assert.equal(
      deriveEmployeeLabelFromDefinitionId("qualora.evidence-analyst"),
      "Evidence Analyst",
    );
  });

  it("projects authorised directory entries from instance and definition metadata", () => {
    const entry = projectWorkforceEmployeeDirectoryEntry({
      instance: instanceView(),
      definition: QUALORA_EVIDENCE_ANALYST_DEFINITION,
      ventureName: "Home Venture",
    });

    assert.equal(entry.name, "Qualora Evidence Analyst");
    assert.equal(entry.role, "Evidence Analyst");
    assert.equal(entry.employeeType, "AI employee");
    assert.equal(entry.statusLabel, "Active");
    assert.equal(entry.autonomyLabel, "Execute");
    assert.equal(entry.capabilitySummary, "Evidence Assessment");
    assert.equal(entry.readinessLabel, "Ready to operate");
    assert.equal(entry.ventureName, "Home Venture");
    assert.equal(entry.definitionId, QUALORA_EVIDENCE_ANALYST_DEFINITION.id);
  });

  it("projects lifecycle and status honestly when definition metadata is missing", () => {
    const entry = projectWorkforceEmployeeDirectoryEntry({
      instance: instanceView({ status: "disabled" }),
      ventureName: "Home Venture",
    });
    assert.equal(entry.name, "Evidence Analyst");
    assert.equal(entry.statusLabel, "Inactive");
    assert.equal(entry.autonomyLabel, null);
    assert.equal(entry.capabilitySummary, null);
    assert.equal(entry.readinessLabel, "Not operating");

    const readiness = projectReadiness({
      instanceStatus: "active",
      definitionLifecycle: "DISABLED",
    });
    assert.equal(readiness.readinessLabel, "Disabled");
  });

  it("lists employees only inside session venture scope", async () => {
    const directory = await loadWorkforceEmployeeDirectory(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId,
      },
      {
        canOperate: async () => true,
        loadVenture: async () => ({ workspaceId }),
        listInstances: async () => [
          {
            id: "instance-home" as AgentInstanceId,
            definitionId: QUALORA_EVIDENCE_ANALYST_DEFINITION.id,
            definitionVersion: QUALORA_EVIDENCE_ANALYST_DEFINITION.version,
            workspaceId,
            ventureId,
            status: "active",
          },
        ],
        getDefinition: async () => QUALORA_EVIDENCE_ANALYST_DEFINITION,
        loadVentureName: async () => "Home Venture",
      },
    );

    assert.equal(directory.ok, true);
    if (!directory.ok) {
      return;
    }
    assert.equal(directory.employees.length, 1);
    assert.equal(directory.employees[0]?.id, "instance-home");
    assert.equal(directory.employees[0]?.name, "Qualora Evidence Analyst");
    assert.doesNotMatch(directory.employees[0]?.name ?? "", /CONFIRM|DISMISS|CQC/);
  });

  it("denies directory load without venture.update permission", async () => {
    const denied = await loadWorkforceEmployeeDirectory(
      {
        session: session(memberId),
        activeWorkspaceId: workspaceId,
        ventureId,
      },
      {
        canOperate: async () => false,
        loadVenture: async () => ({ workspaceId }),
      },
    );
    assert.equal(denied.ok, false);
    if (denied.ok) {
      return;
    }
    assert.equal(denied.failure, "UNAUTHORISED");
  });

  it("returns an empty directory when no instances exist in scope", async () => {
    const directory = await loadWorkforceEmployeeDirectory(
      {
        session: session(),
        activeWorkspaceId: workspaceId,
        ventureId,
      },
      {
        canOperate: async () => true,
        loadVenture: async () => ({ workspaceId }),
        listInstances: async () => [],
      },
    );

    assert.equal(directory.ok, true);
    if (!directory.ok) {
      return;
    }
    assert.deepEqual(directory.employees, []);
  });

  it("does not expose write controls in D1 employee directory", () => {
    const forbidden = [
      "createWorkforceRunAction",
      "approveWorkforceRunAction",
      "rejectWorkforceRunAction",
      "activateQualora",
      "CONFIRM",
      "DISMISS",
      "Evidence Pack",
      "vos-btn-primary",
      "delete",
      "revoke",
    ];
    for (const term of forbidden) {
      assert.equal(
        employeeDirectory.includes(term),
        false,
        `${term} must not appear in D1 employee presentation`,
      );
    }
    assert.match(employeeDirectory, /loadWorkforceEmployeeDirectoryAction/);
    assert.match(employeeDirectory, /read-first/i);
    assert.doesNotMatch(employeeDirectory, /from "@\/modules\/qualora/);
  });
});
