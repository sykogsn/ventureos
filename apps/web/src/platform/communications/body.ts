/**
 * Read a webhook body with a hard byte cap.
 * Content-Length can reject an obviously oversized request before streaming.
 * The streamed byte count is the authority, because that header can be absent or false.
 */

export type BoundedBodyRead =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "too_large" | "read_error" };

type ByteStreamSource = {
  body: ReadableStream<Uint8Array> | null;
  headers: Headers;
};

export function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedBodyRead> {
  return readBoundedBody(request, maxBytes);
}

export async function readBoundedBody(
  source: ByteStreamSource,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<BoundedBodyRead> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let onAbort: (() => void) | undefined;
  try {
    if (signal?.aborted) {
      await cancelStream(source.body);
      return { ok: false, reason: "read_error" };
    }

    const declared = declaredContentLength(source);
    if (declared !== null && declared > maxBytes) {
      await cancelStream(source.body);
      return { ok: false, reason: "too_large" };
    }

    const stream = source.body;
    if (!stream) return { ok: true, bytes: new Uint8Array(0) };

    reader = stream.getReader();
    if (signal) {
      const activeReader = reader;
      onAbort = () => {
        void cancelReader(activeReader);
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      const value = next.value;
      if (value.byteLength > maxBytes - received) {
        await cancelReader(reader);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
      received += value.byteLength;
    }

    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, bytes };
  } catch {
    if (reader) await cancelReader(reader);
    return { ok: false, reason: "read_error" };
  } finally {
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // cancel() can already have released the reader.
      }
    }
  }
}

function declaredContentLength(source: ByteStreamSource): number | null {
  const header = source.headers.get("content-length");
  if (header === null || !/^[0-9]{1,18}$/.test(header)) return null;
  const value = Number(header);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

async function cancelStream(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return;
  try {
    await stream.cancel();
  } catch {
    // The sender already failed the stream. The size decision stands.
  }
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await reader.cancel();
  } catch {
    // The stream is already errored or cancelled.
  }
}
