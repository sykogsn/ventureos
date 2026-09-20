import {
  FRIGORA_OFFLINE_DB_NAME,
  FRIGORA_OFFLINE_DB_VERSION,
  FRIGORA_OFFLINE_OBJECT_STORES,
  type FrigoraOfflineObjectStoreName,
} from "./types";

export type OfflineRecord = Record<string, unknown> & { key: string };

export type FrigoraOfflineBackend = {
  readonly kind: "indexeddb" | "memory";
  readonly dbName: string;
  readonly dbVersion: number;
  close(): void;
  put(store: FrigoraOfflineObjectStoreName, record: OfflineRecord): Promise<void>;
  get(
    store: FrigoraOfflineObjectStoreName,
    key: string,
  ): Promise<OfflineRecord | undefined>;
  delete(store: FrigoraOfflineObjectStoreName, key: string): Promise<void>;
  getAll(store: FrigoraOfflineObjectStoreName): Promise<OfflineRecord[]>;
  /**
   * Atomic multi-store write. All puts succeed or none are applied.
   */
  atomicPut(
    writes: Array<{ store: FrigoraOfflineObjectStoreName; record: OfflineRecord }>,
    ifAbsent?: { store: FrigoraOfflineObjectStoreName; key: string },
  ): Promise<OfflineRecord | undefined>;
};

type MemoryDb = {
  version: number;
  stores: Map<FrigoraOfflineObjectStoreName, Map<string, OfflineRecord>>;
};

const memoryDatabases = new Map<string, MemoryDb>();

function emptyStores(): Map<FrigoraOfflineObjectStoreName, Map<string, OfflineRecord>> {
  const stores = new Map<FrigoraOfflineObjectStoreName, Map<string, OfflineRecord>>();
  for (const name of FRIGORA_OFFLINE_OBJECT_STORES) {
    stores.set(name, new Map());
  }
  return stores;
}

export function resetMemoryOfflineDatabasesForTests(): void {
  memoryDatabases.clear();
}

export function createMemoryOfflineBackend(options?: {
  dbName?: string;
  dbVersion?: number;
}): FrigoraOfflineBackend {
  const dbName = options?.dbName ?? FRIGORA_OFFLINE_DB_NAME;
  const dbVersion = options?.dbVersion ?? FRIGORA_OFFLINE_DB_VERSION;
  let db = memoryDatabases.get(dbName);
  if (!db || db.version !== dbVersion) {
    // Version change recreates empty schema (F33-01 single version).
    db = { version: dbVersion, stores: emptyStores() };
    memoryDatabases.set(dbName, db);
  }

  return {
    kind: "memory",
    dbName,
    dbVersion,
    close() {
      /* memory backend remains available for reopen via shared map */
    },
    async put(store, record) {
      db!.stores.get(store)!.set(record.key, structuredClone(record));
    },
    async get(store, key) {
      const value = db!.stores.get(store)!.get(key);
      return value ? structuredClone(value) : undefined;
    },
    async delete(store, key) {
      db!.stores.get(store)!.delete(key);
    },
    async getAll(store) {
      return [...db!.stores.get(store)!.values()].map((value) => structuredClone(value));
    },
    async atomicPut(writes, ifAbsent) {
      const existing = ifAbsent && db!.stores.get(ifAbsent.store)!.get(ifAbsent.key);
      if (existing) return structuredClone(existing);
      const snapshots = new Map<
        FrigoraOfflineObjectStoreName,
        Map<string, OfflineRecord>
      >();
      for (const name of FRIGORA_OFFLINE_OBJECT_STORES) {
        snapshots.set(name, new Map(db!.stores.get(name)!));
      }
      try {
        for (const write of writes) {
          db!.stores.get(write.store)!.set(write.record.key, structuredClone(write.record));
        }
      } catch (error) {
        for (const name of FRIGORA_OFFLINE_OBJECT_STORES) {
          db!.stores.set(name, snapshots.get(name)!);
        }
        throw error;
      }
    },
  };
}

function idbReq<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function openIndexedDbOfflineBackend(options?: {
  dbName?: string;
  dbVersion?: number;
  indexedDB?: IDBFactory;
}): Promise<FrigoraOfflineBackend> {
  const factory = options?.indexedDB ?? globalThis.indexedDB;
  if (!factory) {
    throw new Error("IndexedDB is not available in this environment");
  }
  const dbName = options?.dbName ?? FRIGORA_OFFLINE_DB_NAME;
  const dbVersion = options?.dbVersion ?? FRIGORA_OFFLINE_DB_VERSION;

  const openReq = factory.open(dbName, dbVersion);
  openReq.onupgradeneeded = () => {
    const database = openReq.result;
    for (const storeName of FRIGORA_OFFLINE_OBJECT_STORES) {
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: "key" });
        store.createIndex("by_partition", ["ventureId", "actorUserId"], { unique: false });
        if (storeName === "outbox") {
          store.createIndex("by_client_operation_id", "clientOperationId", { unique: true });
          store.createIndex("by_sync_state", "syncState", { unique: false });
        }
        if (storeName === "workspaces") {
          store.createIndex("by_work_order", "workOrderId", { unique: false });
        }
        if (storeName === "evidence_blobs") {
          store.createIndex("by_client_operation_id", "clientOperationId", { unique: false });
        }
      }
    }
  };

  const database = await idbReq(openReq);

  return {
    kind: "indexeddb",
    dbName,
    dbVersion,
    close() {
      database.close();
    },
    async put(store, record) {
      const tx = database.transaction(store, "readwrite");
      tx.objectStore(store).put(record);
      await idbTxDone(tx);
    },
    async get(store, key) {
      const tx = database.transaction(store, "readonly");
      const result = await idbReq(tx.objectStore(store).get(key));
      await idbTxDone(tx);
      return result as OfflineRecord | undefined;
    },
    async delete(store, key) {
      const tx = database.transaction(store, "readwrite");
      tx.objectStore(store).delete(key);
      await idbTxDone(tx);
    },
    async getAll(store) {
      const tx = database.transaction(store, "readonly");
      const result = await idbReq(tx.objectStore(store).getAll());
      await idbTxDone(tx);
      return result as OfflineRecord[];
    },
    async atomicPut(writes, ifAbsent) {
      const storeNames = [...new Set([...writes.map((write) => write.store), ...(ifAbsent ? [ifAbsent.store] : [])])];
      const tx = database.transaction(storeNames, "readwrite");
      const done = idbTxDone(tx);
      let existing: OfflineRecord | undefined;
      const writeAll = () => {
        try {
          for (const write of writes) tx.objectStore(write.store).put(write.record);
        } catch { tx.abort(); }
      };
      if (ifAbsent) {
        const request = tx.objectStore(ifAbsent.store).get(ifAbsent.key);
        request.onsuccess = () => {
          existing = request.result as OfflineRecord | undefined;
          if (!existing) writeAll();
        };
      } else writeAll();
      await done;
      return existing;
    },
  };
}

export async function openDefaultOfflineBackend(): Promise<FrigoraOfflineBackend> {
  if (typeof globalThis.indexedDB !== "undefined") {
    return openIndexedDbOfflineBackend();
  }
  return createMemoryOfflineBackend();
}
