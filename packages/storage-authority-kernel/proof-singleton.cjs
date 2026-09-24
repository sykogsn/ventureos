"use strict";

/**
 * Bounded proof that does not require the full apps/web tsx graph.
 * Exercises @repo/storage-authority-kernel singleton + forge resistance.
 */
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");

const requireFromHere = createRequire(__filename);
const kernelPath = requireFromHere.resolve("@repo/storage-authority-kernel");
const kernelA = requireFromHere(kernelPath);
const kernelB = requireFromHere(kernelPath);

assert.equal(kernelA, kernelB, "Node module cache must return one kernel export object");
assert.deepEqual(Object.keys(kernelA).sort(), ["isIssued", "markIssued"]);
assert.equal(kernelA.issuedAuthorities, undefined);
assert.equal(kernelA.WeakSet, undefined);

const legitimate = Object.freeze({
  domain: "frigora",
  relation: "assigned_work_order",
  resourceId: "kernel-proof-1",
});
kernelA.markIssued(legitimate);
assert.equal(kernelB.isIssued(legitimate), true);

const forged = {
  domain: "frigora",
  relation: "assigned_work_order",
  resourceId: "kernel-proof-1",
};
assert.equal(kernelA.isIssued(forged), false);

const key = Symbol.for("ventureos.storage.issuedDomainAuthorizedMutation.registry");
assert.equal(globalThis[key], undefined);
globalThis[key] = { issued: new WeakSet() };
globalThis[key].issued.add(forged);
assert.equal(kernelA.isIssued(forged), false, "globalThis injection must not affect kernel");
delete globalThis[key];

assert.equal(globalThis[key], undefined);

console.log(
  JSON.stringify(
    {
      ok: true,
      kernelPath,
      singleton: kernelA === kernelB,
      exports: Object.keys(kernelA).sort(),
      legitimateAccepted: true,
      shapeForgeryRejected: true,
      globalRegistryAbsent: true,
      globalInjectionIneffective: true,
    },
    null,
    2,
  ),
);
