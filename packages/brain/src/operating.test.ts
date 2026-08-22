import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { assertKnowledgeCatalogue, assertKnowledgeObject, assertOperatingCatalogue } from "./assert";
import { institutionalKernelCatalogue } from "./fixtures";
import { operatingKernelCatalogue } from "./operating-fixtures";
import { isOperatingKnowledgeObject } from "./operating";
import { isDecision, listByType } from "./resolve";
import {
  OPERATING_KNOWLEDGE_TYPES,
  isOperatingKnowledgeType,
  type CompanyKnowledgeObject,
} from "./types";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Operating Knowledge Types", () => {
  it("keeps institutional and operating types as one object family", () => {
    assertKnowledgeCatalogue(institutionalKernelCatalogue);
    assertOperatingCatalogue(operatingKernelCatalogue);
    for (const type of OPERATING_KNOWLEDGE_TYPES) {
      assert.ok(isOperatingKnowledgeType(type), type);
      assert.ok(listByType(type, operatingKernelCatalogue).length >= 1, type);
    }
    assert.ok(!isOperatingKnowledgeType("Decision"));
    assert.ok(!isOperatingKnowledgeType("Constitution"));
  });

  it("requires operating types to use the operating plane", () => {
    const company = operatingKernelCatalogue.find((item) => item.type === "Company");
    assert.ok(company);
    assert.equal(company.plane, "operating");
    assert.throws(
      () => assertKnowledgeObject({ ...company, plane: "institutional" }),
      /must use the operating plane/,
    );
  });

  it("keeps Decision as one type on the operating plane", () => {
    const decision = operatingKernelCatalogue.find((item) => item.id === "decision-capacity");
    assert.ok(decision);
    assert.ok(isDecision(decision));
    assert.equal(decision.plane, "operating");
    assert.equal(decision.type, "Decision");
    assert.ok(!isOperatingKnowledgeObject(decision));
  });

  it("correlates Company, Decision, and Risk ids without writing VIC", () => {
    const company = operatingKernelCatalogue.find((item) => item.type === "Company");
    const risk = operatingKernelCatalogue.find((item) => item.type === "Risk");
    const decision = operatingKernelCatalogue.find(isDecision);
    assert.ok(company);
    assert.ok(risk);
    assert.ok(decision);
    assert.equal(company.id, "north-star");
    assert.equal(risk.id, "risk-capacity");
    assert.equal(decision.id, "decision-capacity");
  });

  it("validates operating payloads and rejects an empty Company name", () => {
    const company = operatingKernelCatalogue.find(
      (item): item is CompanyKnowledgeObject => item.type === "Company",
    );
    assert.ok(company);
    assert.throws(
      () => assertKnowledgeObject({ ...company, legalName: "   " }),
      /missing legalName/,
    );
  });

  it("treats Procedure as knowledge steps, not a workflow runner", () => {
    const procedure = operatingKernelCatalogue.find((item) => item.type === "Procedure");
    assert.ok(procedure && procedure.type === "Procedure");
    assert.ok(procedure.steps.length >= 1);
    assert.throws(
      () => assertKnowledgeObject({ ...procedure, steps: [] }),
      /has no steps/,
    );
  });

  it("treats Document as meaning, not a file store", () => {
    const document = operatingKernelCatalogue.find((item) => item.type === "Document");
    assert.ok(document && document.type === "Document");
    assert.equal(document.documentStatus, "live");
    assert.ok(!("path" in document));
    assert.ok(!("bytes" in document));
    assert.throws(
      () => assertKnowledgeObject({ ...document, documentStatus: "archived" as "live" }),
      /unknown document status/,
    );
  });

  it("rejects an institutional object inside an operating catalogue", () => {
    const creed = institutionalKernelCatalogue.find((item) => item.id === "creed");
    assert.ok(creed);
    assert.throws(
      () => assertOperatingCatalogue([...operatingKernelCatalogue, creed]),
      /Operating catalogue cannot include/,
    );
  });

  it("does not import Runtime, VIC, or walk a graph", () => {
    const source = ["src/operating.ts", "src/operating-fixtures.ts", "src/types.ts"]
      .map((file) => readFileSync(join(packageRoot, file), "utf8"))
      .join("\n");
    assert.doesNotMatch(source, /ReasonQuery|runExecutiveIntelligenceRuntime/);
    assert.doesNotMatch(source, /from ["']@\/core\/runtime|from ["']@\/core\/venture/);
    assert.doesNotMatch(source, /IntelligentDocument/);
  });
});
