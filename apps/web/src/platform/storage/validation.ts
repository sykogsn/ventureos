import { StoredObjectError } from "./errors";

export const ALLOWED_STORED_OBJECT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export type AllowedStoredObjectMimeType = (typeof ALLOWED_STORED_OBJECT_MIME_TYPES)[number];

const MIME_SET = new Set<string>(ALLOWED_STORED_OBJECT_MIME_TYPES);

export function storedObjectMaxBytes() {
  const raw = process.env.STORED_OBJECT_MAX_BYTES;
  if (!raw) {
    return 15_728_640;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 15_728_640;
  }
  return parsed;
}

export function sanitizeStoredObjectFilename(filename: string): string {
  const trimmed = filename
    .replace(/\0/g, "")
    .replace(/[/\\]/g, "")
    .replace(/\.\.+/g, "")
    .trim()
    .slice(0, 200);
  return trimmed.length > 0 ? trimmed : "upload";
}

export function normalizeStoredObjectMimeType(mimeType: string): string {
  return mimeType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
}

function mimeMatchesBytes(mimeType: string, body: Uint8Array): boolean {
  if (body.length < 4) {
    return mimeType === "application/pdf";
  }
  if (mimeType === "image/jpeg" && body[0] === 0xff && body[1] === 0xd8) {
    return true;
  }
  if (
    mimeType === "image/png" &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47
  ) {
    return true;
  }
  if (
    mimeType === "application/pdf" &&
    body[0] === 0x25 &&
    body[1] === 0x50 &&
    body[2] === 0x44 &&
    body[3] === 0x46
  ) {
    return true;
  }
  if (mimeType === "image/webp" && body.length >= 12) {
    return (
      body[0] === 0x52 &&
      body[1] === 0x49 &&
      body[2] === 0x46 &&
      body[3] === 0x46 &&
      body[8] === 0x57 &&
      body[9] === 0x45 &&
      body[10] === 0x42 &&
      body[11] === 0x50
    );
  }
  return true;
}

export function validateStoredObjectUpload(input: {
  body: Uint8Array;
  originalFilename: string;
  mimeType: string;
}): { mimeType: AllowedStoredObjectMimeType; originalFilename: string } {
  const maxBytes = storedObjectMaxBytes();
  if (input.body.byteLength === 0) {
    throw new StoredObjectError("VALIDATION", "Empty uploads are not allowed.");
  }
  if (input.body.byteLength > maxBytes) {
    throw new StoredObjectError("VALIDATION", "Upload exceeds the maximum allowed size.");
  }

  const mimeType = normalizeStoredObjectMimeType(input.mimeType);
  if (!MIME_SET.has(mimeType)) {
    throw new StoredObjectError("VALIDATION", "Unsupported file type.");
  }

  if (!mimeMatchesBytes(mimeType, input.body)) {
    throw new StoredObjectError("VALIDATION", "File content does not match the declared type.");
  }

  return {
    mimeType: mimeType as AllowedStoredObjectMimeType,
    originalFilename: sanitizeStoredObjectFilename(input.originalFilename),
  };
}

export function assertSafeStorageKeySegment(value: string, label: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new StoredObjectError("VALIDATION", `${label} is not a safe storage identifier.`);
  }
}
