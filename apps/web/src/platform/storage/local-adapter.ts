import { randomUUID } from "node:crypto";
import { lstatSync, mkdirSync, realpathSync } from "node:fs";
import { link, open, readFile, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { assertProductionObjectRoot } from "@/platform/runtime/production-process-contract";
import type { BlobStorageAdapter } from "./types";
import { StoredObjectError } from "./errors";

/**
 * Containment is check-then-use. Node's filesystem API does not pin a directory
 * against a concurrent replacement by a junction. A second writer with access
 * to this directory can still win that race. Production mitigation is one
 * application user and one process with exclusive write access to the object
 * directory. This adapter does not claim protection against that race.
 */
const CONTAINMENT_MESSAGE = "Storage path is not contained.";

function storageRoot() {
  if (process.env.NODE_ENV === "production") {
    return assertProductionObjectRoot();
  }
  const configured = process.env.STORED_OBJECT_ROOT?.trim();
  if (configured) {
    return resolve(configured);
  }
  return resolve(process.cwd(), "data/objects");
}

function containedRoot() {
  const root = resolve(storageRoot());
  const listing = safeLstat(root);
  if (!listing || listing.isSymbolicLink() || !listing.isDirectory()) {
    throw new StoredObjectError("STORAGE", CONTAINMENT_MESSAGE);
  }
  const real = safeRealpath(root);
  if (!real || !samePath(real, root) || !safeLstat(real)?.isDirectory()) {
    throw new StoredObjectError("STORAGE", CONTAINMENT_MESSAGE);
  }
  return real;
}

function storageKeyParts(storageKey: string) {
  if (
    storageKey.length === 0 ||
    storageKey.length > 512 ||
    storageKey.startsWith("/") ||
    storageKey.includes("\\") ||
    storageKey.includes("\0") ||
    storageKey.includes("%") ||
    storageKey.includes("..")
  ) {
    throw new StoredObjectError("VALIDATION", "Invalid storage key shape.");
  }
  const parts = storageKey.split("/");
  const directoryName = parts[0];
  const fileName = parts[1];
  if (
    parts.length !== 2 ||
    !directoryName ||
    !fileName ||
    !/^[A-Za-z0-9_-]+$/.test(directoryName) ||
    !/^[A-Za-z0-9_-]+$/.test(fileName)
  ) {
    throw new StoredObjectError("VALIDATION", "Invalid storage key shape.");
  }
  return [directoryName, fileName] as const;
}

function resolveContainedPath(storageKey: string, allowMissingFile: boolean) {
  const root = containedRoot();
  const parts = storageKeyParts(storageKey);
  const directory = containDirectory(root, parts[0], allowMissingFile);
  if (!directory) {
    return { root, directory: null, filePath: null, missing: true as const };
  }
  const filePath = resolve(directory, parts[1]);
  if (!isInside(root, filePath)) {
    throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
  }
  const listing = safeLstat(filePath);
  if (!listing) {
    return { root, directory, filePath, missing: true as const };
  }
  if (listing.isSymbolicLink() || !listing.isFile()) {
    throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
  }
  const real = safeRealpath(filePath);
  if (!real || !samePath(real, filePath) || !isInside(root, real) || safeLstat(real)?.isSymbolicLink()) {
    throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
  }
  return { root, directory, filePath: real, missing: false as const };
}

function containDirectory(root: string, name: string, allowMissing: boolean) {
  const directory = resolve(root, name);
  if (!isInside(root, directory)) {
    throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
  }
  const listing = safeLstat(directory);
  if (!listing) {
    if (allowMissing) return null;
    throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
  }
  if (listing.isSymbolicLink() || !listing.isDirectory()) {
    throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
  }
  const real = safeRealpath(directory);
  if (!real || !samePath(real, directory) || !isInside(root, real) || safeLstat(real)?.isSymbolicLink() || !safeLstat(real)?.isDirectory()) {
    throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
  }
  return real;
}

function createObjectDirectory(root: string, name: string) {
  const existing = containDirectory(root, name, true);
  if (existing) return existing;
  const directory = resolve(root, name);
  try {
    mkdirSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw new StoredObjectError("STORAGE", CONTAINMENT_MESSAGE);
    }
  }
  const created = containDirectory(root, name, false);
  if (!created) throw new StoredObjectError("STORAGE", CONTAINMENT_MESSAGE);
  return created;
}

export function createLocalBlobStorageAdapter(): BlobStorageAdapter {
  return {
    async put(storageKey, body) {
      const root = containedRoot();
      const [directoryName, fileName] = storageKeyParts(storageKey);
      const directory = createObjectDirectory(root, directoryName);
      const path = resolve(directory, fileName);
      if (!isInside(root, path)) {
        throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
      }
      const existing = safeLstat(path);
      if (existing?.isSymbolicLink() || (existing && !existing.isFile())) {
        throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
      }
      const tempPath = resolve(directory, `${fileName}.${randomUUID()}.tmp`);
      if (!isInside(root, tempPath)) {
        throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
      }
      try {
        const confirmedDirectory = containDirectory(root, directoryName, false);
        if (!confirmedDirectory || !samePath(confirmedDirectory, directory)) {
          throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
        }
        const file = await open(tempPath, "wx");
        try { await file.writeFile(body); await file.sync(); } finally { await file.close(); }
        const published = safeLstat(path);
        if (published?.isSymbolicLink()) {
          throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
        }
        try {
          await link(tempPath, path);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          if (safeLstat(path)?.isSymbolicLink() !== false) {
            throw new StoredObjectError("VALIDATION", CONTAINMENT_MESSAGE);
          }
          const current = await readFile(path);
          if (!current.equals(Buffer.from(body))) throw new Error("Storage key already contains different bytes");
        }
        await rm(tempPath, { force: true });
      } catch (error) {
        await rm(tempPath, { force: true });
        if (error instanceof StoredObjectError) throw error;
        const detail = error instanceof Error ? error.message : "unknown error";
        throw new StoredObjectError("STORAGE", `Could not write object bytes: ${detail}`);
      }
    },
    async get(storageKey) {
      const located = resolveContainedPath(storageKey, true);
      if (located.missing || !located.filePath) return null;
      try {
        const body = await readFile(located.filePath);
        return new Uint8Array(body);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") return null;
        throw new StoredObjectError("STORAGE", "Could not read object bytes.");
      }
    },
    async delete(storageKey) {
      const located = resolveContainedPath(storageKey, true);
      if (located.missing || !located.filePath) return;
      try {
        await rm(located.filePath, { force: true });
      } catch {
        throw new StoredObjectError("STORAGE", "Could not delete object bytes.");
      }
    },
    async exists(storageKey) {
      const located = resolveContainedPath(storageKey, true);
      return !located.missing;
    },
  };
}

function safeLstat(filePath: string) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new StoredObjectError("STORAGE", CONTAINMENT_MESSAGE);
  }
}

function safeRealpath(filePath: string) {
  try {
    return realpathSync(filePath);
  } catch {
    return null;
  }
}

function isInside(root: string, candidate: string) {
  const fromRoot = relative(root, candidate);
  if (fromRoot === "" || isAbsolute(fromRoot)) return false;
  return fromRoot.split(sep).every((part) => part !== ".." && part !== "");
}

function samePath(left: string, right: string) {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}
