"use strict";

/**
 * Closure-private issuance registry.
 *
 * Loaded via Node's module cache (and Next serverExternalPackages) so every
 * server chunk shares ONE WeakSet. The set itself is never exported and never
 * placed on globalThis / process under a reconstructible key.
 */

const issuedAuthorities = new WeakSet();

/**
 * @param {object} authority
 */
function markIssued(authority) {
  if (authority === null || typeof authority !== "object") {
    throw new TypeError("Issued authority must be a non-null object.");
  }
  issuedAuthorities.add(authority);
}

/**
 * @param {unknown} authority
 * @returns {boolean}
 */
function isIssued(authority) {
  return (
    typeof authority === "object" &&
    authority !== null &&
    issuedAuthorities.has(/** @type {object} */ (authority))
  );
}

module.exports = {
  markIssued,
  isIssued,
};
