/**
 * Programme-control runtime gate for Frigora F3.3 offline field capability.
 *
 * F3.3 implementation is intentionally preserved in repository history while
 * F3.2 is the active milestone. Runtime activation requires an explicit
 * Control-authorised code change; it must not be enabled by environment,
 * browser state, query parameters, or user preference.
 */
export const FRIGORA_F33_OFFLINE_RUNTIME_ENABLED = false as const;
