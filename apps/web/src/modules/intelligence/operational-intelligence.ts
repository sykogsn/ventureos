import { isDeepStrictEqual } from "node:util";
import {
  assertIntelligenceCatalogue,
  assessKnowledgeAt,
  type KnowledgeObject,
  type KnowledgeType,
  type KnowledgeValidity,
} from "@repo/brain";
import type { WorkspaceId } from "@/contracts";
import { resolveSessionUser } from "@/lib/auth/session-token";
import { lookupPersistedSession } from "@/lib/auth/session-store";
import { ensureSchema } from "@/platform/persistence/db";
import { getPersistence } from "@/platform/persistence/repositories/sqlite";
import type {
  IntelligenceCatalogue,
  IntelligenceCurrent,
  IntelligenceWrite,
  IntelligenceMutationKind,
} from "@/platform/persistence/repositories/ports";
import {
  canAccessOperationalIntelligence,
  INTELLIGENCE_WRITE_PERMISSION,
} from "./governance";

/** Server-only service input: an existing signed session credential, never a caller-selected actor. */
export type IntelligenceAccess = {
  sessionToken: string;
  workspaceId: WorkspaceId;
};
export type IntelligenceMutation = IntelligenceAccess & {
  expectedCatalogueVersion: number;
  reason: string;
  semanticAuthorityRef?: string;
};
type Amendment = IntelligenceMutation & {
  objectId: string;
  expectedObjectRevision: number;
  record: KnowledgeObject;
};
type ExistingMutation = IntelligenceMutation & {
  objectId: string;
  expectedObjectRevision: number;
};
type Query = IntelligenceAccess & {
  objectId?: string;
  objectType?: KnowledgeType;
  originatingVentureId?: string;
  validity?: KnowledgeValidity;
};
function demand(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function scope(
  record: KnowledgeObject,
  workspaceId: string,
  row?: {
    id: string;
    objectType: string;
    originatingVentureId: string;
    workspaceId: string;
  },
) {
  const address = record.operatingScope;
  demand(
    address &&
      address.workspaceId === workspaceId &&
      address.originatingVentureId?.trim(),
    "Workspace/scope mismatch",
  );
  demand(
    Array.isArray(address.applicability) &&
      Array.isArray(address.sharing?.recipients),
    "Invalid operating scope",
  );
  demand(
    [...address.applicability, ...address.sharing.recipients].every(
      (a) => a.workspaceId === workspaceId,
    ),
    "Cross-workspace applicability/sharing is forbidden",
  );
  if (row)
    demand(
      row.id === record.id &&
        row.objectType === record.type &&
        row.workspaceId === address.workspaceId &&
        row.originatingVentureId === address.originatingVentureId,
      "Row/payload tenancy or identity mismatch",
    );
}
function parseCatalogue(
  snapshot: IntelligenceCatalogue,
  workspaceId: string,
): KnowledgeObject[] {
  // Repository has verified exact bytes, projection and the entire revision chain.
  for (const r of snapshot.revisions) {
    scope(JSON.parse(r.documentJson), workspaceId, { ...r, id: r.objectId });
  }
  return snapshot.objects.map((row) => {
    const record: KnowledgeObject = JSON.parse(row.documentJson);
    scope(record, workspaceId, row);
    return record;
  });
}
async function authorise(
  input: IntelligenceAccess,
  mode: "read" | "write",
  at: string,
) {
  demand(
    typeof input.sessionToken === "string" && input.sessionToken.length > 0,
    "Authentication required",
  );
  const user = await resolveSessionUser(
    input.sessionToken,
    lookupPersistedSession,
    at,
  );
  demand(user, "Authentication required");
  demand(
    await canAccessOperationalIntelligence(user.id, input.workspaceId, mode),
    "Intelligence permission denied",
  );
  return user;
}
function supported(record: KnowledgeObject) {
  demand(
    record.type === "Claim" || record.type === "Learning",
    "Validity mutation only supports Claim/Learning",
  );
  return record;
}
function preserve(old: KnowledgeObject, next: KnowledgeObject) {
  demand(
    old.id === next.id &&
      old.type === next.type &&
      old.operatingScope?.originatingVentureId ===
        next.operatingScope?.originatingVentureId,
    "Immutable object identity",
  );
  if (old.type === "Claim" || old.type === "Learning") {
    demand(
      old.validity !== "RETRACTED" && old.validity !== "SUPERSEDED",
      "Terminal validity cannot be mutated",
    );
  }
  if (old.type === "Learning" && next.type === "Learning") {
    for (const key of ["maturityHistory", "validationHistory"] as const) {
      demand(
        Array.isArray(next[key]) &&
          next[key].length >= old[key].length &&
          isDeepStrictEqual(next[key].slice(0, old[key].length), old[key]),
        "Learning history prefix must be preserved",
      );
    }
  }
  if (old.type === "Evidence" && next.type === "Evidence") {
    for (const key of [
      "source",
      "capturedAt",
      "supportsObjectId",
      "provenance",
    ] as const) {
      demand(
        isDeepStrictEqual(old[key], next[key]),
        "Evidence provenance identity must be preserved",
      );
    }
    demand(
      isDeepStrictEqual(
        old.relationships.filter((r) => r.kind === "derived_from"),
        next.relationships.filter((r) => r.kind === "derived_from"),
      ),
      "Evidence derived_from lineage must be preserved",
    );
  }
}
function write(
  record: KnowledgeObject,
  revision: number,
  kind: IntelligenceMutationKind,
): IntelligenceWrite {
  return {
    objectId: record.id,
    objectType: record.type,
    originatingVentureId: record.operatingScope!.originatingVentureId,
    expectedObjectRevision: revision,
    mutationKind: kind,
    documentJson: JSON.stringify(record),
  };
}
function presented(row: IntelligenceCurrent, at: string) {
  const record: KnowledgeObject = JSON.parse(row.documentJson);
  return {
    record,
    revision: row.currentRevision,
    revisionId: row.currentRevisionId,
    documentHash: row.documentHash,
    stored: true as const,
    catalogueValidation: "CATALOGUE_VALID" as const,
    recordAssessment: assessKnowledgeAt(record, at),
  };
}
async function mutate(
  input: IntelligenceMutation,
  propose: (
    records: KnowledgeObject[],
    snapshot: IntelligenceCatalogue,
    actor: string,
    at: string,
  ) => IntelligenceWrite[],
) {
  // Captured once by the application, never accepted in a command.
  const at = new Date().toISOString();
  const actor = await authorise(input, "write", at);
  await ensureSchema();
  const repository = getPersistence().intelligence;
  const snapshot = await repository.loadCatalogue(input.workspaceId);
  demand(
    Number.isSafeInteger(input.expectedCatalogueVersion) &&
      snapshot.version === input.expectedCatalogueVersion,
    "Catalogue version conflict",
  );
  demand(
    typeof input.reason === "string" && input.reason.trim(),
    "Mutation reason required",
  );
  if (input.semanticAuthorityRef !== undefined)
    demand(
      input.semanticAuthorityRef.trim(),
      "Authority reference must not be empty",
    );
  const records = parseCatalogue(snapshot, input.workspaceId);
  const writes = propose(records, snapshot, actor.id, at);
  for (const record of records) scope(record, input.workspaceId);
  assertIntelligenceCatalogue(records, at);
  const metadata = {
    workspaceId: input.workspaceId,
    expectedCatalogueVersion: input.expectedCatalogueVersion,
    recorderActorId: actor.id,
    requiredPermission: INTELLIGENCE_WRITE_PERMISSION,
    semanticAuthorityRef: input.semanticAuthorityRef,
    reason: input.reason,
    evaluationTime: at,
  };
  const durable =
    writes.length === 2
      ? await repository.commitSupersession({
          ...metadata,
          predecessor: writes[0]!,
          successor: writes[1]!,
        })
      : await repository.commitMutation({ ...metadata, write: writes[0]! });
  return {
    catalogueVersion: durable.version,
    evaluationTime: at,
    objects: writes.map((w) =>
      presented(durable.objects.find((row) => row.id === w.objectId)!, at),
    ),
  };
}
function existing(
  records: KnowledgeObject[],
  snapshot: IntelligenceCatalogue,
  command: ExistingMutation,
) {
  const index = records.findIndex((record) => record.id === command.objectId);
  demand(index >= 0, "Intelligence object not found");
  const row = snapshot.objects.find((item) => item.id === command.objectId)!;
  demand(
    Number.isSafeInteger(command.expectedObjectRevision) &&
      command.expectedObjectRevision === row.currentRevision,
    "Object revision conflict",
  );
  return { index, record: records[index]! };
}
export async function captureIntelligence(
  command: IntelligenceMutation & { record: KnowledgeObject },
) {
  const input = structuredClone(command);
  return mutate(input, (records) => {
    demand(
      !records.some((r) => r.id === input.record.id),
      "Intelligence object already exists",
    );
    scope(input.record, input.workspaceId);
    records.push(input.record);
    return [write(input.record, 0, "CREATE")];
  });
}
export async function amendIntelligence(command: Amendment) {
  const input = structuredClone(command);
  return mutate(input, (records, snapshot) => {
    const old = existing(records, snapshot, input);
    preserve(old.record, input.record);
    if (input.record.type === "Claim" || input.record.type === "Learning") {
      demand(
        !["RETRACTED", "SUPERSEDED"].includes(input.record.validity),
        "Use explicit retract/supersede operation",
      );
    }
    records[old.index] = input.record;
    return [write(input.record, input.expectedObjectRevision, "AMEND")];
  });
}
export async function retractIntelligence(command: ExistingMutation) {
  const input = structuredClone(command);
  return mutate(input, (records, snapshot, actor, at) => {
    const old = existing(records, snapshot, input),
      record = supported(old.record);
    const next = {
      ...record,
      validity: "RETRACTED" as const,
      retraction: { actor, at, reason: input.reason },
    };
    preserve(record, next);
    records[old.index] = next;
    return [write(next, input.expectedObjectRevision, "RETRACT")];
  });
}
export async function supersedeIntelligence(
  command: ExistingMutation & { successor: KnowledgeObject },
) {
  const input = structuredClone(command);
  return mutate(input, (records, snapshot) => {
    const old = existing(records, snapshot, input),
      record = supported(old.record);
    const successor = supported(input.successor);
    demand(
      successor.type === record.type &&
        !records.some((r) => r.id === successor.id),
      "Invalid successor identity",
    );
    const next = {
      ...record,
      validity: "SUPERSEDED" as const,
      supersededById: successor.id,
    };
    preserve(record, next);
    records[old.index] = next;
    records.push(successor);
    return [
      write(next, input.expectedObjectRevision, "SUPERSEDE"),
      write(successor, 0, "CREATE"),
    ];
  });
}
async function read(command: IntelligenceAccess) {
  const input = structuredClone(command),
    at = new Date().toISOString();
  await authorise(input, "read", at);
  await ensureSchema();
  const snapshot = await getPersistence().intelligence.loadCatalogue(
    input.workspaceId,
  );
  const records = parseCatalogue(snapshot, input.workspaceId);
  assertIntelligenceCatalogue(records, at);
  return { snapshot, at };
}
export async function queryIntelligence(command: Query) {
  const input = structuredClone(command);
  const { snapshot, at } = await read(input);
  return {
    catalogueVersion: snapshot.version,
    evaluationTime: at,
    objects: snapshot.objects
      .filter((row) => {
        const record: KnowledgeObject = JSON.parse(row.documentJson);
        return (
          (!input.objectId || row.id === input.objectId) &&
          (!input.objectType || row.objectType === input.objectType) &&
          (!input.originatingVentureId ||
            row.originatingVentureId === input.originatingVentureId) &&
          (!input.validity ||
            ((record.type === "Claim" || record.type === "Learning") &&
              record.validity === input.validity))
        );
      })
      .map((row) => presented(row, at)),
  };
}
export async function getIntelligence(
  command: IntelligenceAccess & { objectId: string },
) {
  return (await queryIntelligence(command)).objects[0] ?? null;
}
export async function traceIntelligence(
  command: IntelligenceAccess & { objectId: string },
) {
  const input = structuredClone(command);
  const { snapshot, at } = await read(input);
  const row = snapshot.objects.find((item) => item.id === input.objectId);
  return row
    ? {
        catalogueVersion: snapshot.version,
        current: presented(row, at),
        revisions: snapshot.revisions.filter(
          (r) => r.objectId === input.objectId,
        ),
      }
    : null;
}
