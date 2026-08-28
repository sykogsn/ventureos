export const WORKFORCE_VERIFICATION_LANGUAGE =
  "Verified means VentureOS independently observed the intended execution state. It does not mean the AI judgement is correct, complete, or regulator-accepted.";

export type WorkforceDeskState =
  | "workspace-required"
  | "unauthorised"
  | "company-required"
  | "ready";

export function resolveWorkforceDeskState(input: {
  hasWorkspace: boolean;
  canOperate: boolean;
  companyCount: number;
}): WorkforceDeskState {
  if (!input.hasWorkspace) {
    return "workspace-required";
  }
  if (!input.canOperate) {
    return "unauthorised";
  }
  if (input.companyCount < 1) {
    return "company-required";
  }
  return "ready";
}
