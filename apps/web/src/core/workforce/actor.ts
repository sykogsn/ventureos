import type { Actor } from "@/contracts";
import type {
  AgentWorkforceActor,
  HumanWorkforceActor,
  SystemWorkforceActor,
} from "./types";

export function toHumanWorkforceActor(actor: Actor): HumanWorkforceActor {
  return {
    kind: "human",
    userId: actor.userId,
    workspaceId: actor.workspaceId,
    ventureId: actor.ventureId,
  };
}

export function isHumanActor(value: unknown): value is HumanWorkforceActor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.kind === "human" && typeof record.userId === "string";
}

export function isAgentActor(value: unknown): value is AgentWorkforceActor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.kind === "agent" && typeof record.agentInstanceId === "string"
  );
}

export function isSystemActor(value: unknown): value is SystemWorkforceActor {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.kind === "system" && typeof record.component === "string";
}