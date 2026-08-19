import type { VentureIntelligenceCore } from "../venture/types";
import { executivePolicyCatalog } from "./catalog";
import { evaluatePolicies } from "./evaluation";

export const executivePolicyLibraryMock = executivePolicyCatalog;

export function policyFindingsFrom(core: VentureIntelligenceCore) {
  if (core.policy.library.length > 0) {
    return core.policy.findings;
  }

  return evaluatePolicies(core, executivePolicyLibraryMock);
}
