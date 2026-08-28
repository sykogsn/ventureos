import type { VentureId } from "@/contracts";
import type { AgentDefinition } from "@/core/workforce/types";
import {
  listWorkforceInstancesFromSession,
  type WorkforceAgentInstanceView,
  type WorkforceSessionEntryDeps,
  type WorkforceSessionFailure,
  type WorkforceSessionScopeInput,
} from "@/modules/workforce/session-entry";
import { createWorkforceDefinitionRepository } from "@/platform/workforce/definition-repository";
import { getPersistence } from "@/platform/persistence/repositories";

export type WorkforceEmployeeDirectoryEntry = {
  id: string;
  name: string;
  role: string;
  employeeType: "AI employee";
  status: WorkforceAgentInstanceView["status"];
  statusLabel: string;
  statusTone: "healthy" | "quiet" | "risk";
  ventureId: string;
  ventureName: string;
  definitionId: string;
  definitionVersion: string;
  autonomyLabel: string | null;
  capabilitySummary: string | null;
  readinessLabel: string;
  readinessTone: "healthy" | "quiet" | "risk";
};

export type WorkforceEmployeeDirectoryResult =
  | { ok: true; employees: WorkforceEmployeeDirectoryEntry[] }
  | { ok: false; failure: WorkforceSessionFailure };

export type WorkforceEmployeeDirectoryDeps = WorkforceSessionEntryDeps & {
  getDefinition?: (
    definitionId: string,
    definitionVersion: string,
  ) => Promise<AgentDefinition | undefined>;
  loadVentureName?: (ventureId: VentureId) => Promise<string | undefined>;
};

export function deriveEmployeeLabelFromDefinitionId(definitionId: string): string {
  const segment = definitionId.split(".").pop() ?? definitionId;
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function humanizeCapabilityId(capabilityId: string): string {
  const segment = capabilityId.split(".").pop() ?? capabilityId;
  return segment
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function humanizeAutonomyCeiling(
  ceiling: AgentDefinition["autonomyCeiling"] | undefined,
): string | null {
  if (!ceiling) {
    return null;
  }
  return ceiling.charAt(0).toUpperCase() + ceiling.slice(1);
}

export function summariseCapabilities(
  allowList: string[] | undefined,
): string | null {
  if (!allowList?.length) {
    return null;
  }
  const labels = allowList.map(humanizeCapabilityId);
  if (labels.length === 1) {
    return labels[0] ?? null;
  }
  return `${labels[0]} · ${labels.length} capabilities`;
}

export function projectInstanceStatus(
  status: WorkforceAgentInstanceView["status"],
): Pick<WorkforceEmployeeDirectoryEntry, "statusLabel" | "statusTone"> {
  switch (status) {
    case "active":
      return { statusLabel: "Active", statusTone: "healthy" };
    case "disabled":
      return { statusLabel: "Inactive", statusTone: "quiet" };
    case "revoked":
      return { statusLabel: "Revoked", statusTone: "risk" };
  }
}

export function projectReadiness(input: {
  instanceStatus: WorkforceAgentInstanceView["status"];
  definitionLifecycle?: AgentDefinition["lifecycle"];
}): Pick<WorkforceEmployeeDirectoryEntry, "readinessLabel" | "readinessTone"> {
  if (input.instanceStatus === "revoked") {
    return { readinessLabel: "Revoked", readinessTone: "risk" };
  }
  if (input.instanceStatus === "disabled") {
    return { readinessLabel: "Not operating", readinessTone: "quiet" };
  }
  if (input.definitionLifecycle === "ACTIVE") {
    return { readinessLabel: "Ready to operate", readinessTone: "healthy" };
  }
  if (input.definitionLifecycle) {
    const label = input.definitionLifecycle
      .toLowerCase()
      .replace(/^\w/, (char) => char.toUpperCase());
    return { readinessLabel: label, readinessTone: "quiet" };
  }
  return { readinessLabel: "Registered", readinessTone: "quiet" };
}

export function projectWorkforceEmployeeDirectoryEntry(input: {
  instance: WorkforceAgentInstanceView;
  definition?: AgentDefinition;
  ventureName: string;
}): WorkforceEmployeeDirectoryEntry {
  const derivedName = deriveEmployeeLabelFromDefinitionId(input.instance.definitionId);
  const status = projectInstanceStatus(input.instance.status);
  const readiness = projectReadiness({
    instanceStatus: input.instance.status,
    definitionLifecycle: input.definition?.lifecycle,
  });

  return {
    id: input.instance.id,
    name: input.definition?.role ?? derivedName,
    role: derivedName,
    employeeType: "AI employee",
    status: input.instance.status,
    statusLabel: status.statusLabel,
    statusTone: status.statusTone,
    ventureId: input.instance.ventureId,
    ventureName: input.ventureName,
    definitionId: input.instance.definitionId,
    definitionVersion: input.instance.definitionVersion,
    autonomyLabel: humanizeAutonomyCeiling(input.definition?.autonomyCeiling),
    capabilitySummary: summariseCapabilities(input.definition?.capabilityAllowList),
    readinessLabel: readiness.readinessLabel,
    readinessTone: readiness.readinessTone,
  };
}

export async function loadWorkforceEmployeeDirectory(
  input: WorkforceSessionScopeInput,
  deps: WorkforceEmployeeDirectoryDeps = {},
): Promise<WorkforceEmployeeDirectoryResult> {
  const listed = await listWorkforceInstancesFromSession(input, deps);
  if (!listed.ok) {
    return listed;
  }

  const getDefinition =
    deps.getDefinition ??
    ((definitionId: string, definitionVersion: string) =>
      createWorkforceDefinitionRepository().get(
        definitionId as AgentDefinition["id"],
        definitionVersion,
      ));
  const loadVentureName =
    deps.loadVentureName ??
    (async (ventureId: VentureId) => {
      const venture = await getPersistence().ventures.findById(ventureId);
      return venture?.name;
    });

  const ventureNames = new Map<string, string>();
  for (const instance of listed.instances) {
    if (!ventureNames.has(instance.ventureId)) {
      const name = await loadVentureName(instance.ventureId as VentureId);
      ventureNames.set(instance.ventureId, name ?? "Company");
    }
  }

  const employees = await Promise.all(
    listed.instances.map(async (instance) => {
      const definition = await getDefinition(
        instance.definitionId,
        instance.definitionVersion,
      );
      return projectWorkforceEmployeeDirectoryEntry({
        instance,
        definition,
        ventureName: ventureNames.get(instance.ventureId) ?? "Company",
      });
    }),
  );

  return { ok: true, employees };
}
