import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { StoredObjectError } from "./errors";
import { createLocalBlobStorageAdapter } from "./local-adapter";

const previous = process.env.STORED_OBJECT_ROOT;

afterEach(() => {
  if (previous === undefined) delete process.env.STORED_OBJECT_ROOT;
  else process.env.STORED_OBJECT_ROOT = previous;
});

describe("stored object containment", () => {
  it("stores and reads a nested object inside the root", async () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-02-r1-ok-"));
    process.env.STORED_OBJECT_ROOT = root;
    const adapter = createLocalBlobStorageAdapter();
    const body = new Uint8Array([1, 2, 3]);
    await adapter.put("tenant/object", body);
    assert.deepEqual(await adapter.get("tenant/object"), body);
    assert.equal(await adapter.exists("tenant/object"), true);
    await adapter.delete("tenant/object");
    assert.equal(await adapter.exists("tenant/object"), false);
    assert.equal(existsSync(join(root, "tenant", "object")), false);
  });

  it("blocks the nested junction write escape", async () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-02-r1-junction-"));
    const outside = mkdtempSync(join(tmpdir(), "vos-host-02-r1-outside-"));
    process.env.STORED_OBJECT_ROOT = root;
    symlinkSync(outside, join(root, "aa"), "junction");
    const adapter = createLocalBlobStorageAdapter();
    await assert.rejects(adapter.put("aa/bb", new Uint8Array([7])), contained);
    assert.equal(existsSync(join(outside, "bb")), false);
    await assert.rejects(adapter.get("aa/bb"), contained);
    await assert.rejects(adapter.delete("aa/bb"), contained);
    assert.equal(existsSync(join(outside, "bb")), false);
  });

  it("blocks a nested file symlink read and write", async () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-02-r1-file-"));
    const outside = mkdtempSync(join(tmpdir(), "vos-host-02-r1-file-out-"));
    const outsideFile = join(outside, "secret.bin");
    writeFileSync(outsideFile, "outside");
    process.env.STORED_OBJECT_ROOT = root;
    mkdirSync(join(root, "aa"));
    try {
      symlinkSync(outsideFile, join(root, "aa", "bb"), "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const adapter = createLocalBlobStorageAdapter();
    await assert.rejects(adapter.get("aa/bb"), contained);
    await assert.rejects(adapter.put("aa/bb", new Uint8Array([9])), contained);
    assert.equal(readFileSync(outsideFile, "utf8"), "outside");
  });

  it("rejects malformed object keys before writing", async () => {
    const root = mkdtempSync(join(tmpdir(), "vos-host-02-r1-key-"));
    process.env.STORED_OBJECT_ROOT = root;
    const adapter = createLocalBlobStorageAdapter();
    for (const key of ["../bb", "/aa/bb", "aa/%2e%2e", "aa/../../bb", "aa\\bb"]) {
      await assert.rejects(adapter.put(key, new Uint8Array([1])), (error: unknown) => {
        return error instanceof StoredObjectError && error.code === "VALIDATION";
      });
    }
    assert.equal(existsSync(join(root, "..", "bb")), false);
  });
});

function contained(error: unknown) {
  return error instanceof StoredObjectError && error.code === "VALIDATION" && !error.message.includes("\\") && !error.message.includes("Users");
}
