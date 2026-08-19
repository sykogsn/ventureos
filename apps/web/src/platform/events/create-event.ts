import { createId, nowIso } from "@/platform/ids";
import type { DomainEvent, EventId } from "@/contracts";

export function createEvent<TPayload>(
  type: string,
  payload: TPayload,
  context?: Omit<DomainEvent<TPayload>, "id" | "type" | "occurredAt" | "payload">,
): DomainEvent<TPayload> {
  return {
    id: createId<EventId>(),
    type,
    occurredAt: nowIso(),
    payload,
    ...context,
  };
}
