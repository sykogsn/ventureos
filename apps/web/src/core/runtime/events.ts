import {
  COMPANY_FOUNDED,
  FOUNDER_DECISION_RECORDED,
  INTELLIGENCE_REFRESH,
  type CompanyFounded,
  type FounderDecisionRecorded,
  type IntelligenceRefresh,
} from "./types";
import type { Venture } from "../venture/types";

export function createIntelligenceRefresh(
  occurredAt: string,
): IntelligenceRefresh {
  return {
    type: INTELLIGENCE_REFRESH,
    occurredAt,
  };
}

export function createFounderDecisionRecorded(
  input: Omit<FounderDecisionRecorded, "type">,
): FounderDecisionRecorded {
  return {
    type: FOUNDER_DECISION_RECORDED,
    occurredAt: input.occurredAt,
    decisionId: input.decisionId,
    ventureId: input.ventureId,
    ruling: input.ruling.trim(),
    result: input.result?.trim() || undefined,
  };
}

export function createCompanyFounded(
  input: Omit<CompanyFounded, "type"> & { venture: Venture },
): CompanyFounded {
  return {
    type: COMPANY_FOUNDED,
    occurredAt: input.occurredAt,
    venture: input.venture,
  };
}
