/**
 * Frigora Visit Evidence byte retrieval — domain-protected read policy (RPV-002).
 *
 * Ordinary StoredObjects keep workspace/venture.read open semantics.
 * Objects bound to frigora_visit_evidence (or frigora assigned_work_order
 * create-authority without a link row yet) require Owner/Admin (venture.update),
 * current WorkOrder assignee, or the Visit attendee.
 *
 * Prefer canonical frigora_visit_evidence rows over UI or caller-supplied params.
 */
import { and, eq } from "drizzle-orm";
import type { PermissionService, StoredObjectId, UserId, VentureId, WorkspaceId } from "@/contracts";
import { getDb } from "@/platform/persistence/db";
import {
  frigoraVisitEvidence,
  frigoraVisits,
  frigoraWorkOrders,
} from "@/platform/persistence/schema";
import type { AuditLog } from "@/platform/audit/log";
import { findStoredObjectIssuedAuthority } from "./domain-authority";

export type ProtectedByteReadVerdict = "not_protected" | "allow" | "deny";

export async function evaluateFrigoraVisitEvidenceByteRead(input: {
  actorUserId: UserId;
  workspaceId: WorkspaceId;
  ventureId: VentureId | null;
  objectId: StoredObjectId;
  permissions: PermissionService;
  audit: AuditLog;
}): Promise<ProtectedByteReadVerdict> {
  if (!input.ventureId) {
    return "not_protected";
  }

  const db = getDb();
  const evidenceRows = await db
    .select()
    .from(frigoraVisitEvidence)
    .where(
      and(
        eq(frigoraVisitEvidence.workspaceId, input.workspaceId),
        eq(frigoraVisitEvidence.ventureId, input.ventureId),
        eq(frigoraVisitEvidence.storedObjectId, input.objectId),
      ),
    )
    .limit(1);

  const evidence = evidenceRows[0];
  if (evidence) {
    const hasHigherAuthority = await input.permissions.can({
      userId: input.actorUserId,
      permission: "venture.update",
      resource: { type: "workspace", id: input.workspaceId },
    });
    if (hasHigherAuthority) {
      return "allow";
    }

    const workOrders = await db
      .select()
      .from(frigoraWorkOrders)
      .where(
        and(
          eq(frigoraWorkOrders.workspaceId, input.workspaceId),
          eq(frigoraWorkOrders.ventureId, input.ventureId),
          eq(frigoraWorkOrders.id, evidence.workOrderId),
        ),
      )
      .limit(1);
    const workOrder = workOrders[0];
    if (workOrder?.assignedUserId === input.actorUserId) {
      return "allow";
    }

    const visits = await db
      .select()
      .from(frigoraVisits)
      .where(
        and(
          eq(frigoraVisits.workspaceId, input.workspaceId),
          eq(frigoraVisits.ventureId, input.ventureId),
          eq(frigoraVisits.id, evidence.visitId),
        ),
      )
      .limit(1);
    const visit = visits[0];
    if (visit?.attendingUserId === input.actorUserId) {
      return "allow";
    }

    return "deny";
  }

  // Domain-authorized Frigora blob not yet (or no longer) linked to evidence:
  // still protect by WorkOrder assignment / higher authority; no attendee path.
  const authority = await findStoredObjectIssuedAuthority(input.audit, input.objectId);
  if (
    authority &&
    authority.domain === "frigora" &&
    authority.relation === "assigned_work_order"
  ) {
    const hasHigherAuthority = await input.permissions.can({
      userId: input.actorUserId,
      permission: "venture.update",
      resource: { type: "workspace", id: input.workspaceId },
    });
    if (hasHigherAuthority) {
      return "allow";
    }

    const workOrders = await db
      .select()
      .from(frigoraWorkOrders)
      .where(
        and(
          eq(frigoraWorkOrders.workspaceId, input.workspaceId),
          eq(frigoraWorkOrders.ventureId, input.ventureId),
          eq(frigoraWorkOrders.id, authority.resourceId),
        ),
      )
      .limit(1);
    if (workOrders[0]?.assignedUserId === input.actorUserId) {
      return "allow";
    }
    return "deny";
  }

  return "not_protected";
}
