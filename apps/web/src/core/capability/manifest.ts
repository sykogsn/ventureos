import { isCapabilityContract } from "./contracts";
import { isCapabilityLifecycle } from "./lifecycle";
import { createCapability } from "./model";
import { isCapabilityClassification } from "./taxonomy";
import type {
  Capability,
  CapabilityManifest,
  CapabilityProvenance,
  CapabilityProvenanceContext,
} from "./types";

const SEMVER = /^\d+\.\d+\.\d+$/;

export function validateManifest(input: CapabilityManifest): Capability {
  if (!input.id.trim()) {
    throw new Error("Capability id is required.");
  }
  if (!input.name.trim()) {
    throw new Error(`Capability ${input.id} is missing a name.`);
  }
  if (!input.purpose.trim()) {
    throw new Error(`Capability ${input.id} is missing a purpose.`);
  }
  if (!input.owner.trim()) {
    throw new Error(`Capability ${input.id} is missing an owner.`);
  }
  if (!SEMVER.test(input.version)) {
    throw new Error(`Capability ${input.id} has an invalid version.`);
  }
  if (!isCapabilityClassification(input.classification)) {
    throw new Error(`Capability ${input.id} has an invalid classification.`);
  }
  if (!isCapabilityLifecycle(input.lifecycle)) {
    throw new Error(`Capability ${input.id} has an invalid lifecycle status.`);
  }
  for (const token of [...input.provides, ...input.requires]) {
    if (!isCapabilityContract(token)) {
      throw new Error(
        `Capability ${input.id} references an unknown contract: ${token}.`,
      );
    }
  }
  if (input.provenance) assertCapabilityProvenanceShape(input.provenance);
  return createCapability(input);
}

function requireProvenance(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error("Capability provenance: " + message);
}
function provenanceText(value: string) {
  requireProvenance(
    typeof value === "string" && value.trim().length > 0,
    "missing text reference.",
  );
}
function provenanceTime(value: string): number {
  requireProvenance(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value),
    "explicit UTC timestamp required.",
  );
  const time = Date.parse(value);
  requireProvenance(
    Number.isFinite(time) &&
      new Date(time).toISOString().replace(".000Z", "Z") ===
        value.replace(".000Z", "Z"),
    "invalid time.",
  );
  return time;
}
function provenanceIds(values: string[]) {
  values.forEach(provenanceText);
}

export function assertCapabilityProvenanceShape(p: CapabilityProvenance) {
  provenanceText(p.origin.workspaceId);
  provenanceText(p.origin.ventureId);
  provenanceText(p.origin.sourceRef);
  requireProvenance(
    p.implementationRefs.length > 0,
    "implementation reference required.",
  );
  for (const ref of p.implementationRefs) {
    provenanceText(ref.id);
    provenanceText(ref.version);
  }
  for (const ref of p.dependencyRefs) {
    provenanceText(ref.capabilityId);
    provenanceText(ref.version);
  }
  provenanceIds(p.performanceEvidenceIds);
  provenanceIds(p.learningIds);
  provenanceIds(p.reuseEvidenceIds);
  const ids = new Set<string>();
  for (const c of p.validationContexts) {
    provenanceText(c.id);
    requireProvenance(!ids.has(c.id), "duplicate validation context.");
    ids.add(c.id);
    provenanceText(c.workspaceId);
    provenanceText(c.ventureId);
    provenanceTime(c.at);
    provenanceText(c.implementationVersion);
    provenanceIds(c.evidenceIds);
    requireProvenance(
      c.evidenceIds.length > 0,
      "validation evidence required.",
    );
    requireProvenance(
      ["SUPPORTED", "CHALLENGED", "INCONCLUSIVE"].includes(c.result),
      "invalid validation result.",
    );
  }
  const a = p.reuseAssessment;
  requireProvenance(
    ["DOMAIN_SPECIFIC", "REUSABLE_CAPABILITY_CANDIDATE"].includes(
      a.classification,
    ),
    "invalid reuse classification.",
  );
  provenanceText(a.rationale);
  provenanceText(a.proposedBy);
  provenanceTime(a.at);
  if (p.promotionAuthority) {
    provenanceText(p.promotionAuthority.reference);
    provenanceText(p.promotionAuthority.actor);
    provenanceTime(p.promotionAuthority.at);
    provenanceIds(p.promotionAuthority.evidenceIds);
    requireProvenance(
      p.promotionAuthority.evidenceIds.length > 0,
      "promotion authority requires evidence.",
    );
  }
}

/** Checks only supplied structural resolutions; never performs promotion or permission enforcement. */
export function assessCapabilityReuse(
  capability: Capability,
  context: CapabilityProvenanceContext,
  evaluationTime: string,
): {
  classification:
    | "UNASSESSED"
    | "DOMAIN_SPECIFIC"
    | "REUSABLE_CAPABILITY_CANDIDATE";
  candidate: boolean;
  promotionEligible: boolean;
  reasons: string[];
} {
  const now = provenanceTime(evaluationTime);
  const p = capability.provenance;
  if (!p)
    return {
      classification: "UNASSESSED",
      candidate: false,
      promotionEligible: false,
      reasons: ["No provenance."],
    };
  assertCapabilityProvenanceShape(p);
  const resolve = (id: string, kind: "Evidence" | "Learning") => {
    const matches = context.references.filter((r) => r.id === id);
    requireProvenance(
      matches.length === 1 && matches[0]!.kind === kind,
      "missing, duplicate or wrong-type reference " + id,
    );
    const ref = matches[0]!;
    provenanceText(ref.workspaceId);
    provenanceText(ref.ventureId);
    requireProvenance(
      ref.workspaceId === p.origin.workspaceId,
      "cross-workspace reference.",
    );
    requireProvenance(
      ref.ventureId === p.origin.ventureId ||
        p.validationContexts.some(
          (c) =>
            c.workspaceId === ref.workspaceId && c.ventureId === ref.ventureId,
        ),
      "reference outside declared validation scope.",
    );
    return ref;
  };
  const roots = (ids: string[]) =>
    [
      ...new Set(
        ids.flatMap((id) => {
          resolve(id, "Evidence");
          const matches = context.evidenceOrigins.filter(
            (r) => r.evidenceId === id,
          );
          requireProvenance(
            matches.length === 1 && matches[0]!.originKeys.length > 0,
            "missing or ambiguous source origins.",
          );
          provenanceIds(matches[0]!.originKeys);
          return matches[0]!.originKeys;
        }),
      ),
    ].sort();
  requireProvenance(
    provenanceTime(p.reuseAssessment.at) <= now,
    "future reuse assessment.",
  );
  for (const dep of p.dependencyRefs) {
    requireProvenance(
      capability.dependencies.includes(dep.capabilityId),
      "dependency not declared by manifest.",
    );
    requireProvenance(
      context.capabilities.filter(
        (c) => c.id === dep.capabilityId && c.version === dep.version,
      ).length === 1,
      "unresolved dependency version.",
    );
  }
  requireProvenance(
    capability.dependencies.every((id) =>
      p.dependencyRefs.some((r) => r.capabilityId === id),
    ),
    "missing dependency provenance.",
  );
  for (const id of p.learningIds) resolve(id, "Learning");
  roots(p.performanceEvidenceIds);
  roots(p.reuseEvidenceIds);
  for (const c of p.validationContexts) {
    requireProvenance(
      c.workspaceId === p.origin.workspaceId,
      "cross-workspace validation context.",
    );
    requireProvenance(
      provenanceTime(c.at) <= provenanceTime(p.reuseAssessment.at),
      "validation after reuse assessment.",
    );
    requireProvenance(
      p.implementationRefs.some((r) => r.version === c.implementationVersion),
      "unresolved implementation version.",
    );
    for (const id of c.evidenceIds) {
      const ref = resolve(id, "Evidence");
      requireProvenance(
        ref.workspaceId === c.workspaceId && ref.ventureId === c.ventureId,
        "evidence outside validation context.",
      );
    }
    roots(c.evidenceIds);
  }
  requireProvenance(
    p.implementationRefs.some((r) => r.version === capability.version),
    "assessed implementation version is unresolved.",
  );
  const reasons: string[] = [];
  if (p.reuseAssessment.classification !== "REUSABLE_CAPABILITY_CANDIDATE")
    reasons.push("Domain-specific assessment.");
  if (!p.performanceEvidenceIds.length || !p.reuseEvidenceIds.length)
    reasons.push("Performance and reuse evidence required.");
  const supported = p.validationContexts.filter(
    (c) =>
      c.result === "SUPPORTED" &&
      c.implementationVersion === capability.version,
  );
  const independentOrigins = roots(
    supported.flatMap((c) =>
      c.evidenceIds.filter((id) => p.reuseEvidenceIds.includes(id)),
    ),
  );
  if (independentOrigins.length < 2)
    reasons.push(
      "Independent underlying evidence origins required for this version.",
    );
  if (p.validationContexts.some((c) => c.result === "CHALLENGED"))
    reasons.push("Unresolved validation challenge.");
  const validatedIds = new Set(supported.flatMap((c) => c.evidenceIds));
  if (
    [...p.performanceEvidenceIds, ...p.reuseEvidenceIds].some(
      (id) => !validatedIds.has(id),
    )
  )
    reasons.push("Evidence lacks supported validation context.");
  const candidate = reasons.length === 0;
  const authority = p.promotionAuthority;
  if (authority) {
    requireProvenance(
      provenanceTime(authority.at) >= provenanceTime(p.reuseAssessment.at) &&
        provenanceTime(authority.at) <= now,
      "invalid promotion authority time.",
    );
    roots(authority.evidenceIds);
    requireProvenance(
      authority.evidenceIds.every((id) => p.reuseEvidenceIds.includes(id)),
      "authority evidence outside reuse assessment.",
    );
  } else reasons.push("Explicit promotion authority required.");
  return {
    classification: p.reuseAssessment.classification,
    candidate,
    promotionEligible: candidate && !!authority,
    reasons,
  };
}
