import type { DocumentIntelligence, IntelligentDocument } from "./types";

export function createDocumentIntelligence(
  documents: IntelligentDocument[],
): DocumentIntelligence {
  return { documents };
}

export function suggestedDocuments(intel: DocumentIntelligence) {
  return intel.documents.filter((document) => document.status === "suggested");
}
