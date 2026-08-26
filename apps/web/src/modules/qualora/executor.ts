import type { VentureId } from "@/contracts";
import type { WorkforceRunId } from "@/contracts/ids";
import type { WorkforceRunRecord } from "@/core/workforce/run";
import type {
  CapabilityExecutor,
  ExecutionOutcome,
  ExecutorInvocation,
} from "@/core/workforce/types";
import { createAuditLog } from "@/platform/audit/log";
import { getPersistence } from "@/platform/persistence/repositories";
import { createWorkforceRunStore } from "@/platform/workforce/run-store";
import {
  canonicalizeCitedEvidenceIds,
  qualoraEvidenceAssessmentArgumentSchema,
} from "./arguments";
import {
  createQualoraEvidenceAssessmentStore,
  type QualoraEvidenceAssessmentStore,
} from "./store";
import {
  QUALORA_AUDIT_RECORDED,
  QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID,
  QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
  QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION,
  QUALORA_REQUIREMENT_SOURCE_TYPE,
  QUALORA_VENTURE_DEFINITION_ID,
  type QualoraGapKind,
} from "./types";

const argumentSchema = qualoraEvidenceAssessmentArgumentSchema;

export type QualoraExecutorDeps = {
  store?: QualoraEvidenceAssessmentStore;
  loadRun?: (id: string) => Promise<WorkforceRunRecord | undefined>;
  loadVentureDefinitionId?: (ventureId: string) => Promise<string | undefined>;
  audit?: {
    record(entry: {
      action: string;
      actor?: ExecutorInvocation["actor"];
      metadata?: Record<string, string>;
    }): Promise<unknown>;
  };
};

export function createQualoraEvidenceAssessmentExecutor(
  deps: QualoraExecutorDeps = {},
): CapabilityExecutor {
  const store = deps.store ?? createQualoraEvidenceAssessmentStore();
  const runs = createWorkforceRunStore();
  const loadRun = deps.loadRun ?? ((id: string) => runs.get(id as WorkforceRunId));
  const loadVentureDefinitionId =
    deps.loadVentureDefinitionId ??
    (async (ventureId: string) => {
      const venture = await getPersistence().ventures.findById(
        ventureId as VentureId,
      );
      return venture?.definitionId;
    });

  return {
    id: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    parseArguments(value) {
      const parsed = argumentSchema.safeParse(value);
      if (!parsed.success) {
        return { ok: false };
      }
      const cited = canonicalizeCitedEvidenceIds(parsed.data.citedEvidenceIds);
      if (!cited) {
        return { ok: false };
      }
      return {
        ok: true,
        value: {
          requirementId: parsed.data.requirementId,
          gapKind: parsed.data.gapKind,
          summary: parsed.data.summary,
          citedEvidenceIds: cited.join(","),
        },
      };
    },
    async execute(request: ExecutorInvocation): Promise<ExecutionOutcome> {
      const failed = fail();
      if (request.capabilityId !== QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID) {
        return failed;
      }
      if (!request.sourceRequestId.trim() || !request.externalIdempotencyKey.trim()) {
        return failed;
      }

      const parsed = argumentSchema.safeParse(request.arguments);
      if (!parsed.success) {
        return failed;
      }
      const cited = canonicalizeCitedEvidenceIds(parsed.data.citedEvidenceIds);
      if (!cited) {
        return failed;
      }

      const definitionId = await loadVentureDefinitionId(request.ventureId);
      if (definitionId !== QUALORA_VENTURE_DEFINITION_ID) {
        return failed;
      }

      const run = await loadRun(request.sourceRequestId);
      if (
        !run ||
        run.workspaceId !== request.workspaceId ||
        run.ventureId !== request.ventureId ||
        run.id !== request.sourceRequestId
      ) {
        return failed;
      }

      const requirementOk = run.citations.some(
        (citation) =>
          citation.sourceType === QUALORA_REQUIREMENT_SOURCE_TYPE &&
          citation.sourceId === parsed.data.requirementId,
      );
      if (!requirementOk) {
        return failed;
      }

      const suppliedIds = new Set(run.evidence.map((item) => item.id));
      if (cited.some((id) => !suppliedIds.has(id))) {
        return failed;
      }

      const written = await store.insert({
        workspaceId: request.workspaceId,
        ventureId: request.ventureId,
        requirementId: parsed.data.requirementId,
        sourceRunId: run.id,
        sourceAgentInstanceId: request.agentInstanceId,
        executionIdempotencyKey: request.externalIdempotencyKey,
        gapKind: parsed.data.gapKind as QualoraGapKind,
        summary: parsed.data.summary,
        citedEvidenceIds: cited,
      });
      if (written.kind === "conflict") {
        return failed;
      }

      const audit = deps.audit ?? createAuditLog();
      await audit.record({
        action: QUALORA_AUDIT_RECORDED,
        actor: request.actor,
        metadata: {
          workspaceId: request.workspaceId,
          ventureId: request.ventureId,
          assessmentId: written.record.id,
          requirementId: written.record.requirementId,
          gapKind: written.record.gapKind,
          sourceRunId: written.record.sourceRunId,
          citedEvidenceIds: written.record.citedEvidenceIds.join(","),
          status: written.record.status,
          provenance: written.record.provenance,
        },
      });

      return {
        executorId: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
        ok: true,
        output: { assessmentId: written.record.id },
        receipt: {
          implementationId: QUALORA_EVIDENCE_ASSESSMENT_BINDING_ID,
          implementationVersion: QUALORA_EVIDENCE_ASSESSMENT_IMPLEMENTATION_VERSION,
          externalReference: written.record.id,
          occurredAt: written.record.createdAt,
        },
      };
    },
  };
}

function fail(): ExecutionOutcome {
  return {
    executorId: QUALORA_EVIDENCE_ASSESSMENT_CAPABILITY_ID,
    ok: false,
    error: "EXECUTION_FAILED",
  };
}
