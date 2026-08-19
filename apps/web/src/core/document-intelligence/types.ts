export type DocumentStatus = "suggested" | "draft" | "live";

export type IntelligentDocument = {
  id: string;
  title: string;
  kind: string;
  status: DocumentStatus;
  summary: string;
};

export type DocumentIntelligence = {
  documents: IntelligentDocument[];
};
