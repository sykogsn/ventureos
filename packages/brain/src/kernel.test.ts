import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assertKnowledgeCatalogue, assertKnowledgeObject } from "./assert";
import { institutionalKernelCatalogue } from "./fixtures";
import { normaliseRelationshipKind } from "./kind";
import { isDecision, listByType, listDecisions, resolveRelationships } from "./resolve";
import {
  KNOWLEDGE_OBJECT_KERNEL_FIELDS,
  KNOWLEDGE_OBJECT_SECTIONS,
  KNOWLEDGE_TYPES,
  type DecisionKnowledgeObject,
} from "./types";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relative: string) {
  return readFileSync(join(packageRoot, relative), "utf8");
}

describe("Knowledge Object kernel", () => {
  it("uses one kernel for every institutional type", () => {
    assertKnowledgeCatalogue(institutionalKernelCatalogue);
    for (const type of KNOWLEDGE_TYPES) {
      assert.ok(listByType(type, institutionalKernelCatalogue).length >= 1, type);
    }
  });

  it("keeps the locked layout sections stable", () => {
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

  it("names the representation invariant fields", () => {
    assert.ok(KNOWLEDGE_OBJECT_KERNEL_FIELDS.includes("plane"));
    assert.ok(KNOWLEDGE_OBJECT_KERNEL_FIELDS.includes("scopes"));
    const creed = institutionalKernelCatalogue.find((item) => item.id === "creed");
    assert.ok(creed);
    for (const field of KNOWLEDGE_OBJECT_KERNEL_FIELDS) {
      assert.ok(field in creed, field);
    }
  });

  it("treats Decision as the same object type with a payload", () => {
    const decisions = listDecisions(institutionalKernelCatalogue);
    assert.equal(decisions.length, 1);
    assert.ok(decisions.every(isDecision));
    assert.equal(decisions[0]?.impact, "Platform");
    assert.ok(decisions[0]?.alternatives.length);
    assert.ok(decisions[0]?.issuedAt);
  });

  it("defaults institutional objects to the institutional plane", () => {
    assert.ok(
      institutionalKernelCatalogue
        .filter((item) => item.type !== "Decision")
        .every((item) => item.plane === "institutional"),
    );
  });

  it("allows Decision on the operating plane without a second type", () => {
    const [decision] = listDecisions(institutionalKernelCatalogue);
    assert.ok(decision);
    const operating: DecisionKnowledgeObject = { ...decision, plane: "operating" };
    assertKnowledgeObject(operating);
    assert.equal(operating.type, "Decision");
  });

  it("rejects a non-Decision institutional type on the operating plane", () => {
    const creed = institutionalKernelCatalogue.find((item) => item.id === "creed");
    assert.ok(creed);
    assert.throws(
      () => assertKnowledgeObject({ ...creed, plane: "operating" }),
      /cannot use the operating plane/,
    );
  });

  it("resolves relationships by id without walking a graph", () => {
    const runtime = institutionalKernelCatalogue.find((item) => item.id === "runtime");
    assert.ok(runtime);
    const related = resolveRelationships(runtime, institutionalKernelCatalogue);
    assert.ok(related.every((item) => item.object !== null));
    assert.ok(related.some((item) => item.objectId === "adr-001"));
    assert.equal(related.find((item) => item.objectId === "adr-001")?.kind, undefined);
  });

  it("accepts a typed relationship and rejects an unknown kind", () => {
    assert.equal(normaliseRelationshipKind("replaces"), "supersedes");
    assert.throws(() => normaliseRelationshipKind("owned_by"), /owned_by is not stored/);
    assert.throws(() => normaliseRelationshipKind("etc"), /Unknown relationship kind/);
  });

  it("fails when a relationship id is missing", () => {
    const [first, ...rest] = institutionalKernelCatalogue;
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

  it("fails when an institutional type is missing from the catalogue", () => {
    assert.throws(
      () =>
        assertKnowledgeCatalogue(
          institutionalKernelCatalogue.filter((item) => item.type !== "Playbook"),
        ),
      /no Knowledge Object of type Playbook/,
    );
  });

  it("does not implement operating types, traversal, or Runtime", () => {
    const source = ["src/types.ts", "src/assert.ts", "src/resolve.ts", "src/kind.ts", "src/index.ts"]
      .map(readSource)
      .join("\n");
    assert.doesNotMatch(source, /"Company"|"Person"|"Procedure"|"Customer"/);
    assert.doesNotMatch(source, /ReasonQuery|depth|runExecutiveIntelligenceRuntime/);
    assert.doesNotMatch(source, /from ["']@\/core\/runtime|from ["']@\/core\/venture/);
  });
});
