import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { BlobStorageAdapter } from "./types";
import { StoredObjectError } from "./errors";

function storageRoot() {
  const configured = process.env.STORED_OBJECT_ROOT?.trim();
  if (configured) {
    return resolve(configured);
  }
  return resolve(process.cwd(), "data/objects");
}

function resolveObjectPath(storageKey: string) {
  const root = resolve(storageRoot());
  const parts = storageKey.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new StoredObjectError("VALIDATION", "Invalid storage key shape.");
  }
  const full = resolve(root, ...parts);
  if (full !== root && !full.startsWith(root + sep)) {
    throw new StoredObjectError("VALIDATION", "Storage key escapes the object root.");
  }
  return full;
}

export function createLocalBlobStorageAdapter(): BlobStorageAdapter {
  return {
    async put(storageKey, body) {
      const path = resolveObjectPath(storageKey);
      await mkdir(dirname(path), { recursive: true });
      const tempPath = `${path}.tmp`;
      try {
        await writeFile(tempPath, body);
        await rename(tempPath, path);
      } catch (error) {
        await rm(tempPath, { force: true });
        const detail = error instanceof Error ? error.message : "unknown error";
        throw new StoredObjectError("STORAGE", `Could not write object bytes: ${detail}`);
      }
    },
    async get(storageKey) {
      const path = resolveObjectPath(storageKey);
      try {
        const body = await readFile(path);
        return new Uint8Array(body);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          return null;
        }
        const detail = error instanceof Error ? error.message : "unknown error";
        throw new StoredObjectError("STORAGE", `Could not read object bytes: ${detail}`);
      }
    },
    async delete(storageKey) {
      const path = resolveObjectPath(storageKey);
      try {
        await rm(path, { force: true });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown error";
        throw new StoredObjectError("STORAGE", `Could not delete object bytes: ${detail}`);
      }
    },
    async exists(storageKey) {
      const path = resolveObjectPath(storageKey);
      try {
        await readFile(path);
        return true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          return false;
        }
        const detail = error instanceof Error ? error.message : "unknown error";
        throw new StoredObjectError("STORAGE", `Could not check object bytes: ${detail}`);
      }
    },
  };
}
