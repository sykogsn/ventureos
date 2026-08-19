import type { DocumentPort } from "@/contracts";

export function createDocumentPort(): DocumentPort {
  return {
    async get() {
      return null;
    },
    async list() {
      return [];
    },
  };
}
