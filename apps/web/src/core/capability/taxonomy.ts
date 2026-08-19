export const CAPABILITY_CLASSIFICATIONS = [
  "Intelligence",
  "Governance",
  "Platform",
  "Data",
  "AI",
  "Security",
  "Communication",
  "Infrastructure",
] as const;

export type CapabilityClassification = (typeof CAPABILITY_CLASSIFICATIONS)[number];

export function isCapabilityClassification(
  value: string,
): value is CapabilityClassification {
  return (CAPABILITY_CLASSIFICATIONS as readonly string[]).includes(value);
}
