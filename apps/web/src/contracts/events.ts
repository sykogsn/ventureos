import type { EventId, UserId, VentureId, WorkspaceId } from "./ids";

export type DomainEvent<TPayload = unknown> = {
  id: EventId;
  type: string;
  occurredAt: string;
  actorId?: UserId;
  workspaceId?: WorkspaceId;
  ventureId?: VentureId;
  payload: TPayload;
};

export type EventHandler<TPayload = unknown> = (
  event: DomainEvent<TPayload>,
) => void | Promise<void>;

export type EventBus = {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(
    type: string,
    handler: EventHandler<TPayload>,
  ): () => void;
};
