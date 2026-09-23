import {
  CLAIM_CLASSIFICATIONS,
  KNOWLEDGE_VALIDITIES,
  LEARNING_MATURITIES,
  type SourceReference,
  type VentureAddress,
  type OperatingScope,
  type KnowledgeConfidence,
  type SuccessCriterion,
  type ClaimKnowledgeObject,
  type LearningKnowledgeObject,
  type LearningMaturity,
  type EvidenceKnowledgeObject,
} from "./types";
import {
  EVIDENCE_WEIGHT_CLASSES,
  OPERATING_DOCUMENT_STATUSES,
  isOperatingKnowledgeType,
  type EvidenceWeightClass,
  type KnowledgeObject,
  type OperatingDocumentStatus,
  type OperatingKnowledgeObject,
} from "./types";

const evidenceWeights = new Set<string>(EVIDENCE_WEIGHT_CLASSES);
const documentStatuses = new Set<string>(OPERATING_DOCUMENT_STATUSES);

export function isOperatingKnowledgeObject(
  object: KnowledgeObject,
): object is OperatingKnowledgeObject {
  return isOperatingKnowledgeType(object.type);
}

function requireText(id: string, field: string, value: string) {
  if (!value.trim()) {
    throw new Error(`Knowledge Object ${id} is missing ${field}.`);
  }
}

function requireIds(id: string, field: string, values: string[]) {
  if (values.some((item) => !item.trim())) {
    throw new Error(`Knowledge Object ${id} has an empty ${field} entry.`);
  }
}

export function assertOperatingPayload(record: OperatingKnowledgeObject) {
  assertIntelligencePayload(record);
  switch (record.type) {
    case "Company":
      requireText(record.id, "legalName", record.legalName);
      requireText(record.id, "operatingName", record.operatingName);
      requireText(record.id, "definitionRef", record.definitionRef);
      requireText(record.id, "workspaceId", record.workspaceId);
      requireText(record.id, "stage", record.stage);
      return;
    case "Person":
      requireText(record.id, "role", record.role);
      requireText(record.id, "remit", record.remit);
      requireText(record.id, "companyId", record.companyId);
      return;
    case "Procedure":
      if (record.steps.length === 0) {
        throw new Error(`Procedure ${record.id} has no steps.`);
      }
      requireIds(record.id, "steps", record.steps);
      return;
    case "Evidence":
      requireText(record.id, "source", record.source);
      requireText(record.id, "capturedAt", record.capturedAt);
      requireText(record.id, "supportsObjectId", record.supportsObjectId);
      if (!evidenceWeights.has(record.weightClass)) {
        throw new Error(`Evidence ${record.id} has an unknown weight class.`);
      }
      return;
    case "Meeting":
      requireText(record.id, "occurredAt", record.occurredAt);
      requireIds(record.id, "attendeeIds", record.attendeeIds);
      requireIds(record.id, "decisionIds", record.decisionIds);
      return;
    case "Risk":
      requireText(record.id, "headline", record.headline);
      requireText(record.id, "signal", record.signal);
      requireText(record.id, "mitigation", record.mitigation);
      return;
    case "Task":
      requireText(record.id, "outcome", record.outcome);
      requireIds(record.id, "blockerIds", record.blockerIds);
      return;
    case "Goal":
      requireText(record.id, "objective", record.objective);
      requireText(record.id, "horizon", record.horizon);
      requireIds(record.id, "taskIds", record.taskIds);
      return;
    case "Project":
      requireText(record.id, "companyId", record.companyId);
      requireText(record.id, "outcome", record.outcome);
      requireIds(record.id, "goalIds", record.goalIds);
      return;
    case "Incident":
      requireText(record.id, "whatBroke", record.whatBroke);
      requireIds(record.id, "evidenceIds", record.evidenceIds);
      requireIds(record.id, "followUpDecisionIds", record.followUpDecisionIds);
      return;
    case "Provider":
      requireText(record.id, "supplies", record.supplies);
      requireIds(record.id, "contractIds", record.contractIds);
      requireIds(record.id, "inspectionIds", record.inspectionIds);
      return;
    case "Inspection":
      requireText(record.id, "subjectId", record.subjectId);
      requireText(record.id, "outcome", record.outcome);
      requireText(record.id, "nextDue", record.nextDue);
      requireIds(record.id, "evidenceIds", record.evidenceIds);
      return;
    case "Customer":
      requireText(record.id, "companyId", record.companyId);
      requireText(record.id, "relationship", record.relationship);
      return;
    case "Contract":
      if (record.partyIds.length === 0) {
        throw new Error(`Contract ${record.id} has no parties.`);
      }
      requireIds(record.id, "partyIds", record.partyIds);
      requireText(record.id, "term", record.term);
      requireText(record.id, "obligations", record.obligations);
      requireIds(record.id, "evidenceIds", record.evidenceIds);
      return;
    case "Document":
      requireText(record.id, "kind", record.kind);
      if (!documentStatuses.has(record.documentStatus)) {
        throw new Error(
          `Document ${record.id} has an unknown document status.`,
        );
      }
      requireIds(record.id, "evidenceOfIds", record.evidenceOfIds);
      return;
  }
}

export function isEvidenceWeightClass(
  value: string,
): value is EvidenceWeightClass {
  return evidenceWeights.has(value);
}

export function isOperatingDocumentStatus(
  value: string,
): value is OperatingDocumentStatus {
  return documentStatuses.has(value);
}

/** AIF-01 structural validation. Inputs are declarations, not adjudicated truth. */
function demand(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertKnowledgeTime(value: string): number {
  demand(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value),
    "Knowledge time must be an explicit UTC timestamp.",
  );
  const time = Date.parse(value);
  demand(
    Number.isFinite(time) &&
      new Date(time).toISOString().replace(".000Z", "Z") ===
        value.replace(".000Z", "Z"),
    "Invalid knowledge time.",
  );
  return time;
}

function text(value: string, field: string) {
  demand(
    typeof value === "string" && value.trim().length > 0,
    "Missing " + field + ".",
  );
}
function texts(values: string[], field: string, nonempty = false) {
  demand(
    Array.isArray(values) && (!nonempty || values.length > 0),
    "Missing " + field + ".",
  );
  for (const value of values) text(value, field);
}
function source(ref: SourceReference) {
  demand(ref, "Missing source reference.");
  text(ref.system, "source system");
  text(ref.recordId, "source record");
  text(ref.version, "source version");
}
function sameAddress(a: VentureAddress, b: VentureAddress) {
  return a.workspaceId === b.workspaceId && a.ventureId === b.ventureId;
}
function origin(scope: OperatingScope): VentureAddress {
  return {
    workspaceId: scope.workspaceId,
    ventureId: scope.originatingVentureId,
  };
}
export function assertOperatingScope(scope: OperatingScope) {
  demand(scope, "Missing operating scope.");
  text(scope.workspaceId, "workspace");
  text(scope.originatingVentureId, "originating Venture");
  demand(
    Array.isArray(scope.applicability) && scope.applicability.length,
    "Missing applicability.",
  );
  demand(
    scope.sharing && Array.isArray(scope.sharing.recipients),
    "Missing sharing scope.",
  );
  for (const address of [...scope.applicability, ...scope.sharing.recipients]) {
    text(address.workspaceId, "scope workspace");
    text(address.ventureId, "scope Venture");
  }
  if (scope.sharing.recipients.length)
    text(scope.sharing.authorityRef ?? "", "sharing authority");
  for (const address of scope.applicability) {
    demand(
      sameAddress(address, origin(scope)) ||
        scope.sharing.recipients.some((r) => sameAddress(r, address)),
      "Applicability exceeds authorised sharing scope.",
    );
  }
}
/** Consumer may refer to provider only within its explicitly declared applicability/sharing. */
export function assertScopeReference(
  consumer: OperatingScope,
  provider: OperatingScope,
) {
  assertOperatingScope(consumer);
  assertOperatingScope(provider);
  const address = origin(consumer);
  demand(
    provider.applicability.some((a) => sameAddress(a, address)),
    "Cross-scope reference outside applicability.",
  );
  demand(
    sameAddress(address, origin(provider)) ||
      provider.sharing.recipients.some((a) => sameAddress(a, address)),
    "Cross-scope reference without authorised sharing.",
  );
}
function confidence(value: KnowledgeConfidence) {
  demand(
    value &&
      Number.isFinite(value.value) &&
      value.value >= 0 &&
      value.value <= 1,
    "Invalid confidence score.",
  );
  text(value.method, "confidence method");
  texts(value.evidenceIds, "confidence evidence", true);
}
function classification(value: string) {
  demand(
    (CLAIM_CLASSIFICATIONS as readonly string[]).includes(value),
    "Invalid Claim classification.",
  );
}
function criterion(value: SuccessCriterion) {
  text(value.metric, "criterion metric");
  demand(
    Number.isFinite(value.target) && Number.isFinite(value.threshold),
    "Invalid success threshold.",
  );
  demand(
    ["AT_LEAST", "AT_MOST", "EQUAL"].includes(value.comparison),
    "Invalid threshold comparison.",
  );
}
function lifetime(record: ClaimKnowledgeObject | LearningKnowledgeObject) {
  assertKnowledgeTime(record.recordedAt);
  demand(
    (KNOWLEDGE_VALIDITIES as readonly string[]).includes(record.validity),
    "Invalid knowledge validity.",
  );
  demand(
    (record.validity === "SUPERSEDED") ===
      (record.supersededById !== undefined),
    "Invalid supersession structure.",
  );
  if (record.supersededById !== undefined) {
    text(record.supersededById, "supersession reference");
    demand(record.supersededById !== record.id, "Supersession cycle.");
  }
  demand(
    (record.validity === "RETRACTED") === (record.retraction !== undefined),
    "Invalid retraction structure.",
  );
  if (record.retraction) {
    text(record.retraction.reason, "retraction reason");
    text(record.retraction.actor, "retraction actor");
    demand(
      assertKnowledgeTime(record.retraction.at) >=
        assertKnowledgeTime(record.recordedAt),
      "Retraction predates recording.",
    );
  }
}
function measured(value: number | string) {
  return typeof value === "number"
    ? Number.isFinite(value)
    : typeof value === "string" && value.trim().length > 0;
}

export function assertIntelligencePayload(record: KnowledgeObject) {
  if (record.operatingScope) assertOperatingScope(record.operatingScope);
  switch (record.type) {
    case "Claim":
      assertOperatingScope(record.operatingScope);
      lifetime(record);
      text(record.statement, "Claim statement");
      classification(record.classification);
      texts(record.evidenceIds, "Claim evidence");
      texts(record.assumptions, "Claim assumptions");
      record.sourceRefs.forEach(source);
      assertKnowledgeTime(record.effectiveFrom);
      if (record.effectiveTo !== undefined)
        demand(
          assertKnowledgeTime(record.effectiveTo) >
            assertKnowledgeTime(record.effectiveFrom),
          "Invalid Claim effective-time interval.",
        );
      if (record.confidence) confidence(record.confidence);
      if (
        record.classification === "FACT" ||
        record.classification === "EVIDENCED_CLAIM"
      ) {
        demand(
          record.evidenceIds.length > 0 || record.sourceRefs.length > 0,
          "Evidenced Claim requires a named basis.",
        );
      }
      return;
    case "Learning":
      assertOperatingScope(record.operatingScope);
      lifetime(record);
      texts(record.sourceEvidenceIds, "Learning source lineage", true);
      record.sourceEventRefs.forEach(source);
      for (const field of [
        "expectedResult",
        "actualResult",
        "deviation",
        "lesson",
        "proposedChange",
      ] as const)
        text(record[field], field);
      text(record.rootCause.statement, "root cause assessment");
      classification(record.rootCause.classification);
      texts(record.rootCause.evidenceIds, "root cause evidence");
      confidence(record.confidence);
      demand(
        (LEARNING_MATURITIES as readonly string[]).includes(record.maturity),
        "Invalid Learning maturity.",
      );
      for (const validation of record.validationHistory) {
        text(validation.id, "validation id");
        text(validation.actor, "validation actor");
        text(validation.context, "validation context");
        assertKnowledgeTime(validation.at);
        texts(validation.evidenceIds, "validation evidence", true);
        demand(
          ["SUPPORTED", "CHALLENGED", "INCONCLUSIVE"].includes(
            validation.result,
          ),
          "Invalid validation result.",
        );
      }
      for (const step of record.maturityHistory) {
        text(step.actor, "maturity actor");
        text(step.reason, "maturity reason");
        assertKnowledgeTime(step.at);
        texts(step.validationIds, "maturity validation references", true);
      }
      return;
    case "Evidence": {
      if (record.provenance || record.outcomeObservation) {
        assertOperatingScope(record.operatingScope!);
        demand(
          record.provenance,
          "Evidence linkage/outcome requires provenance.",
        );
      }
      const p = record.provenance;
      if (p) {
        source(p.source);
        text(p.method, "provenance method");
        demand(
          assertKnowledgeTime(record.capturedAt) >=
            assertKnowledgeTime(p.observedAt),
          "Capture predates observation.",
        );
        const parents = record.relationships.filter(
          (r) => r.kind === "derived_from",
        );
        demand(
          p.origin === "OBSERVED" || p.origin === "DERIVED",
          "Invalid evidence origin.",
        );
        demand(
          (p.origin === "DERIVED") === parents.length > 0,
          "Invalid evidence lineage.",
        );
      }
      const o = record.outcomeObservation;
      if (o) {
        demand(
          o.decisionId || o.executionRef,
          "Outcome requires Decision or execution reference.",
        );
        if (o.executionRef) source(o.executionRef);
        text(o.metric, "outcome metric");
        demand(
          measured(o.expectedValue) && measured(o.observedValue),
          "Outcome requires expected and observed value.",
        );
        const at = assertKnowledgeTime(o.observedAt);
        demand(
          assertKnowledgeTime(o.window.from) <= at &&
            at <= assertKnowledgeTime(o.window.to),
          "Invalid outcome observation window.",
        );
        demand(
          at <= assertKnowledgeTime(record.capturedAt) &&
            at === assertKnowledgeTime(p!.observedAt),
          "Outcome observation time disagrees with provenance.",
        );
        demand(
          ["MET", "MISSED", "INCONCLUSIVE"].includes(o.assessment),
          "Invalid outcome assessment.",
        );
      }
      return;
    }
    case "Decision": {
      const d = record.traceability;
      if (!d) return;
      assertOperatingScope(record.operatingScope!);
      texts(d.goalIds, "Decision goals", true);
      texts(d.claimIds, "Decision Claims", true);
      texts(d.evidenceIds, "Decision evidence", true);
      texts(d.assumptions, "Decision assumptions");
      texts(d.expectedOutcomes, "expected outcomes", true);
      texts(d.reviewConditions, "review conditions", true);
      texts(record.alternatives, "considered alternatives", true);
      text(d.selectedAction, "selected action");
      text(d.businessRationale, "business rationale");
      text(d.authorityRef, "authority");
      demand(d.successThresholds.length > 0, "Missing success thresholds.");
      d.successThresholds.forEach(criterion);
      return;
    }
    case "Company":
      if (record.operatingScope)
        demand(
          record.workspaceId === record.operatingScope.workspaceId,
          "Company workspace mismatch.",
        );
      if (record.intent) {
        text(record.intent.mission, "mission");
        text(record.intent.customerProblem, "customer problem");
        for (const field of [
          "targetOutcomes",
          "economicObjectives",
          "constraints",
          "priorities",
          "nonGoals",
          "reviewConditions",
        ] as const) {
          texts(record.intent[field], field, field === "targetOutcomes");
        }
      }
      return;
    case "Goal":
      if (record.measures) {
        demand(
          Number.isFinite(record.measures.priority),
          "Invalid objective priority.",
        );
        demand(
          record.measures.successCriteria.length > 0,
          "Missing success criteria.",
        );
        record.measures.successCriteria.forEach(criterion);
        texts(record.measures.constraints, "constraints");
        texts(record.measures.nonGoals, "non-goals");
        texts(record.measures.reviewConditions, "review conditions", true);
      }
      return;
  }
}

function lookup(
  id: string,
  records: KnowledgeObject[],
  type?: KnowledgeObject["type"],
) {
  const found = records.filter((r) => r.id === id);
  demand(
    found.length === 1 && (!type || found[0]!.type === type),
    "Missing, duplicate or wrong-type reference: " + id,
  );
  return found[0]!;
}
function reference(
  owner: KnowledgeObject,
  id: string,
  records: KnowledgeObject[],
  type?: KnowledgeObject["type"],
) {
  const target = lookup(id, records, type);
  demand(
    owner.operatingScope && target.operatingScope,
    "Unassessed scope on reference: " + id,
  );
  assertScopeReference(owner.operatingScope, target.operatingScope);
  return target;
}

/** Versions/copies of a source record do not increase the independent-origin count. */
export function independentEvidenceOrigins(
  ids: string[],
  records: KnowledgeObject[],
  evaluationTime: string,
): string[] {
  const now = assertKnowledgeTime(evaluationTime);
  const visiting = new Set<string>();
  const cache = new Map<string, string[]>();
  function visit(id: string): string[] {
    demand(!visiting.has(id), "Circular evidence lineage.");
    const cached = cache.get(id);
    if (cached) return cached;
    const e = lookup(id, records, "Evidence") as EvidenceKnowledgeObject;
    assertIntelligencePayload(e);
    demand(
      e.provenance && e.operatingScope,
      "Unassessed evidence lineage: " + id,
    );
    demand(
      assertKnowledgeTime(e.capturedAt) <= now,
      "Evidence was not captured at evaluation time.",
    );
    visiting.add(id);
    const p = e.provenance;
    const graphParents = e.relationships
      .filter((r) => r.kind === "derived_from")
      .map((r) => r.objectId);
    const roots =
      p.origin === "OBSERVED"
        ? [JSON.stringify([p.source.system, p.source.recordId])]
        : graphParents.flatMap((parent) => {
            const target = reference(
              e,
              parent,
              records,
              "Evidence",
            ) as EvidenceKnowledgeObject;
            demand(
              assertKnowledgeTime(target.capturedAt) <=
                assertKnowledgeTime(e.capturedAt),
              "Derived evidence predates source.",
            );
            return visit(parent);
          });
    visiting.delete(id);
    const result = [...new Set(roots)].sort();
    cache.set(id, result);
    return result;
  }
  return [...new Set(ids.flatMap(visit))].sort();
}

function assertLearningHistory(
  record: LearningKnowledgeObject,
  records: KnowledgeObject[],
  evaluationTime: string,
) {
  const now = assertKnowledgeTime(evaluationTime);
  const ids = new Set<string>();
  for (const v of record.validationHistory) {
    demand(!ids.has(v.id), "Duplicate Learning validation id.");
    ids.add(v.id);
    demand(
      assertKnowledgeTime(v.at) >= assertKnowledgeTime(record.recordedAt) &&
        assertKnowledgeTime(v.at) <= now,
      "Invalid Learning validation time.",
    );
    for (const id of v.evidenceIds) reference(record, id, records, "Evidence");
    independentEvidenceOrigins(v.evidenceIds, records, v.at);
  }
  let maturity: LearningMaturity = "OBSERVATION";
  let last = assertKnowledgeTime(record.recordedAt);
  for (const step of record.maturityHistory) {
    const from = LEARNING_MATURITIES.indexOf(step.from),
      to = LEARNING_MATURITIES.indexOf(step.to);
    demand(
      step.from === maturity &&
        from >= 0 &&
        to >= 0 &&
        to !== from &&
        to <= from + 1,
      "Invalid Learning maturity transition.",
    );
    const at = assertKnowledgeTime(step.at);
    demand(at >= last && at <= now, "Invalid maturity transition time.");
    const selected = step.validationIds.map((id) => {
      const v = record.validationHistory.find((entry) => entry.id === id);
      demand(
        v && assertKnowledgeTime(v.at) <= at,
        "Missing or future validation for transition.",
      );
      return v;
    });
    demand(
      new Set(step.validationIds).size === step.validationIds.length,
      "Duplicate transition validation.",
    );
    if (to > from) {
      demand(
        selected.every((v) => v.result === "SUPPORTED"),
        "Promotion requires supported validation.",
      );
      if (to >= 2) {
        const roots = selected.map((v) =>
          independentEvidenceOrigins(v.evidenceIds, records, step.at),
        );
        // Require two disjoint validation origins, not two copies or overlapping bundles.
        const independent = roots.some((a, i) =>
          roots.some((b, j) => i !== j && a.every((root) => !b.includes(root))),
        );
        demand(
          independent,
          "Learning promotion requires independent validation origins.",
        );
      }
      if (to === 3) {
        demand(
          new Set(selected.map((v) => v.context)).size >= 2,
          "Principle requires distinct validation contexts.",
        );
        demand(
          selected.every((v) =>
            v.evidenceIds.some((id) => {
              const evidence = lookup(
                id,
                records,
                "Evidence",
              ) as EvidenceKnowledgeObject;
              return (
                evidence.provenance?.origin === "OBSERVED" &&
                evidence.outcomeObservation?.assessment === "MET"
              );
            }),
          ),
          "Principle requires measured successful outcome evidence.",
        );
        demand(
          !record.validationHistory.some(
            (v) => v.result === "CHALLENGED" && assertKnowledgeTime(v.at) <= at,
          ),
          "Unresolved challenge prevents principle promotion.",
        );
      }
    }
    maturity = step.to;
    last = at;
  }
  demand(
    record.maturity === maturity,
    "Learning maturity does not match explicit history.",
  );
  if (
    maturity === "VALIDATED_ORGANISATIONAL_PRINCIPLE" &&
    record.validity === "ACTIVE"
  ) {
    demand(
      !record.validationHistory.some((v) => v.result === "CHALLENGED"),
      "Challenged principle requires explicit reversal or retraction.",
    );
  }
}

export function assertIntelligenceReferences(
  records: KnowledgeObject[],
  evaluationTime: string,
) {
  // Payload successor references and existing newer -> older graph edges share one cycle check.
  const successors = new Map<string, Set<string>>();
  const add = (older: string, newer: string) => {
    lookup(older, records);
    lookup(newer, records);
    const targets = successors.get(older) ?? new Set<string>();
    targets.add(newer);
    successors.set(older, targets);
  };
  for (const record of records) {
    if (
      (record.type === "Claim" || record.type === "Learning") &&
      record.supersededById
    )
      add(record.id, record.supersededById);
    for (const rel of record.relationships.filter(
      (r) => r.kind === "supersedes",
    )) {
      const older = lookup(rel.objectId, records);
      if (record.type === "Claim" || record.type === "Learning") {
        demand(
          older.type === record.type,
          "Supersession must retain Knowledge Object type.",
        );
      }
      add(older.id, record.id);
    }
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const check = (id: string) => {
    demand(!visiting.has(id), "Supersession cycle.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of successors.get(id) ?? []) check(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of successors.keys()) check(id);

  const now = assertKnowledgeTime(evaluationTime);
  for (const record of records) {
    if (record.operatingScope) {
      for (const rel of record.relationships)
        reference(record, rel.objectId, records);
    }
    if (record.type === "Claim" || record.type === "Learning") {
      demand(
        assertKnowledgeTime(record.recordedAt) <= now,
        "Knowledge was not recorded at evaluation time.",
      );
      if (record.retraction)
        demand(
          assertKnowledgeTime(record.retraction.at) <= now,
          "Future retraction.",
        );
      if (record.supersededById) {
        const successor = reference(
          record,
          record.supersededById,
          records,
          record.type,
        ) as ClaimKnowledgeObject | LearningKnowledgeObject;
        demand(
          assertKnowledgeTime(successor.recordedAt) >=
            assertKnowledgeTime(record.recordedAt),
          "Supersession predates record.",
        );
      }
      const seen = new Set<string>([record.id]);
      let cursor: ClaimKnowledgeObject | LearningKnowledgeObject = record;
      while (cursor.supersededById) {
        demand(!seen.has(cursor.supersededById), "Supersession cycle.");
        seen.add(cursor.supersededById);
        cursor = lookup(
          cursor.supersededById,
          records,
          record.type,
        ) as typeof cursor;
      }
      const evidenceIds =
        record.type === "Claim" ? record.evidenceIds : record.sourceEvidenceIds;
      for (const id of [
        ...evidenceIds,
        ...(record.confidence?.evidenceIds ?? []),
      ])
        reference(record, id, records, "Evidence");
      if (evidenceIds.length)
        independentEvidenceOrigins(evidenceIds, records, evaluationTime);
      if (record.confidence)
        independentEvidenceOrigins(
          record.confidence.evidenceIds,
          records,
          evaluationTime,
        );
    }
    if (record.type === "Evidence") {
      if (record.provenance)
        independentEvidenceOrigins([record.id], records, evaluationTime);
      for (const rel of record.relationships) {
        if (rel.kind === "derived_from") {
          lookup(rel.objectId, records, "Evidence");
        } else if (rel.kind === "evidence_for") {
          const target = lookup(rel.objectId, records);
          demand(
            ["Claim", "Decision", "Risk"].includes(target.type),
            "Invalid evidence_for target type.",
          );
        } else if (rel.kind === "supports" || rel.kind === "contradicts") {
          // Existing vocabulary permits object -> object. Resolve, do not narrow that law.
          lookup(rel.objectId, records);
        }
      }
      if (record.outcomeObservation?.decisionId)
        reference(
          record,
          record.outcomeObservation.decisionId,
          records,
          "Decision",
        );
    }
    if (record.type === "Decision" && record.traceability) {
      for (const id of record.traceability.goalIds)
        reference(record, id, records, "Goal");
      for (const id of record.traceability.claimIds)
        reference(record, id, records, "Claim");
      for (const id of record.traceability.evidenceIds)
        reference(record, id, records, "Evidence");
      independentEvidenceOrigins(
        record.traceability.evidenceIds,
        records,
        evaluationTime,
      );
    }
    if (record.type === "Learning") {
      for (const id of record.rootCause.evidenceIds)
        reference(record, id, records, "Evidence");
      if (record.rootCause.evidenceIds.length)
        independentEvidenceOrigins(
          record.rootCause.evidenceIds,
          records,
          evaluationTime,
        );
      assertLearningHistory(record, records, evaluationTime);
    }
  }
}

/** Absent legacy metadata stays unassessed. Governance approval changes none of these dimensions. */
export function assessKnowledgeAt(
  record: KnowledgeObject,
  evaluationTime: string,
) {
  assertIntelligencePayload(record);
  const now = assertKnowledgeTime(evaluationTime);
  const known =
    (record.type === "Claim" || record.type === "Learning") &&
    assertKnowledgeTime(record.recordedAt) <= now;
  return {
    classification:
      record.type === "Claim" && known ? record.classification : "UNKNOWN",
    validity:
      known &&
      (!record.retraction || assertKnowledgeTime(record.retraction.at) <= now)
        ? record.validity
        : "UNKNOWN",
    maturity:
      record.type === "Learning" &&
      known &&
      record.maturityHistory.every(
        (step) => assertKnowledgeTime(step.at) <= now,
      )
        ? record.maturity
        : "UNASSESSED",
    outcome:
      record.type === "Evidence" &&
      record.provenance &&
      record.outcomeObservation &&
      assertKnowledgeTime(record.capturedAt) <= now
        ? "OBSERVED"
        : "UNASSESSED",
    effective:
      record.type === "Claim" && known
        ? now < assertKnowledgeTime(record.effectiveFrom)
          ? "FUTURE"
          : record.effectiveTo && now >= assertKnowledgeTime(record.effectiveTo)
            ? "EXPIRED"
            : "EFFECTIVE"
        : "UNASSESSED",
  };
}
