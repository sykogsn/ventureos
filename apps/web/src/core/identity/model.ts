import type { CompanyIdentity, FounderIdentity } from "./types";

export function createFounderIdentity(
  input: FounderIdentity,
): FounderIdentity {
  return { ...input };
}

export function createCompanyIdentity(
  input: CompanyIdentity,
): CompanyIdentity {
  return { ...input };
}

export function displayName(identity: CompanyIdentity | FounderIdentity) {
  return identity.name;
}
