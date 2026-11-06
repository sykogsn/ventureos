/**
 * Read a webhook body with a hard byte cap.
 * Content-Length can reject an obviously oversized request before streaming.
 * The streamed byte count is the authority, because that header can be absent or false.
 */

export type BoundedBodyRead =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "too_large" | "read_error" };

export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedBodyRead> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  try {
    const declared = declaredContentLength(request);
    if (declared !== null && declared > maxBytes) {
      await cancelStream(request.body);
      return { ok: false, reason: "too_large" };
    }

    const stream = request.body;
    if (!stream) return { ok: true, bytes: new Uint8Array(0) };

    reader = stream.getReader();
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
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // cancel() can already have released the reader.
      }
    }
  }
}

function declaredContentLength(request: Request): number | null {
  const header = request.headers.get("content-length");
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
