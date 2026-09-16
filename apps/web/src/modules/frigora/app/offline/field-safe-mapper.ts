import {
  FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS,
  type FrigoraOfflineFieldSafePayload,
} from "./types";
import { assertFieldSafeOfflinePayload } from "./commercial-guard";

const FORBIDDEN = new Set<string>(FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS);

/**
 * Deep-clone a value while omitting forbidden commercial/pricing keys.
 * Deterministic key order is not required; shape stability is.
 */
export function stripForbiddenCommercialFields<T>(value: T): T {
  return stripValue(value) as T;
}

function stripValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stripValue);
  }
  if (typeof value !== "object") {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN.has(key)) {
      continue;
    }
    out[key] = stripValue(child);
  }
  return out;
}

export type FieldSafePartReference = {
  id: string;
  displayName: string;
  defaultQuantityUnit: string;
  status: string;
};

export type FieldSafeRefrigerantReference = {
  id: string;
  canonicalCode: string;
  displayName: string;
  status: string;
};

export function mapPartReferenceFieldSafe(
  ref: Record<string, unknown>,
): FieldSafePartReference {
  return {
    id: String(ref.id ?? ""),
    displayName: String(ref.displayName ?? ""),
    defaultQuantityUnit: String(ref.defaultQuantityUnit ?? ""),
    status: String(ref.status ?? ""),
  };
}

export function mapRefrigerantReferenceFieldSafe(
  ref: Record<string, unknown>,
): FieldSafeRefrigerantReference {
  return {
    id: String(ref.id ?? ""),
    canonicalCode: String(ref.canonicalCode ?? ""),
    displayName: String(ref.displayName ?? ""),
    status: String(ref.status ?? ""),
  };
}

export type FieldSafeMapperInput = {
  workOrder?: Record<string, unknown> | null;
  visit?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  site?: Record<string, unknown> | null;
  asset?: Record<string, unknown> | null;
  history?: unknown[];
  partReferences?: Array<Record<string, unknown>>;
  refrigerantReferences?: Array<Record<string, unknown>>;
};

/**
 * Map operational view fragments into the F33-01 field-safe payload contract.
 * Rejects commercial contamination via assertFieldSafeOfflinePayload.
 */
export function mapToFieldSafeOfflinePayload(
  input: FieldSafeMapperInput,
): FrigoraOfflineFieldSafePayload {
  const payload: FrigoraOfflineFieldSafePayload = {
    workOrder: input.workOrder
      ? (stripForbiddenCommercialFields(input.workOrder) as Record<string, unknown>)
      : undefined,
    visit: input.visit
      ? (stripForbiddenCommercialFields(input.visit) as Record<string, unknown>)
      : undefined,
    customer: input.customer
      ? (stripForbiddenCommercialFields(input.customer) as Record<string, unknown>)
      : undefined,
    site: input.site
      ? (stripForbiddenCommercialFields(input.site) as Record<string, unknown>)
      : undefined,
    asset: input.asset
      ? (stripForbiddenCommercialFields(input.asset) as Record<string, unknown>)
      : undefined,
    history: input.history
      ? (stripForbiddenCommercialFields(input.history) as unknown[])
      : undefined,
    partReferences: input.partReferences?.map((ref) =>
      mapPartReferenceFieldSafe(stripForbiddenCommercialFields(ref) as Record<string, unknown>),
    ),
    refrigerantReferences: input.refrigerantReferences?.map((ref) =>
      mapRefrigerantReferenceFieldSafe(
        stripForbiddenCommercialFields(ref) as Record<string, unknown>,
      ),
    ),
  };
  assertFieldSafeOfflinePayload(payload);
  return payload;
}
