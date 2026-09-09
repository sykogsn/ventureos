/**
 * Closure-private singleton kernel for domain-authorized storage issuance.
 * Does not expose the underlying WeakSet.
 */
export function markIssued(authority: object): void;
export function isIssued(authority: unknown): boolean;
