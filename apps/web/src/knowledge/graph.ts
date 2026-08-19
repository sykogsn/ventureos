import { createId } from "@/platform/ids";
import type {
  EntityId,
  KnowledgeEntity,
  KnowledgeRelation,
  ReasonQuery,
  ReasonResult,
} from "./types";

export type KnowledgeGraph = {
  upsertEntity(entity: KnowledgeEntity): void;
  upsertRelation(relation: Omit<KnowledgeRelation, "id"> & { id?: string }): void;
  getEntity(id: EntityId): KnowledgeEntity | undefined;
  neighbors(query: ReasonQuery): ReasonResult;
};

export function createKnowledgeGraph(): KnowledgeGraph {
  const entities = new Map<EntityId, KnowledgeEntity>();
  const relations: KnowledgeRelation[] = [];

  return {
    upsertEntity(entity) {
      entities.set(entity.id, entity);
    },
    upsertRelation(relation) {
      const next: KnowledgeRelation = {
        id: relation.id ?? createId(),
        kind: relation.kind,
        fromId: relation.fromId,
        toId: relation.toId,
      };
      const existing = relations.findIndex(
        (item) =>
          item.kind === next.kind &&
          item.fromId === next.fromId &&
          item.toId === next.toId,
      );
      if (existing >= 0) {
        relations[existing] = next;
        return;
      }
      relations.push(next);
    },
    getEntity(id) {
      return entities.get(id);
    },
    neighbors(query) {
      const depth = query.depth ?? 1;
      const seen = new Set<EntityId>([query.fromId]);
      const collectedRelations: KnowledgeRelation[] = [];
      let frontier: EntityId[] = [query.fromId];

      for (let level = 0; level < depth; level += 1) {
        const nextFrontier: EntityId[] = [];

        for (const id of frontier) {
          for (const relation of relations) {
            if (query.relation && relation.kind !== query.relation) {
              continue;
            }
            if (relation.fromId !== id && relation.toId !== id) {
              continue;
            }
            collectedRelations.push(relation);
            const other = relation.fromId === id ? relation.toId : relation.fromId;
            if (!seen.has(other)) {
              seen.add(other);
              nextFrontier.push(other);
            }
          }
        }

        frontier = nextFrontier;
      }

      return {
        entities: [...seen]
          .map((id) => entities.get(id))
          .filter((entity): entity is KnowledgeEntity => Boolean(entity)),
        relations: collectedRelations,
      };
    },
  };
}
