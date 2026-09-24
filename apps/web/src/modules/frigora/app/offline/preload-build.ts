import { mapToFieldSafeOfflinePayload } from "./field-safe-mapper";
import type {
  FrigoraOfflineFieldSafePayload,
  FrigoraOfflinePartition,
} from "./types";
import type { MyWorkRow, VisitRecorderView, WorkOrderDetailView } from "@/modules/frigora/app/views";

export type FieldSafeWorkspaceDraft = {
  workOrderId: string;
  visitId?: string;
  payload: FrigoraOfflineFieldSafePayload;
};

export type FieldWorkspacePreloadPackage = {
  partition: FrigoraOfflinePartition;
  asOf: string;
  generation: number;
  drafts: FieldSafeWorkspaceDraft[];
};

function asRecord(value: object | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  return { ...value } as Record<string, unknown>;
}

export function buildDraftFromMyWorkRow(
  row: MyWorkRow,
  options?: {
    detail?: WorkOrderDetailView | null;
    visitRecorder?: VisitRecorderView | null;
  },
): FieldSafeWorkspaceDraft {
  const detail = options?.detail;
  const recorder = options?.visitRecorder;
  const visit = recorder?.visit ?? row.activeVisit ?? row.latestVisit;

  const history: unknown[] = [];
  if (recorder) {
    history.push(
      ...recorder.fieldCaptures,
      ...recorder.technicalFindings,
      ...recorder.correctiveActions,
      ...recorder.partUsages,
      ...recorder.refrigerantEvents,
      ...(recorder.visitOutcome ? [recorder.visitOutcome] : []),
      ...recorder.recommendedActions,
      ...recorder.acknowledgements,
      ...recorder.evidence,
      ...recorder.visitOperationalConditions,
    );
  } else if (detail?.visitFacts) {
    for (const facts of detail.visitFacts) {
      history.push(
        facts.visit,
        ...facts.fieldCaptures,
        ...facts.technicalFindings,
        ...facts.correctiveActions,
        ...facts.partUsages,
        ...facts.refrigerantEvents,
        ...(facts.visitOutcome ? [facts.visitOutcome] : []),
        ...facts.recommendedActions,
        ...facts.acknowledgements,
        ...facts.evidence,
        ...facts.operationalConditions,
      );
    }
  }

  const payload = mapToFieldSafeOfflinePayload({
    workOrder: asRecord(detail?.workOrder ?? row.workOrder),
    visit: asRecord(visit),
    customer: asRecord(detail?.customer ?? row.customer),
    site: asRecord(detail?.site ?? row.site),
    asset: asRecord(detail?.asset ?? row.asset),
    history,
    partReferences: (recorder?.activePartReferences ?? []).map(
      (ref) => ({ ...ref }) as Record<string, unknown>,
    ),
    refrigerantReferences: (recorder?.activeRefrigerantReferences ?? []).map(
      (ref) => ({ ...ref }) as Record<string, unknown>,
    ),
  });

  return {
    workOrderId: row.workOrder.id,
    visitId: visit?.id,
    payload,
  };
}

export function buildFieldWorkspacePreloadPackage(input: {
  partition: FrigoraOfflinePartition;
  rows: MyWorkRow[];
  detailsByWorkOrderId: Record<string, WorkOrderDetailView | null | undefined>;
  visitRecordersByWorkOrderId: Record<string, VisitRecorderView | null | undefined>;
  asOf?: string;
  generation?: number;
}): FieldWorkspacePreloadPackage {
  const drafts = input.rows.map((row) =>
    buildDraftFromMyWorkRow(row, {
      detail: input.detailsByWorkOrderId[row.workOrder.id],
      visitRecorder: input.visitRecordersByWorkOrderId[row.workOrder.id],
    }),
  );
  return {
    partition: input.partition,
    asOf: input.asOf ?? new Date().toISOString(),
    generation: input.generation ?? 1,
    drafts,
  };
}
