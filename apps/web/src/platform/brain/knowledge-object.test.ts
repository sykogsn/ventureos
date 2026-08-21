import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { knowledgeObjects } from "./catalogue";
import {
  assertKnowledgeCatalogue,
  isDecision,
  listByType,
  listDecisions,
  listGovernance,
  resolveRelationships,
} from "./knowledge-object";
import { KNOWLEDGE_OBJECT_SECTIONS, KNOWLEDGE_TYPES } from "./types";

describe("Knowledge Object model", () => {
  it("uses one record shape for every knowledge type", () => {
    assertKnowledgeCatalogue(knowledgeObjects);
    for (const type of KNOWLEDGE_TYPES) {
      assert.ok(listByType(type, knowledgeObjects).length >= 1, type);
    }
  });

  it("keeps the canonical layout sections stable", () => {
    assert.deepEqual(KNOWLEDGE_OBJECT_SECTIONS, [
      "title",
      "summary",
      "purpose",
      "why",
      "evidence",
      "relationships",
      "history",
      "owner",
      "status",
      "reviewDate",
      "aiContext",
    ]);
  });

  it("treats decisions as Knowledge Objects, not a parallel store", () => {
    const decisions = listDecisions(knowledgeObjects);
    assert.equal(decisions.length, 6);
    assert.ok(decisions.every(isDecision));
    assert.ok(knowledgeObjects.some((item) => item.id === "adr-001" && item.type === "Decision"));
  });

  it("derives governance cards from Knowledge Objects", () => {
    const cards = listGovernance(knowledgeObjects);
    assert.equal(cards.length, 7);
    assert.equal(cards[0]?.id, "creed");
    assert.equal(cards[0]?.title, "Constitution");
    assert.equal(cards[0]?.href, "/brain/library/creed");
  });

  it("resolves relationships to catalogue records", () => {
    const runtime = knowledgeObjects.find((item) => item.id === "runtime");
    assert.ok(runtime);
    const related = resolveRelationships(runtime, knowledgeObjects);
    assert.ok(related.every((item) => item.object !== null));
    assert.ok(related.some((item) => item.objectId === "adr-001"));
  });

  it("fails when a relationship id is missing", () => {
    const [first, ...rest] = knowledgeObjects;
    assert.ok(first);
    assert.throws(
      () =>
        assertKnowledgeCatalogue([
          { ...first, relationships: [{ objectId: "does-not-exist" }] },
          ...rest,
        ]),
      /Broken relationship/,
    );
  });
});
