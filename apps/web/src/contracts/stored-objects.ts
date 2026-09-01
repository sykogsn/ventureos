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

export type StoredObjectPort = {
  store(input: StoreStoredObjectInput): Promise<StoredObjectMetadata>;
  open(input: OpenStoredObjectInput): Promise<{ metadata: StoredObjectMetadata; body: Uint8Array } | null>;
  delete(input: DeleteStoredObjectInput): Promise<void>;
  exists(objectId: StoredObjectId): Promise<boolean>;
};
