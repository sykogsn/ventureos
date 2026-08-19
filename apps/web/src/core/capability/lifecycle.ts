export const CAPABILITY_LIFECYCLE = [
  "experimental",
  "internal",
  "shared",
  "stable",
  "deprecated",
] as const;

export type CapabilityLifecycle = (typeof CAPABILITY_LIFECYCLE)[number];

const FORWARD = [
  "experimental",
  "internal",
  "shared",
  "stable",
] as const;

export function isCapabilityLifecycle(value: string): value is CapabilityLifecycle {
  return (CAPABILITY_LIFECYCLE as readonly string[]).includes(value);
}

export function canTransitionLifecycle(
  from: CapabilityLifecycle,
  to: CapabilityLifecycle,
): boolean {
  if (from === to) {
    return true;
  }
  if (from === "deprecated") {
    return false;
  }
  if (to === "deprecated") {
    return true;
  }
  const fromIndex = FORWARD.indexOf(from as (typeof FORWARD)[number]);
  const toIndex = FORWARD.indexOf(to as (typeof FORWARD)[number]);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

export function assertLifecycleTransition(
  from: CapabilityLifecycle,
  to: CapabilityLifecycle,
): void {
  if (!canTransitionLifecycle(from, to)) {
    throw new Error(`Invalid capability lifecycle transition: ${from} → ${to}.`);
  }
}
