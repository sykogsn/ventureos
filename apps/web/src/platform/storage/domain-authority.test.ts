import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import type { DomainAuthorizedMutation } from "@/contracts";
import { StoredObjectError } from "./errors";
import {
  issueDomainAuthorizedMutation,
  isIssuedDomainAuthority,
  requireIssuedDomainAuthority,
} from "./domain-authority";

const REGISTRY_KEY = "ventureos.storage.issuedDomainAuthorizedMutation.registry";

describe("domain-authorized mutation singleton kernel", () => {
  it("accepts a legitimately issued frigora assigned_work_order authority", () => {
    const authority = issueDomainAuthorizedMutation({
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: "work-order-1",
    });
    assert.equal(isIssuedDomainAuthority(authority), true);
    assert.equal(requireIssuedDomainAuthority(authority), authority);
  });

  it("rejects shape-only forgery with matching domain/relation/resourceId", () => {
    const forged = {
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: "work-order-1",
    } as DomainAuthorizedMutation;
    assert.equal(isIssuedDomainAuthority(forged), false);
    assert.throws(
      () => requireIssuedDomainAuthority(forged),
      (error: unknown) =>
        error instanceof StoredObjectError &&
        error.code === "FORBIDDEN" &&
        /issued mutation authority/.test(error.message),
    );
  });

  it("exposes no live mutable registry via Symbol.for / globalThis", () => {
    const key = Symbol.for(REGISTRY_KEY);
    const slot = (globalThis as typeof globalThis & Record<symbol, unknown>)[key];
    assert.equal(slot, undefined);

    const forged = {
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: "global-discovery-forge",
    } as DomainAuthorizedMutation;
    // Even if an attacker creates a fake registry slot, the live kernel ignores it.
    (globalThis as typeof globalThis & Record<symbol, { issued: WeakSet<object> }>)[key] = {
      issued: new WeakSet<object>(),
    };
    (globalThis as typeof globalThis & Record<symbol, { issued: WeakSet<object> }>)[key]!.issued.add(
      forged,
    );
    assert.equal(isIssuedDomainAuthority(forged), false);
    assert.throws(
      () => requireIssuedDomainAuthority(forged),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
    delete (globalThis as typeof globalThis & Record<symbol, unknown>)[key];
  });

  it("rejects wrong relation and unregistered domain at issuance", () => {
    assert.throws(
      () =>
        issueDomainAuthorizedMutation({
          domain: "frigora",
          relation: "workspace_member",
          resourceId: "work-order-1",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
    assert.throws(
      () =>
        issueDomainAuthorizedMutation({
          domain: "unknown-domain",
          relation: "assigned_work_order",
          resourceId: "work-order-1",
        }),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
  });

  it("shares one Node-cached kernel across duplicate require identities", () => {
    const requireFromHere = createRequire(import.meta.url);
    const kernelPath = requireFromHere.resolve("@repo/storage-authority-kernel");
    const kernelA = requireFromHere(kernelPath) as {
      markIssued: (a: object) => void;
      isIssued: (a: unknown) => boolean;
    };
    const requireFromFileUrl = createRequire(pathToFileURL(kernelPath).href);
    const kernelB = requireFromFileUrl(kernelPath) as {
      markIssued: (a: object) => void;
      isIssued: (a: unknown) => boolean;
    };
    assert.equal(kernelA, kernelB);

    const authority = Object.freeze({
      domain: "frigora",
      relation: "assigned_work_order",
      resourceId: "kernel-singleton-probe",
    });
    kernelA.markIssued(authority);
    assert.equal(kernelB.isIssued(authority), true);
    assert.equal(isIssuedDomainAuthority(authority as DomainAuthorizedMutation), true);
    // Kernel API does not export the WeakSet.
    assert.equal(
      Object.keys(kernelA).sort().join(","),
      "isIssued,markIssued",
    );
  });

  it("does not place reconstructible registry state on process", () => {
    const suspicious = Object.getOwnPropertyNames(process).filter((name) =>
      /authority|issuedDomain|storage.*registry/i.test(name),
    );
    assert.deepEqual(suspicious, []);
  });
});
