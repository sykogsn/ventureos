import type { StoredObjectId, UserId, VentureId, WorkspaceId } from "./ids";

export type StoredObjectScope = {
  workspaceId: WorkspaceId;
  ventureId?: VentureId;
};

export type StoredObjectMetadata = {
  id: StoredObjectId;
  workspaceId: WorkspaceId;
  ventureId: VentureId | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdByUserId: UserId;
  createdAt: string;
  deletedAt: string | null;
};

export type StoredObjectRef = Pick<
  StoredObjectMetadata,
  "id" | "workspaceId" | "ventureId" | "mimeType" | "sizeBytes" | "originalFilename" | "createdAt"
>;

export type StoreStoredObjectInput = {
  /** Durable replay, scoped to tenant, actor and issued domain authority. */
  idempotency?: { key: string; requestFingerprint: string };
  scope: StoredObjectScope;
  actorUserId: UserId;
  activeWorkspaceId: WorkspaceId;
  body: Uint8Array;
  originalFilename: string;
  mimeType: string;
};

export type OpenStoredObjectInput = {
  actorUserId: UserId;
  activeWorkspaceId: WorkspaceId;
  objectId: StoredObjectId;
};

export type DeleteStoredObjectInput = {
  actorUserId: UserId;
  activeWorkspaceId: WorkspaceId;
  objectId: StoredObjectId;
};

export type DomainAuthorizedMutation = {
  domain: string;
  relation: string;
  resourceId: string;
};

export type StoredObjectPort = {
  store(input: StoreStoredObjectInput): Promise<StoredObjectMetadata>;
  storeForDomain(
    input: StoreStoredObjectInput & { authority: DomainAuthorizedMutation },
  ): Promise<StoredObjectMetadata>;
  open(input: OpenStoredObjectInput): Promise<{ metadata: StoredObjectMetadata; body: Uint8Array } | null>;
  delete(input: DeleteStoredObjectInput): Promise<void>;
  deleteForDomain(
    input: DeleteStoredObjectInput & { authority: DomainAuthorizedMutation },
  ): Promise<void>;
  exists(objectId: StoredObjectId): Promise<boolean>;
};
