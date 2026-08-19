import type { DomainEvent, EventBus, EventHandler } from "@/contracts";

export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<EventHandler>>();

  return {
    async publish(event) {
      const typed = handlers.get(event.type);
      const wildcard = handlers.get("*");
      const list = [...(typed ?? []), ...(wildcard ?? [])];

      for (const handler of list) {
        await handler(event as DomainEvent);
      }
    },
    subscribe(type, handler) {
      const set = handlers.get(type) ?? new Set();
      set.add(handler as EventHandler);
      handlers.set(type, set);

      return () => {
        set.delete(handler as EventHandler);
      };
    },
  };
}
