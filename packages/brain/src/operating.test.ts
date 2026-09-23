import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertKnowledgeCatalogue,
  assertKnowledgeObject,
  assertOperatingCatalogue,
} from "./assert";
import { institutionalKernelCatalogue } from "./fixtures";
import { operatingKernelCatalogue } from "./operating-fixtures";
import {
  assertOperatingPayload,
  isOperatingKnowledgeObject,
} from "./operating";
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
    const company = operatingKernelCatalogue.find(
      (item) => item.type === "Company",
    );
    assert.ok(company);
    assert.equal(company.plane, "operating");
    assert.throws(
      () => assertKnowledgeObject({ ...company, plane: "institutional" }),
      /must use the operating plane/,
    );
  });

  it("keeps Decision as one type on the operating plane", () => {
    const decision = operatingKernelCatalogue.find(
      (item) => item.id === "decision-capacity",
    );
    assert.ok(decision);
    assert.ok(isDecision(decision));
    assert.equal(decision.plane, "operating");
    assert.equal(decision.type, "Decision");
    assert.ok(!isOperatingKnowledgeObject(decision));
  });

  it("correlates Company, Decision, and Risk ids without writing VIC", () => {
    const company = operatingKernelCatalogue.find(
      (item) => item.type === "Company",
    );
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
    const procedure = operatingKernelCatalogue.find(
      (item) => item.type === "Procedure",
    );
    assert.ok(procedure && procedure.type === "Procedure");
    assert.ok(procedure.steps.length >= 1);
    assert.throws(
      () => assertKnowledgeObject({ ...procedure, steps: [] }),
      /has no steps/,
    );
  });

  it("treats Document as meaning, not a file store", () => {
    const document = operatingKernelCatalogue.find(
      (item) => item.type === "Document",
    );
    assert.ok(document && document.type === "Document");
    assert.equal(document.documentStatus, "live");
    assert.ok(!("path" in document));
    assert.ok(!("bytes" in document));
    assert.throws(
      () =>
        assertKnowledgeObject({
          ...document,
          documentStatus: "archived" as "live",
        }),
      /unknown document status/,
    );
  });

  it("rejects an institutional object inside an operating catalogue", () => {
    const creed = institutionalKernelCatalogue.find(
      (item) => item.id === "creed",
    );
    assert.ok(creed);
    assert.throws(
      () => assertOperatingCatalogue([...operatingKernelCatalogue, creed]),
      /Operating catalogue cannot include/,
    );
  });

  it("does not import Runtime, VIC, or walk a graph", () => {
    const source = [
      "src/operating.ts",
      "src/operating-fixtures.ts",
      "src/types.ts",
    ]
      .map((file) => readFileSync(join(packageRoot, file), "utf8"))
      .join("\n");
    assert.doesNotMatch(source, /ReasonQuery|runExecutiveIntelligenceRuntime/);
    assert.doesNotMatch(
      source,
      /from ["']@\/core\/runtime|from ["']@\/core\/venture/,
    );
    assert.doesNotMatch(source, /IntelligentDocument/);
  });
});

import { assertIntelligenceCatalogue } from "./assert";
import {
  assessKnowledgeAt,
  independentEvidenceOrigins,
  assertKnowledgeTime,
} from "./operating";
import {
  intelligenceCatalogue,
  intelligenceClaim,
  intelligenceEvidence,
  intelligenceScope,
} from "./operating-fixtures";
import {
  CLAIM_CLASSIFICATIONS,
  LEARNING_MATURITIES,
  type ClaimKnowledgeObject,
  type EvidenceKnowledgeObject,
  type KnowledgeObject,
  type LearningKnowledgeObject,
} from "./types";

const evaluatedAt = "2026-09-03T12:00:00Z";
const validatedAt = "2026-09-02T12:00:00Z";
function sample(): KnowledgeObject[] {
  return structuredClone(intelligenceCatalogue);
}
function claim(rows: KnowledgeObject[]) {
  return rows.find((r): r is ClaimKnowledgeObject => r.type === "Claim")!;
}
function evidence(rows: KnowledgeObject[]) {
  return rows.find((r): r is EvidenceKnowledgeObject => r.type === "Evidence")!;
}
function learning(rows: KnowledgeObject[]) {
  return rows.find((r): r is LearningKnowledgeObject => r.type === "Learning")!;
}
function secondEvidence(rows: KnowledgeObject[]) {
  const second = structuredClone(evidence(rows));
  second.id = "evidence-second";
  second.provenance!.source.recordId = "observation-2";
  rows.push(second);
  return second;
}
function derived(
  rows: KnowledgeObject[],
  id = "evidence-copy",
  parent = evidence(rows).id,
) {
  const copy = structuredClone(evidence(rows));
  copy.id = id;
  copy.provenance!.origin = "DERIVED";
  copy.provenance!.source = {
    system: "memory-copy",
    recordId: id,
    version: "1",
  };
  copy.relationships = [{ kind: "derived_from", objectId: parent }];
  delete copy.outcomeObservation;
  rows.push(copy);
  return copy;
}
function mature(rows: KnowledgeObject[], level = 3) {
  const l = learning(rows),
    second = secondEvidence(rows);
  l.validationHistory = [
    {
      id: "validation-1",
      at: validatedAt,
      actor: "reviewer",
      context: "inspection-a",
      evidenceIds: [evidence(rows).id],
      result: "SUPPORTED",
    },
    {
      id: "validation-2",
      at: validatedAt,
      actor: "reviewer",
      context: "inspection-b",
      evidenceIds: [second.id],
      result: "SUPPORTED",
    },
  ];
  l.maturityHistory = Array.from({ length: level }, (_, i) => ({
    from: LEARNING_MATURITIES[i]!,
    to: LEARNING_MATURITIES[i + 1]!,
    at: validatedAt,
    actor: "reviewer",
    reason: "Explicit review of independent observations.",
    validationIds: ["validation-1", "validation-2"],
  }));
  l.maturity = LEARNING_MATURITIES[level]!;
  return l;
}

describe("AIF-01 contracts and pure validation", () => {
  it("validates the full new contract fixture without mutating inputs", () => {
    const rows = sample(),
      before = structuredClone(rows);
    assertIntelligenceCatalogue(rows, evaluatedAt);
    assert.deepEqual(rows, before);
  });
  for (const value of CLAIM_CLASSIFICATIONS) {
    it(
      "accepts Claim classification " + value + " independently of approval",
      () => {
        const rows = sample();
        claim(rows).classification = value;
        claim(rows).status = "Approved";
        assertIntelligenceCatalogue(rows, evaluatedAt);
        assert.equal(
          assessKnowledgeAt(claim(rows), evaluatedAt).classification,
          value,
        );
      },
    );
  }
  it("rejects invalid classification", () => {
    const rows = sample();
    claim(rows).classification = "APPROVED" as never;
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /classification/,
    );
  });
  it("requires a named basis for FACT", () => {
    const rows = sample();
    Object.assign(claim(rows), {
      classification: "FACT",
      evidenceIds: [],
      sourceRefs: [],
    });
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /named basis/,
    );
  });
  it("keeps effective time separate from recording time with exclusive end", () => {
    const c = structuredClone(intelligenceClaim);
    c.effectiveFrom = "2026-08-01T00:00:00Z";
    c.effectiveTo = evaluatedAt;
    assert.equal(assessKnowledgeAt(c, evaluatedAt).effective, "EXPIRED");
    c.effectiveFrom = "2026-10-01T00:00:00Z";
    delete c.effectiveTo;
    assert.equal(assessKnowledgeAt(c, evaluatedAt).effective, "FUTURE");
  });
  it("rejects empty/reversed effective intervals", () => {
    const rows = sample();
    claim(rows).effectiveTo = claim(rows).effectiveFrom;
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /interval/,
    );
  });
  it("rejects invalid calendar dates and implicit timezones", () => {
    for (const time of [
      "2026-02-30T00:00:00Z",
      "2026-09-01",
      "2026-09-01T12:00:00",
      "bad",
    ]) {
      assert.throws(() => assertKnowledgeTime(time), /time/);
    }
  });
  it("rejects future recording and future evidence capture", () => {
    const rows = sample();
    claim(rows).recordedAt = "2027-01-01T00:00:00Z";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /evaluation time/,
    );
    const other = sample();
    evidence(other).capturedAt = "2027-01-01T00:00:00Z";
    assert.throws(
      () => assertIntelligenceCatalogue(other, evaluatedAt),
      /evaluation time/,
    );
  });
  it("preserves a retracted Claim with reason actor and time", () => {
    const rows = sample(),
      c = claim(rows);
    c.validity = "RETRACTED";
    c.retraction = {
      reason: "Ledger corrected.",
      actor: "reviewer",
      at: validatedAt,
    };
    assertIntelligenceCatalogue(rows, evaluatedAt);
    assert.equal(c.history.length, 1);
    assert.equal(assessKnowledgeAt(c, evaluatedAt).validity, "RETRACTED");
    c.retraction.actor = "";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /retraction actor/,
    );
  });
  it("rejects missing retraction, inconsistent metadata and backdated retraction", () => {
    const rows = sample(),
      c = claim(rows);
    c.validity = "RETRACTED";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /retraction structure/,
    );
    c.retraction = {
      reason: "Correction",
      actor: "reviewer",
      at: "2026-08-01T00:00:00Z",
    };
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /predates/,
    );
    c.validity = "ACTIVE";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /retraction structure/,
    );
  });
  it("preserves superseded history and resolves its successor", () => {
    const rows = sample(),
      c = claim(rows),
      next = structuredClone(c);
    next.id = "claim-new";
    c.validity = "SUPERSEDED";
    c.supersededById = next.id;
    rows.push(next);
    assertIntelligenceCatalogue(rows, evaluatedAt);
    assert.equal(c.history.length, 1);
    c.supersededById = "absent";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /reference/,
    );
  });
  it("rejects supersession cycles", () => {
    const rows = sample(),
      a = claim(rows),
      b = structuredClone(a);
    b.id = "claim-b";
    a.validity = b.validity = "SUPERSEDED";
    a.supersededById = b.id;
    b.supersededById = a.id;
    rows.push(b);
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /cycle/,
    );
  });
  it("requires structurally consistent supersession", () => {
    const rows = sample();
    claim(rows).validity = "SUPERSEDED";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /supersession structure/,
    );
  });
  it("validates Evidence links using canonical relationships", () => {
    for (const kind of ["evidence_for", "supports", "contradicts"] as const) {
      const rows = sample();
      evidence(rows).relationships = [{ kind, objectId: claim(rows).id }];
      assertIntelligenceCatalogue(rows, evaluatedAt);
      evidence(rows).relationships[0]!.objectId = "missing";
      assert.throws(
        () => assertIntelligenceCatalogue(rows, evaluatedAt),
        /reference/,
      );
    }
  });
  it("preserves evidence_for Risk semantics but rejects wrong target kinds", () => {
    const rows = sample();
    evidence(rows).relationships = [
      { kind: "evidence_for", objectId: learning(rows).id },
    ];
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /target type/,
    );
  });
  it("rejects wrong-type Claim and Decision payload references", () => {
    const rows = sample();
    claim(rows).evidenceIds = [learning(rows).id];
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /wrong-type/,
    );
    const other = sample(),
      d = other.find((r) => r.type === "Decision")!;
    assert.ok(d.type === "Decision");
    d.traceability!.claimIds = [evidence(other).id];
    assert.throws(
      () => assertIntelligenceCatalogue(other, evaluatedAt),
      /wrong-type/,
    );
  });
  it("requires Decision traceability, authority and measurable thresholds when supplied", () => {
    const rows = sample(),
      d = rows.find((r) => r.type === "Decision")!;
    assert.ok(d.type === "Decision");
    d.traceability!.authorityRef = "";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /authority/,
    );
  });
  it("validates zero as a measured outcome", () => {
    const rows = sample();
    evidence(rows).outcomeObservation!.observedValue = 0;
    assertIntelligenceCatalogue(rows, evaluatedAt);
    assert.equal(
      assessKnowledgeAt(evidence(rows), evaluatedAt).outcome,
      "OBSERVED",
    );
  });
  it("rejects outcomes missing measured value time or source", () => {
    for (const field of ["observedValue", "observedAt"] as const) {
      const rows = sample();
      delete (
        evidence(rows).outcomeObservation! as Partial<
          NonNullable<typeof intelligenceEvidence.outcomeObservation>
        >
      )[field];
      assert.throws(() => assertIntelligenceCatalogue(rows, evaluatedAt));
    }
    const rows = sample();
    delete evidence(rows).provenance;
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /provenance/,
    );
  });
  it("rejects invalid observation windows and capture before observation", () => {
    const rows = sample();
    evidence(rows).outcomeObservation!.window.to = "2026-08-01T00:00:00Z";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /window/,
    );
    const other = sample();
    evidence(other).capturedAt = "2026-08-01T00:00:00Z";
    assert.throws(
      () => assertIntelligenceCatalogue(other, evaluatedAt),
      /Capture/,
    );
  });
  it("does not treat resolved Decision.result as measured success", () => {
    const d = {
      ...intelligenceCatalogue.find((r) => r.type === "Decision")!,
      result: "Success",
      resolved: true,
    };
    assert.equal(assessKnowledgeAt(d, evaluatedAt).outcome, "UNASSESSED");
  });
  for (let i = 0; i < LEARNING_MATURITIES.length; i++) {
    it("accepts explicit progression to " + LEARNING_MATURITIES[i], () => {
      const rows = sample();
      mature(rows, i);
      assertIntelligenceCatalogue(rows, evaluatedAt);
    });
  }
  it("rejects silent maturity promotion and jumps", () => {
    const rows = sample();
    learning(rows).maturity = "VALIDATED_ORGANISATIONAL_PRINCIPLE";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /history/,
    );
    const other = sample(),
      l = mature(other);
    l.maturityHistory = [
      { ...l.maturityHistory[0]!, to: "VALIDATED_ORGANISATIONAL_PRINCIPLE" },
    ];
    assert.throws(
      () => assertIntelligenceCatalogue(other, evaluatedAt),
      /transition/,
    );
  });
  it("rejects Learning without source lineage", () => {
    const rows = sample();
    learning(rows).sourceEvidenceIds = [];
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /source lineage/,
    );
  });
  it("deduplicates source versions and derived memory/story copies", () => {
    const rows = sample(),
      second = secondEvidence(rows);
    second.provenance!.source.recordId =
      evidence(rows).provenance!.source.recordId;
    second.provenance!.source.version = "2";
    const copy = derived(rows),
      story = derived(rows, "story-copy", copy.id);
    assert.equal(
      independentEvidenceOrigins(
        [evidence(rows).id, second.id, copy.id, story.id],
        rows,
        evaluatedAt,
      ).length,
      1,
    );
  });
  it("recognises independent external records", () => {
    const rows = sample(),
      second = secondEvidence(rows);
    assert.equal(
      independentEvidenceOrigins(
        [evidence(rows).id, second.id],
        rows,
        evaluatedAt,
      ).length,
      2,
    );
  });
  it("rejects circular lineage and derived records with no parent", () => {
    const rows = sample(),
      a = derived(rows),
      b = derived(rows, "copy-b", a.id);
    a.relationships = [{ kind: "derived_from", objectId: b.id }];
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /Circular/,
    );
    a.relationships = [];
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /lineage/,
    );
  });
  it("rejects non-Evidence derivation and observed records borrowing origins", () => {
    const rows = sample();
    derived(rows, "bad-copy", claim(rows).id);
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /wrong-type/,
    );
    const other = sample();
    evidence(other).relationships.push({
      kind: "derived_from",
      objectId: evidence(other).id,
    });
    assert.throws(
      () => assertIntelligenceCatalogue(other, evaluatedAt),
      /lineage/,
    );
  });
  it("rejects duplicated validations of one source as a repeated pattern", () => {
    const rows = sample(),
      l = mature(rows, 2);
    l.validationHistory[1]!.evidenceIds = [evidence(rows).id];
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /independent/,
    );
  });
  it("rejects copies as independent validations even with distinct context labels", () => {
    const rows = sample(),
      l = mature(rows, 2),
      copy = derived(rows);
    l.validationHistory[1]!.evidenceIds = [copy.id];
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /independent/,
    );
  });
  it("requires measured success for principles, not legacy Evidence or Decision result", () => {
    const rows = sample();
    mature(rows);
    delete evidence(rows).outcomeObservation;
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /measured/,
    );
  });
  it("allows explicit Learning reversal while retaining validation history", () => {
    const rows = sample(),
      l = mature(rows);
    l.maturityHistory.push({
      from: l.maturity,
      to: "HYPOTHESIS",
      at: evaluatedAt,
      actor: "reviewer",
      reason: "Reconsider causal explanation.",
      validationIds: ["validation-1"],
    });
    l.maturity = "HYPOTHESIS";
    assertIntelligenceCatalogue(rows, evaluatedAt);
    assert.equal(l.validationHistory.length, 2);
  });
  it("rejects challenged principles without explicit reversal or retraction", () => {
    const rows = sample(),
      l = mature(rows);
    l.validationHistory.push({
      ...l.validationHistory[0]!,
      id: "challenge",
      result: "CHALLENGED",
      at: evaluatedAt,
    });
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /Challenged/,
    );
  });
  it("rejects cross-workspace and cross-Venture references without declared scope", () => {
    for (const field of ["workspaceId", "originatingVentureId"] as const) {
      const rows = sample(),
        scope = structuredClone(intelligenceScope);
      scope[field] = "other";
      scope.applicability = [
        {
          workspaceId: scope.workspaceId,
          ventureId: scope.originatingVentureId,
        },
      ];
      evidence(rows).operatingScope = scope;
      assert.throws(
        () => assertIntelligenceCatalogue(rows, evaluatedAt),
        /Cross-scope/,
      );
    }
  });
  it("accepts structurally declared sharing and rejects missing authority", () => {
    const rows = sample(),
      e = evidence(rows);
    e.operatingScope = {
      workspaceId: "ws-desk",
      originatingVentureId: "other",
      applicability: [
        { workspaceId: "ws-desk", ventureId: "other" },
        ...intelligenceScope.applicability,
      ],
      sharing: {
        recipients: intelligenceScope.applicability,
        authorityRef: "sharing-decision",
      },
    };
    // Remove outward links: this fixture tests consumption of shared evidence.
    e.relationships = [];
    assertIntelligenceCatalogue(rows, evaluatedAt);
    delete e.operatingScope.sharing.authorityRef;
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /authority/,
    );
  });
  it("rejects missing scope instead of using product labels as permissions", () => {
    const rows = sample();
    delete evidence(rows).operatingScope;
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /scope/,
    );
  });
  it("keeps legacy records unknown and unassessed without mutation", () => {
    const rows = structuredClone(institutionalKernelCatalogue),
      before = structuredClone(rows);
    assertIntelligenceCatalogue(rows, evaluatedAt);
    for (const row of rows)
      assert.equal(
        assessKnowledgeAt(row, evaluatedAt).classification,
        "UNKNOWN",
      );
    assert.deepEqual(rows, before);
  });
  it("rejects unproven confidence and invalid scores", () => {
    const rows = sample();
    claim(rows).confidence!.value = Number.NaN;
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /confidence/,
    );
    const other = sample();
    claim(other).confidence!.evidenceIds = [];
    assert.throws(
      () => assertIntelligenceCatalogue(other, evaluatedAt),
      /confidence evidence/,
    );
  });
  it("is deterministic with explicit evaluation time", () => {
    const rows = sample(),
      c = claim(rows);
    assert.deepEqual(
      assessKnowledgeAt(c, evaluatedAt),
      assessKnowledgeAt(structuredClone(c), evaluatedAt),
    );
    assert.deepEqual(
      independentEvidenceOrigins(c.evidenceIds, rows, evaluatedAt),
      independentEvidenceOrigins(
        c.evidenceIds,
        structuredClone(rows),
        evaluatedAt,
      ),
    );
  });
  it("does not introduce another relationship vocabulary or runtime dependency", () => {
    const source = ["src/types.ts", "src/operating.ts", "src/assert.ts"]
      .map((p) => readFileSync(join(packageRoot, p), "utf8"))
      .join("\n");
    assert.doesNotMatch(
      source,
      /claimLinks|decisionLinks|derivedFromEvidenceIds|Date\.now|new Date\(\)|Math\.random/,
    );
    assert.doesNotMatch(
      source,
      /from ["'].*apps\/web|runExecutiveIntelligenceRuntime|fetch\(/,
    );
  });
});

describe("AIF-01 additional boundary cases", () => {
  it("rejects cycles in existing supersedes relationships", () => {
    const rows = sample(),
      a = claim(rows),
      b = structuredClone(a);
    b.id = "claim-b";
    a.relationships = [{ kind: "supersedes", objectId: b.id }];
    b.relationships = [{ kind: "supersedes", objectId: a.id }];
    rows.push(b);
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /cycle/,
    );
  });
  it("accepts a consistent payload successor and graph supersession edge", () => {
    const rows = sample(),
      a = claim(rows),
      b = structuredClone(a);
    b.id = "claim-b";
    a.validity = "SUPERSEDED";
    a.supersededById = b.id;
    b.relationships = [{ kind: "supersedes", objectId: a.id }];
    rows.push(b);
    assertIntelligenceCatalogue(rows, evaluatedAt);
  });
  it("allows Learning retraction without deleting its validation history", () => {
    const rows = sample(),
      l = mature(rows);
    l.validity = "RETRACTED";
    l.retraction = {
      reason: "Conflicting observations.",
      actor: "reviewer",
      at: evaluatedAt,
    };
    assertIntelligenceCatalogue(rows, evaluatedAt);
    assert.equal(l.validationHistory.length, 2);
  });
  it("rejects future validation and duplicate validation identities", () => {
    const rows = sample(),
      l = mature(rows);
    l.validationHistory[0]!.at = "2027-01-01T00:00:00Z";
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /validation time/,
    );
    const other = sample(),
      next = mature(other);
    next.validationHistory[1]!.id = next.validationHistory[0]!.id;
    assert.throws(
      () => assertIntelligenceCatalogue(other, evaluatedAt),
      /Duplicate/,
    );
  });
  it("does not count overlapping source bundles as independent Learning validations", () => {
    const rows = sample(),
      l = mature(rows, 2);
    l.validationHistory[1]!.evidenceIds.push(evidence(rows).id);
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /independent/,
    );
  });
  it("validates Brain-owned purpose and objective measures", () => {
    const rows = sample(),
      goal = rows.find((r) => r.type === "Goal")!;
    assert.ok(goal.type === "Goal");
    goal.measures!.successCriteria[0]!.threshold = Infinity;
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /threshold/,
    );
    const company = structuredClone(
      operatingKernelCatalogue.find((r) => r.type === "Company")!,
    );
    assert.ok(company.type === "Company");
    company.intent = {
      mission: "Quality operations.",
      customerProblem: "Missing inspections.",
      targetOutcomes: ["Complete inspections."],
      economicObjectives: ["Sustainable margin."],
      constraints: ["Capacity."],
      priorities: ["Quality."],
      nonGoals: ["Automatic rulings."],
      reviewConditions: ["Quarterly review."],
    };
    assertKnowledgeObject(company);
    company.intent.mission = "";
    assert.throws(() => assertKnowledgeObject(company), /mission/);
  });
  it("does not label malformed outcome payloads as observed", () => {
    const e = structuredClone(intelligenceEvidence);
    e.outcomeObservation!.observedValue = Number.NaN;
    assert.throws(() => assessKnowledgeAt(e, evaluatedAt), /observed value/);
  });
  it("does not project a future retraction or maturity transition backwards", () => {
    const rows = sample(),
      c = claim(rows);
    c.validity = "RETRACTED";
    c.retraction = {
      reason: "Later correction.",
      actor: "reviewer",
      at: evaluatedAt,
    };
    assert.equal(assessKnowledgeAt(c, validatedAt).validity, "UNKNOWN");
    const l = mature(rows);
    assert.equal(
      assessKnowledgeAt(l, "2026-09-01T13:00:00Z").maturity,
      "UNASSESSED",
    );
  });
  it("retains canonical evidence_for links to Risk", () => {
    const rows = sample(),
      risk = structuredClone(
        operatingKernelCatalogue.find((r) => r.type === "Risk")!,
      );
    risk.relationships = [];
    risk.operatingScope = structuredClone(intelligenceScope);
    rows.push(risk);
    evidence(rows).relationships = [
      { kind: "evidence_for", objectId: risk.id },
    ];
    assertIntelligenceCatalogue(rows, evaluatedAt);
  });
  it("validates new operating payloads through the existing direct entry point", () => {
    const c = structuredClone(intelligenceClaim);
    c.classification = "invented" as never;
    assert.throws(() => assertOperatingPayload(c), /classification/);
  });
});

describe("AIF-01 independent defect correction", () => {
  it("rejects the exact ACTIVE principle declaration with empty histories", () => {
    const rows = sample(),
      l = learning(rows);
    l.maturity = "VALIDATED_ORGANISATIONAL_PRINCIPLE";
    assert.equal(l.validity, "ACTIVE");
    assert.deepEqual(l.maturityHistory, []);
    assert.deepEqual(l.validationHistory, []);
    assert.throws(
      () => assessKnowledgeAt(l, evaluatedAt),
      /maturity does not match explicit history/,
    );
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /maturity does not match explicit history/,
    );
  });
  for (const maturity of LEARNING_MATURITIES.slice(1)) {
    it(
      "rejects declaration-only " + maturity + " even with validation records",
      () => {
        const rows = sample(),
          l = mature(rows, 0);
        l.maturity = maturity;
        assert.throws(
          () => assessKnowledgeAt(l, evaluatedAt),
          /maturity does not match explicit history/,
        );
        assert.throws(
          () => assertIntelligenceCatalogue(rows, evaluatedAt),
          /maturity does not match explicit history/,
        );
      },
    );
  }
  for (let level = 0; level < LEARNING_MATURITIES.length; level++) {
    it(
      "preserves authoritative progression to " +
        LEARNING_MATURITIES[level] +
        " without trusting it in a context-free assessment",
      () => {
        const rows = sample(),
          l = mature(rows, level);
        assertIntelligenceCatalogue(rows, evaluatedAt);
        assert.equal(
          assessKnowledgeAt(l, evaluatedAt).maturity,
          level === 0 ? "OBSERVATION" : "UNASSESSED",
        );
      },
    );
  }
  const malformed: {
    name: string;
    change: (l: LearningKnowledgeObject) => void;
    error: RegExp;
  }[] = [
    {
      name: "non-adjacent promotion",
      change: (l) => {
        l.maturityHistory = [{ ...l.maturityHistory[0]!, to: l.maturity }];
      },
      error: /transition/,
    },
    {
      name: "broken transition chain",
      change: (l) => {
        l.maturityHistory[1]!.from = "OBSERVATION";
      },
      error: /transition/,
    },
    {
      name: "duplicate validation identity",
      change: (l) => {
        l.validationHistory[1]!.id = l.validationHistory[0]!.id;
      },
      error: /Duplicate/,
    },
    {
      name: "missing validation reference",
      change: (l) => {
        l.maturityHistory[0]!.validationIds = ["missing"];
      },
      error: /Missing or future validation/,
    },
    {
      name: "validation later than transition",
      change: (l) => {
        l.validationHistory[0]!.at = evaluatedAt;
      },
      error: /future validation/,
    },
    {
      name: "unsupported promotion",
      change: (l) => {
        l.validationHistory[0]!.result = "INCONCLUSIVE";
      },
      error: /supported validation/,
    },
    {
      name: "duplicate transition validation",
      change: (l) => {
        l.maturityHistory[0]!.validationIds = ["validation-1", "validation-1"];
      },
      error: /Duplicate transition/,
    },
    {
      name: "non-distinct principle contexts",
      change: (l) => {
        l.validationHistory[1]!.context = l.validationHistory[0]!.context;
      },
      error: /distinct validation contexts/,
    },
    {
      name: "unresolved challenge",
      change: (l) => {
        l.validationHistory.push({
          ...l.validationHistory[0]!,
          id: "challenge",
          result: "CHALLENGED",
        });
      },
      error: /challenge/i,
    },
  ];
  for (const { name, change, error } of malformed) {
    it("uses the same rejection semantics for " + name, () => {
      const rows = sample(),
        l = mature(rows);
      change(l);
      assert.throws(() => assessKnowledgeAt(l, evaluatedAt), error);
      assert.throws(
        () => assertIntelligenceCatalogue(rows, evaluatedAt),
        error,
      );
    });
  }
  it("keeps copied/derived sources insufficient for independent validation", () => {
    const rows = sample(),
      l = mature(rows),
      copy = derived(rows);
    l.validationHistory[1]!.evidenceIds = [copy.id];
    assert.equal(assessKnowledgeAt(l, evaluatedAt).maturity, "UNASSESSED");
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /independent/,
    );
  });
  it("keeps source versions insufficient for independent validation", () => {
    const rows = sample(),
      l = mature(rows);
    const second = rows.find(
      (r) => r.id === "evidence-second",
    ) as EvidenceKnowledgeObject;
    second.provenance!.source = {
      ...evidence(rows).provenance!.source,
      version: "2",
    };
    assert.equal(assessKnowledgeAt(l, evaluatedAt).maturity, "UNASSESSED");
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /independent/,
    );
  });
  it("keeps overlapping source bundles insufficient for independent validation", () => {
    const rows = sample(),
      l = mature(rows);
    l.validationHistory[1]!.evidenceIds.push(evidence(rows).id);
    assert.equal(assessKnowledgeAt(l, evaluatedAt).maturity, "UNASSESSED");
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /independent/,
    );
  });
  for (const outcome of ["absent", "MISSED", "INCONCLUSIVE"] as const) {
    it(
      "retains measured-success requirements when outcome is " + outcome,
      () => {
        const rows = sample(),
          l = mature(rows);
        if (outcome === "absent") delete evidence(rows).outcomeObservation;
        else evidence(rows).outcomeObservation!.assessment = outcome;
        assert.equal(assessKnowledgeAt(l, evaluatedAt).maturity, "UNASSESSED");
        assert.throws(
          () => assertIntelligenceCatalogue(rows, evaluatedAt),
          /measured successful/,
        );
      },
    );
  }
  it("does not project future transitions backwards and leaves catalogue timing strict", () => {
    const rows = sample(),
      l = mature(rows);
    const beforeTransition = "2026-09-01T13:00:00Z";
    assert.equal(assessKnowledgeAt(l, beforeTransition).maturity, "UNASSESSED");
    assert.throws(
      () => assertIntelligenceCatalogue(rows, beforeTransition),
      /validation time/,
    );
  });
  it("preserves explicit retraction and reversal without trusting earlier promotions", () => {
    const rows = sample(),
      l = mature(rows);
    l.validity = "RETRACTED";
    l.retraction = {
      reason: "Later evidence.",
      actor: "reviewer",
      at: evaluatedAt,
    };
    assertIntelligenceCatalogue(rows, evaluatedAt);
    const result = assessKnowledgeAt(l, evaluatedAt);
    assert.equal(result.validity, "RETRACTED");
    assert.equal(result.maturity, "UNASSESSED");
    l.maturityHistory.push({
      from: l.maturity,
      to: "OBSERVATION",
      at: evaluatedAt,
      actor: "reviewer",
      reason: "Reverse prior conclusion.",
      validationIds: ["validation-1"],
    });
    l.maturity = "OBSERVATION";
    assertIntelligenceCatalogue(rows, evaluatedAt);
    assert.equal(assessKnowledgeAt(l, evaluatedAt).maturity, "UNASSESSED");
    l.validationHistory[1]!.evidenceIds = [evidence(rows).id];
    assert.throws(
      () => assertIntelligenceCatalogue(rows, evaluatedAt),
      /independent/,
    );
  });
  it("is deterministic and non-mutating for valid and contradictory Learning records", () => {
    const rows = sample(),
      l = mature(rows),
      before = structuredClone(rows);
    assert.deepEqual(
      assessKnowledgeAt(l, evaluatedAt),
      assessKnowledgeAt(structuredClone(l), evaluatedAt),
    );
    assert.deepEqual(rows, before);
    l.maturityHistory = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.throws(
        () => assessKnowledgeAt(l, evaluatedAt),
        /maturity does not match explicit history/,
      );
    }
  });
  it("keeps valid existing fixtures green and initial OBSERVATION assessable", () => {
    const rows = sample(),
      l = learning(rows);
    assertIntelligenceCatalogue(rows, evaluatedAt);
    assert.equal(assessKnowledgeAt(l, evaluatedAt).maturity, "OBSERVATION");
  });
  it("keeps assessment pure and shares the authoritative history validator", () => {
    const source = readFileSync(join(packageRoot, "src/operating.ts"), "utf8");
    const point = source.slice(
      source.indexOf("export function assessKnowledgeAt("),
    );
    assert.match(
      point,
      /assertLearningHistory\(record, undefined, evaluationTime\)/,
    );
    assert.doesNotMatch(point, /record\.maturity\b/);
    assert.doesNotMatch(
      source,
      /Date\.now|new Date\(\)|Math\.random|fetch\(|https?:|node:(fs|http)|runExecutiveIntelligenceRuntime/,
    );
  });
});
