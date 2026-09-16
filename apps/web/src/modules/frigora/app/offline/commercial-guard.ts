import {
  FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS,
  type FrigoraOfflineFieldSafePayload,
  type FrigoraOfflineWorkspaceSnapshot,
} from "./types";

function objectContainsForbiddenKey(
  value: unknown,
  path: string,
  violations: string[],
): void {
  if (value === null || value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      objectContainsForbiddenKey(item, `${path}[${index}]`, violations),
    );
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (
      (FRIGORA_OFFLINE_FORBIDDEN_COMMERCIAL_KEYS as readonly string[]).includes(key)
    ) {
      violations.push(`${path}.${key}`);
    }
    objectContainsForbiddenKey(child, `${path}.${key}`, violations);
  }
}

export function assertFieldSafeOfflinePayload(
  payload: FrigoraOfflineFieldSafePayload,
): void {
  const violations: string[] = [];
  objectContainsForbiddenKey(payload, "payload", violations);
  if (violations.length > 0) {
    throw new Error(
      `Offline field snapshot must not include commercial fields: ${violations.join(", ")}`,
    );
  }
}

export function assertFieldSafeWorkspaceSnapshot(
  snapshot: FrigoraOfflineWorkspaceSnapshot,
): void {
  assertFieldSafeOfflinePayload(snapshot.payload);
}
