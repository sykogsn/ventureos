import type { VentureId, WorkspaceId } from "@/contracts";
import type { VentureScopePort } from "@/core/workforce/authority";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence } from "@/platform/persistence/repositories";

/**
 * Production VentureScopePort. Reads workspace existence and the instance
 * operating lifecycle on `ventures.lifecycle`.
 *
 * Does not read marketing `stage` (Idea/Seed/Launch).
 * Does not read Venture Definition Framework catalogue lifecycle.
 */
export function createVentureScopePort(): VentureScopePort {
  return {
    async lookup(workspaceId, ventureId) {
      try {
        await ensureSchema();
        const store = getPersistence();
        const workspace = await store.organisations.findById(
          workspaceId as WorkspaceId,
        );
        const venture = await store.ventures.findById(ventureId as VentureId);
        return {
          ok: true,
          value: {
            workspaceFound: Boolean(workspace),
            venture: venture
              ? {
                  workspaceId: venture.workspaceId,
                  lifecycle: venture.lifecycle,
                }
              : null,
          },
        };
      } catch {
        return { ok: false };
      }
    },
  };
}
