import type { VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId } from "@/contracts/ids";
import { createId } from "@/platform/ids";
import { eq } from "drizzle-orm";
import { ensureSchema, getDb } from "@/platform/persistence/db";
import { getPersistence } from "@/platform/persistence/repositories";
import { agentInstances as instanceTable } from "@/platform/persistence/schema";
import { createWorkforceDefinitionRepository } from "@/platform/workforce/definition-repository";
import { createWorkforceInstanceRepository } from "@/platform/workforce/instance-repository";
import { QUALORA_EVIDENCE_ANALYST_DEFINITION } from "./definition";
import {
  QUALORA_EVIDENCE_ANALYST_DEFINITION_ID,
  QUALORA_VENTURE_DEFINITION_ID,
} from "./types";

export type QualoraActivationFailure =
  | "VENTURE_MISSING"
  | "VENTURE_NOT_QUALORA"
  | "WORKSPACE_MISMATCH";

export type QualoraActivationResult =
  | { ok: true; instanceId: AgentInstanceId; reused?: true }
  | { ok: false; failure: QualoraActivationFailure };

/**
 * Explicit activation only. Production binding availability does not
 * create an Evidence Analyst. Launching a Qualora Venture does not
 * create one either.
 */
export async function activateQualoraEvidenceAnalyst(input: {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
}): Promise<QualoraActivationResult> {
  const venture = await getPersistence().ventures.findById(input.ventureId);
  if (!venture) {
    return { ok: false, failure: "VENTURE_MISSING" };
  }
  if (venture.workspaceId !== input.workspaceId) {
    return { ok: false, failure: "WORKSPACE_MISMATCH" };
  }
  if (venture.definitionId !== QUALORA_VENTURE_DEFINITION_ID) {
    return { ok: false, failure: "VENTURE_NOT_QUALORA" };
  }

  const definitions = createWorkforceDefinitionRepository();
  const instances = createWorkforceInstanceRepository();
  await definitions.publish(QUALORA_EVIDENCE_ANALYST_DEFINITION);

  const existing = await findActiveInstance(input);
  if (existing) {
    return { ok: true, instanceId: existing, reused: true };
  }

  const instanceId = createId<AgentInstanceId>();
  await instances.insert({
    id: instanceId,
    definitionId: QUALORA_EVIDENCE_ANALYST_DEFINITION.id,
    definitionVersion: QUALORA_EVIDENCE_ANALYST_DEFINITION.version,
    workspaceId: input.workspaceId,
    ventureId: input.ventureId,
    status: "active",
  });
  return { ok: true, instanceId };
}

async function findActiveInstance(input: {
  workspaceId: WorkspaceId;
  ventureId: VentureId;
}): Promise<AgentInstanceId | undefined> {
  await ensureSchema();
  const rows = await getDb()
    .select()
    .from(instanceTable)
    .where(eq(instanceTable.ventureId, input.ventureId));
  const match = rows.find(
    (row) =>
      row.workspaceId === input.workspaceId &&
      row.definitionId === QUALORA_EVIDENCE_ANALYST_DEFINITION_ID &&
      row.status === "active",
  );
  return match ? (match.id as AgentInstanceId) : undefined;
}
