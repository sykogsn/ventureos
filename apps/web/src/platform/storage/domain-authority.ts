import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DomainAuthorizedMutation } from "@/contracts";
import { platformVentureRegistry } from "@/core/venture-definition/catalog";
import type { AuditLog } from "@/platform/audit/log";
import { StoredObjectError } from "./errors";

type AuthorityKernel = {
  markIssued: (authority: object) => void;
  isIssued: (authority: unknown) => boolean;
};

/**
 * Build the package name at runtime so Turbopack cannot statically resolve and
 * inline the CJS kernel (which duplicated WeakSet state per chunk).
 */
function storageAuthorityKernelId(): string {
  return ["@", "repo", "/", "storage", "-", "authority", "-", "kernel"].join("");
}

function loadAuthorityKernel(): AuthorityKernel {
  const requireFromHere = createRequire(fileURLToPath(import.meta.url));
  const packageId = storageAuthorityKernelId();

  try {
    return requireFromHere(packageId) as AuthorityKernel;
  } catch {
    // Fall back to explicit on-disk paths for unusual cwd layouts.
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "node_modules", "@repo", "storage-authority-kernel", "index.cjs"),
    join(process.cwd(), "..", "..", "packages", "storage-authority-kernel", "index.cjs"),
    join(here, "..", "..", "..", "..", "packages", "storage-authority-kernel", "index.cjs"),
  ];
  for (const absolute of candidates) {
    if (!existsSync(absolute)) continue;
    return requireFromHere(absolute) as AuthorityKernel;
  }

  throw new Error("Could not load @repo/storage-authority-kernel singleton from disk.");
}

const kernel = loadAuthorityKernel();

/**
 * Domain-authorized mutation issuance.
 *
 * Issuance membership lives in `@repo/storage-authority-kernel`, a
 * closure-private WeakSet loaded through Node's module cache. Authority state
 * is NOT stored on globalThis / process under a reconstructible Symbol.for key.
 *
 * Do not put Frigora assignment evaluation here.
 */
const REGISTERED_DOMAIN_STORAGE_RELATIONS: Readonly<Record<string, readonly string[]>> = {
  frigora: ["assigned_work_order"],
};

export function issueDomainAuthorizedMutation(input: {
  domain: string;
  relation: string;
  resourceId: string;
}): DomainAuthorizedMutation {
  const issued = Object.freeze({
    domain: input.domain,
    relation: input.relation,
    resourceId: input.resourceId,
  });
  assertRegisteredDomainAuthority(issued);
  kernel.markIssued(issued);
  return issued;
}

export function requireIssuedDomainAuthority(
  authority: DomainAuthorizedMutation,
): DomainAuthorizedMutation {
  if (!isIssuedDomainAuthority(authority)) {
    throw new StoredObjectError(
      "FORBIDDEN",
      "Domain-authorized storage requires issued mutation authority.",
    );
  }
  assertRegisteredDomainAuthority(authority);
  return authority;
}

export function isIssuedDomainAuthority(
  authority: DomainAuthorizedMutation,
): authority is DomainAuthorizedMutation {
  return kernel.isIssued(authority);
}

export function assertRegisteredDomainAuthority(authority: DomainAuthorizedMutation) {
  const domain = authority.domain.trim();
  const relation = authority.relation.trim();
  const resourceId = authority.resourceId.trim();
  if (!domain || !relation || !resourceId) {
    throw new StoredObjectError(
      "FORBIDDEN",
      "Domain-authorized storage requires a venture and relationship provenance.",
    );
  }
  if (!platformVentureRegistry.get(domain)) {
    throw new StoredObjectError(
      "FORBIDDEN",
      "Domain-authorized storage requires a registered venture domain.",
    );
  }
  const relations = REGISTERED_DOMAIN_STORAGE_RELATIONS[domain];
  if (!relations?.includes(relation)) {
    throw new StoredObjectError(
      "FORBIDDEN",
      "Domain-authorized storage relation is not registered for this domain.",
    );
  }
  if (
    authority.domain !== domain ||
    authority.relation !== relation ||
    authority.resourceId !== resourceId
  ) {
    throw new StoredObjectError(
      "FORBIDDEN",
      "Domain-authorized storage requires exact registered authority values.",
    );
  }
}

export async function findStoredObjectIssuedAuthority(
  audit: AuditLog,
  objectId: string,
): Promise<DomainAuthorizedMutation | null> {
  const created = (await audit.list()).filter(
    (record) =>
      record.action === "stored_object.created" &&
      record.metadata?.storedObjectId === objectId,
  );
  const latest = created[created.length - 1];
  const domain = latest?.metadata?.authorityDomain;
  const relation = latest?.metadata?.authorityRelation;
  const resourceId = latest?.metadata?.authorityResourceId;
  if (!domain || !relation || !resourceId) {
    return null;
  }
  return { domain, relation, resourceId };
}

export function authoritiesBindSameResource(
  left: DomainAuthorizedMutation,
  right: DomainAuthorizedMutation,
) {
  return (
    left.domain === right.domain &&
    left.relation === right.relation &&
    left.resourceId === right.resourceId
  );
}
