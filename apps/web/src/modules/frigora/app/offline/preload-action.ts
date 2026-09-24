"use server";

import { frigoraScope, requireFrigoraOpsContext } from "@/modules/frigora/app/context";
import {
  buildFieldWorkspacePreloadPackage,
  type FieldWorkspacePreloadPackage,
} from "@/modules/frigora/app/offline/preload-build";
import {
  loadMyWork,
  loadVisitRecorder,
  loadWorkOrderDetail,
} from "@/modules/frigora/app/views";

export type BuildFieldWorkspacePreloadResult =
  | { ok: true; package: FieldWorkspacePreloadPackage }
  | { ok: false; error: string };

/**
 * Authenticated online preload builder.
 * Returns a field-safe package for the client to commit into IndexedDB.
 * Does not write IndexedDB (browser-only) and does not mutate server truth.
 */
export async function buildAuthenticatedFieldWorkspacePreload(
  ventureId: string,
): Promise<BuildFieldWorkspacePreloadResult> {
  try {
    const ctx = await requireFrigoraOpsContext(ventureId);
    const scope = frigoraScope(ctx);
    const { rows, error } = await loadMyWork(scope, ctx.sessionUserId);
    if (error) {
      return { ok: false, error };
    }

    const detailsByWorkOrderId: Record<
      string,
      Awaited<ReturnType<typeof loadWorkOrderDetail>>["view"]
    > = {};
    const visitRecordersByWorkOrderId: Record<
      string,
      Awaited<ReturnType<typeof loadVisitRecorder>>["view"]
    > = {};

    for (const row of rows) {
      // Engineers never receive T&M commercial summaries in preload.
      const detail = await loadWorkOrderDetail(scope, row.workOrder.id, {
        includeTimeMaterials: false,
      });
      if (detail.error) {
        return { ok: false, error: detail.error };
      }
      if (
        detail.view &&
        detail.view.workOrder.assignedUserId !== ctx.sessionUserId &&
        !ctx.canWrite
      ) {
        continue;
      }
      detailsByWorkOrderId[row.workOrder.id] = detail.view;

      const visitId = row.activeVisit?.id;
      if (visitId) {
        const recorder = await loadVisitRecorder(
          scope,
          row.workOrder.id,
          visitId,
          ctx.sessionUserId,
          ctx.canWrite,
        );
        if (recorder.error) {
          return { ok: false, error: recorder.error };
        }
        visitRecordersByWorkOrderId[row.workOrder.id] = recorder.view;
      }
    }

    const pkg = buildFieldWorkspacePreloadPackage({
      partition: {
        ventureId: ctx.ventureId,
        actorUserId: ctx.sessionUserId,
      },
      rows,
      detailsByWorkOrderId,
      visitRecordersByWorkOrderId,
      asOf: new Date().toISOString(),
      generation: 1,
    });

    return { ok: true, package: pkg };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Preload failed",
    };
  }
}
