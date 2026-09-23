import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createClient, type Client, type TransactionMode } from "@libsql/client";
import { withFrigoraWriteTransaction } from "./owned-write";

async function fixture() {
  const url = `file:${join(tmpdir(), `frigora-write-${randomUUID()}.db`).replaceAll("\\", "/")}`;
  const setup = createClient({ url });
  await setup.execute("CREATE TABLE proof (id TEXT PRIMARY KEY)");
  setup.close();
  const clients: Client[] = [];
  const factory = () => {
    const client = createClient({ url, timeout: 250 });
    clients.push(client);
    return client;
  };
  const read = async () => {
    const observer = createClient({ url });
    try { return (await observer.execute("SELECT id FROM proof ORDER BY id")).rows.map((row) => row.id); }
    finally { observer.close(); }
  };
  return { factory, clients, read };
}

describe("F34-03 disposable owned write lifecycle", () => {
  it("A commits, busy B is discarded, fresh C commits; independent state has A/C only", async () => {
    const { factory, clients, read } = await fixture();
    let acquired!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { acquired = resolve; });
    const resume = new Promise<void>((resolve) => { release = resolve; });
    const a = withFrigoraWriteTransaction(async (tx) => {
      acquired();
      await resume;
      await tx.execute("INSERT INTO proof VALUES ('A')");
    }, factory);
    await ready;
    try {
      await assert.rejects(withFrigoraWriteTransaction(async (tx) => {
        await tx.execute("INSERT INTO proof VALUES ('B')");
      }, factory), /SQLITE_BUSY/);
      assert.equal(clients[1]?.closed, true);
      assert.deepEqual(await read(), []);
    } finally { release(); }
    await a;
    await withFrigoraWriteTransaction(async (tx) => { await tx.execute("INSERT INTO proof VALUES ('C')"); }, factory);
    assert.equal(new Set(clients).size, 3);
    assert.ok(clients.every((client) => client.closed));
    assert.deepEqual(await read(), ["A", "C"]);
  });

  it("body failure rolls back and closes its disposable client", async () => {
    const { factory, clients, read } = await fixture();
    await assert.rejects(withFrigoraWriteTransaction(async (tx) => {
      await tx.execute("INSERT INTO proof VALUES ('partial')");
      throw new Error("forced body failure");
    }, factory), /forced body failure/);
    assert.ok(clients.every((client) => client.closed));
    assert.deepEqual(await read(), []);
  });

  it("commit failure rolls back, disposes the owner and allows a later write", async () => {
    const { factory, clients, read } = await fixture();
    const failingFactory = () => {
      const client = factory();
      const begin = client.transaction.bind(client);
      client.transaction = async (mode?: TransactionMode) => {
        const tx = await begin(mode);
        tx.commit = async () => { throw new Error("forced commit failure"); };
        return tx;
      };
      return client;
    };
    await assert.rejects(withFrigoraWriteTransaction(async (tx) => {
      await tx.execute("INSERT INTO proof VALUES ('partial')");
    }, failingFactory), /forced commit failure/);
    assert.deepEqual(await read(), []);
    assert.equal(clients[0]?.closed, true);
    await withFrigoraWriteTransaction(async (tx) => { await tx.execute("INSERT INTO proof VALUES ('later')"); }, factory);
    assert.deepEqual(await read(), ["later"]);
    assert.ok(clients.every((client) => client.closed));
  });
});
