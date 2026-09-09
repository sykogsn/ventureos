/**
 * Production-bundle regression for F2.3-RPV-001 (singleton kernel).
 *
 * After a production compile of apps/web:
 *   node --import tsx scripts/verify-domain-authority-production-bundle.mts
 *
 * Proves:
 * 1) rejected globalThis Symbol.for registry is absent
 * 2) kernel WeakSet body is not inlined into duplicated chunks
 * 3) createRequire("@repo/storage-authority-kernel") remains for Node cache
 * 4) legitimate issue/require works; shape + globalThis forgery rejected
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  issueDomainAuthorizedMutation,
  isIssuedDomainAuthority,
  requireIssuedDomainAuthority,
} from "../src/platform/storage/domain-authority.ts";
import { StoredObjectError } from "../src/platform/storage/errors.ts";
import type { DomainAuthorizedMutation } from "../src/contracts/index.ts";

const REJECTED_REGISTRY_KEY =
  'Symbol.for("ventureos.storage.issuedDomainAuthorizedMutation.registry")';
const KERNEL_PACKAGE = "@repo/storage-authority-kernel";

function listJsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) listJsFiles(full, out);
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}

async function main() {
  const cwd = process.cwd();
  const serverRoot = join(cwd, ".next", "server");
  const files = listJsFiles(serverRoot);
  assert.ok(files.length > 0, "expected production Next server build under .next/server");

  let rejectedRegistryRefs = 0;
  let privateSealRefs = 0;
  let externalKernelRequireRefs = 0;
  let inlinedWeakSetKernels = 0;
  const externalFiles: string[] = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    rejectedRegistryRefs += text.split(REJECTED_REGISTRY_KEY).length - 1;
    privateSealRefs +=
      text.split('Symbol("ventureos.storage.issuedDomainAuthorizedMutation")').length - 1;

    if (text.includes(KERNEL_PACKAGE) && text.includes("createRequire")) {
      externalKernelRequireRefs += 1;
      externalFiles.push(relative(cwd, file).replaceAll("\\", "/"));
    }

    if (/new WeakSet[\s\S]{0,120}markIssued/.test(text)) {
      inlinedWeakSetKernels += 1;
    }
  }

  assert.equal(rejectedRegistryRefs, 0, "rejected globalThis registry still in bundle");
  assert.equal(privateSealRefs, 0, "private Symbol seal still in bundle");
  assert.equal(
    inlinedWeakSetKernels,
    0,
    `kernel WeakSet inlined into ${inlinedWeakSetKernels} chunks — singleton defeated`,
  );
  assert.ok(
    externalKernelRequireRefs > 0,
    "expected createRequire load of @repo/storage-authority-kernel in server chunks",
  );

  const require = createRequire(import.meta.url);
  const kernelPath = require.resolve(KERNEL_PACKAGE);
  const kernelA = require(kernelPath);
  const kernelB = require(kernelPath);
  assert.equal(kernelA, kernelB);

  const issued = issueDomainAuthorizedMutation({
    domain: "frigora",
    relation: "assigned_work_order",
    resourceId: "bundle-proof-work-order",
  });
  assert.equal(isIssuedDomainAuthority(issued), true);
  requireIssuedDomainAuthority(issued);

  const forged = {
    domain: "frigora",
    relation: "assigned_work_order",
    resourceId: "bundle-proof-work-order",
  } as DomainAuthorizedMutation;
  assert.throws(
    () => requireIssuedDomainAuthority(forged),
    (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
  );

  const key = Symbol.for("ventureos.storage.issuedDomainAuthorizedMutation.registry");
  const globalScope = globalThis as typeof globalThis & {
    [key: symbol]: { issued: WeakSet<object> } | undefined;
  };
  globalScope[key] = { issued: new WeakSet<object>() };
  globalScope[key]!.issued.add(forged);
  try {
    assert.throws(
      () => requireIssuedDomainAuthority(forged),
      (error: unknown) => error instanceof StoredObjectError && error.code === "FORBIDDEN",
    );
  } finally {
    delete globalScope[key];
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        serverJsFiles: files.length,
        rejectedRegistryRefs,
        privateSealRefs,
        externalKernelRequireRefs,
        inlinedWeakSetKernels,
        externalFiles: [...new Set(externalFiles)],
        kernelModulePath: kernelPath,
        kernelSingletonIdentity: kernelA === kernelB,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
