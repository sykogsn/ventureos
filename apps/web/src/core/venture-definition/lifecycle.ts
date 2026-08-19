export const VENTURE_LIFECYCLE = [
  "concept",
  "incubating",
  "operating",
  "scaling",
  "sunset",
] as const;

export type VentureLifecycle = (typeof VENTURE_LIFECYCLE)[number];

const FORWARD = ["concept", "incubating", "operating", "scaling"] as const;

export function isVentureLifecycle(value: string): value is VentureLifecycle {
  return (VENTURE_LIFECYCLE as readonly string[]).includes(value);
}

export function canTransitionVentureLifecycle(
  from: VentureLifecycle,
  to: VentureLifecycle,
): boolean {
  if (from === to) {
    return true;
  }
  if (from === "sunset") {
    return false;
  }
  if (to === "sunset") {
    return true;
  }
  const fromIndex = FORWARD.indexOf(from as (typeof FORWARD)[number]);
  const toIndex = FORWARD.indexOf(to as (typeof FORWARD)[number]);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

export function assertVentureLifecycleTransition(
  from: VentureLifecycle,
  to: VentureLifecycle,
): void {
  if (!canTransitionVentureLifecycle(from, to)) {
    throw new Error(`Invalid venture lifecycle transition: ${from} → ${to}.`);
  }
}
