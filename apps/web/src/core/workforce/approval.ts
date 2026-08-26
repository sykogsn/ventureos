import type { Permission } from "@/contracts";
import type {
  HumanWorkforceActor,
  WorkforceActor,
} from "./types";
import { isHumanActor } from "./actor";

export const WORKFORCE_APPROVAL_PERMISSION: Permission = "venture.update";

export type ApprovalAuthorisation =
  | { ok: true; actor: HumanWorkforceActor }
  | { ok: false; reason: "UNAUTHENTICATED" | "AGENT_CANNOT_APPROVE" | "NOT_HUMAN" };

/**
 * Human approval records consent. It is not authority and does not
 * grant execution. Agents cannot approve themselves or any run.
 */
export function authoriseApprover(actor: WorkforceActor | undefined): ApprovalAuthorisation {
  if (!actor) {
    return { ok: false, reason: "UNAUTHENTICATED" };
  }
  if (actor.kind === "agent") {
    return { ok: false, reason: "AGENT_CANNOT_APPROVE" };
  }
  if (!isHumanActor(actor)) {
    return { ok: false, reason: "NOT_HUMAN" };
  }
  return { ok: true, actor };
}
