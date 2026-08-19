import type {
  ExecutivePolicy,
  PolicyEngine,
  PolicyFinding,
  PolicyLibrary,
} from "./types";

export function createPolicy(policy: ExecutivePolicy): ExecutivePolicy {
  return { ...policy, alliedRoles: [...policy.alliedRoles] };
}

export function createPolicyEngine(input: PolicyEngine): PolicyEngine {
  return {
    library: [...input.library],
    findings: [...input.findings],
  };
}

export function emptyPolicyEngine(): PolicyEngine {
  return createPolicyEngine({ library: [], findings: [] });
}

export function policiesForOwner(
  library: PolicyLibrary,
  owner: ExecutivePolicy["owner"],
) {
  return library.filter((policy) => policy.owner === owner);
}

export function findPolicy(library: PolicyLibrary, id: string) {
  return library.find((policy) => policy.id === id);
}

export function actionableFindings(findings: PolicyFinding[] | unknown) {
  if (!Array.isArray(findings)) {
    return [];
  }

  return findings.filter(
    (finding) => finding.status === "breach" || finding.status === "watch",
  );
}

export function findingsForPolicy(findings: PolicyFinding[], policyId: string) {
  return findings.filter((finding) => finding.policyId === policyId);
}

export function findingsForVenture(findings: PolicyFinding[], ventureId: string) {
  return findings.filter((finding) => finding.ventureId === ventureId);
}
