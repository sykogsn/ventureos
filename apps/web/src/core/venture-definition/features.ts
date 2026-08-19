export const VENTURE_FEATURES = [
  "situation-room",
  "company-hq",
  "executive-office",
  "founder-decisions",
  "morning-briefing",
  "portfolio",
] as const;

export type VentureFeature = (typeof VENTURE_FEATURES)[number];

export function isVentureFeature(value: string): value is VentureFeature {
  return (VENTURE_FEATURES as readonly string[]).includes(value);
}
