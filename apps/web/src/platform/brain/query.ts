import { knowledgeObjects, suggestedSearches } from "./catalogue";
import { isDecision, knowledgeObjectHref, listDecisions } from "./knowledge-object";
import type {
  BrainSearchHit,
  BrainVentureScope,
  DecisionKnowledgeObject,
  KnowledgeObject,
  KnowledgeStatus,
  KnowledgeType,
} from "./types";
import { BRAIN_VENTURE_SCOPES, KNOWLEDGE_STATUSES, KNOWLEDGE_TYPES } from "./types";

export type KnowledgeFilter = {
  type?: string;
  owner?: string;
  status?: string;
  venture?: string;
  q?: string;
};

function asString(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseSearchQuery(value: string | string[] | undefined) {
  return asString(value);
}

export function parseKnowledgeFilter(input: {
  type?: string | string[];
  owner?: string | string[];
  status?: string | string[];
  venture?: string | string[];
  q?: string | string[];
}): KnowledgeFilter {
  const type = asString(input.type);
  const status = asString(input.status);
  const venture = asString(input.venture);
  return {
    type: (KNOWLEDGE_TYPES as readonly string[]).includes(type) ? type : "",
    owner: asString(input.owner),
    status: (KNOWLEDGE_STATUSES as readonly string[]).includes(status) ? status : "",
    venture: (BRAIN_VENTURE_SCOPES as readonly string[]).includes(venture) ? venture : "",
    q: asString(input.q),
  };
}

export function listOwners(records: KnowledgeObject[] = knowledgeObjects) {
  return [...new Set(records.map((item) => item.owner))].sort();
}

export function filterKnowledge(
  filter: KnowledgeFilter,
  records: KnowledgeObject[] = knowledgeObjects,
): KnowledgeObject[] {
  const query = filter.q?.toLowerCase() ?? "";
  return records.filter((item) => {
    if (filter.type && item.type !== (filter.type as KnowledgeType)) {
      return false;
    }
    if (filter.owner && item.owner !== filter.owner) {
      return false;
    }
    if (filter.status && item.status !== (filter.status as KnowledgeStatus)) {
      return false;
    }
    if (filter.venture && !item.scopes.includes(filter.venture as BrainVentureScope)) {
      return false;
    }
    if (!query) {
      return true;
    }
    const haystack = [item.title, item.summary, item.purpose, item.why, item.type, item.owner, ...item.evidence]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function getKnowledgeObject(id: string) {
  return knowledgeObjects.find((item) => item.id === id) ?? null;
}

export function getDecision(id: string): DecisionKnowledgeObject | null {
  const object = getKnowledgeObject(id);
  return object && isDecision(object) ? object : null;
}

export function filterDecisions(q: string, records: KnowledgeObject[] = knowledgeObjects) {
  return listDecisions(filterKnowledge({ type: "Decision", q }, records));
}

function toHit(item: KnowledgeObject): BrainSearchHit {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary,
    href: knowledgeObjectHref(item.id),
  };
}

export function searchBrain(q: string): BrainSearchHit[] {
  const query = q.trim().toLowerCase();
  if (!query) {
    return [];
  }

  return knowledgeObjects.flatMap((item) => {
    const haystack = [item.title, item.summary, item.purpose, item.why, item.aiContext, ...item.evidence]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query) ? [toHit(item)] : [];
  });
}

export function previewCatalogue(limit = 6): BrainSearchHit[] {
  return knowledgeObjects.slice(0, limit).map(toHit);
}

export function brainSuggestions() {
  return suggestedSearches;
}
