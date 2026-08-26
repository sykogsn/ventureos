import type { VentureId, WorkspaceId } from "@/contracts";
import type { AgentInstanceId } from "@/contracts/ids";
import type { HumanWorkforceActor } from "@/core/workforce/types";
import { getWorkforceService } from "@/modules/workforce/service";
import { QUALORA_EVIDENCE_ANALYST_OBJECTIVE } from "./fixtures";
import { qualoraEvidencePack, type QualoraEvidencePackKind } from "./request";

export async function createQualoraEvidenceAnalystRun(input: {
  actor: HumanWorkforceActor;
  agentInstanceId: AgentInstanceId;
  workspaceId: WorkspaceId;
  ventureId: VentureId;
  pack: QualoraEvidencePackKind;
}) {
  const pack = qualoraEvidencePack(input.pack);
  return getWorkforceService().createRun({
    actor: input.actor,
    agentInstanceId: input.agentInstanceId,
    workspaceId: input.workspaceId,
    ventureId: input.ventureId,
    objective: QUALORA_EVIDENCE_ANALYST_OBJECTIVE,
    evidence: pack.evidence,
    citations: pack.citations,
  });
}
