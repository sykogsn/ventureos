import type { DocumentId, VentureId, WorkspaceId } from "./ids";

export type DocumentRef = {
  id: DocumentId;
  title: string;
  uri: string;
  mimeType: string;
  workspaceId: WorkspaceId;
  ventureId?: VentureId;
};

export type DocumentPort = {
  get(id: DocumentId): Promise<DocumentRef | null>;
  list(scope: { workspaceId: WorkspaceId; ventureId?: VentureId }): Promise<DocumentRef[]>;
};
