export type BlobStorageAdapter = {
  put(storageKey: string, body: Uint8Array): Promise<void>;
  get(storageKey: string): Promise<Uint8Array | null>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
};
