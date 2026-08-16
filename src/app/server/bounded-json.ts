import "server-only";

export class BoundedJsonError extends Error {
  constructor(
    readonly kind: "too-large" | "invalid-json",
    message: string,
  ) {
    super(message);
    this.name = "BoundedJsonError";
  }
}

/** Reads a small JSON command body without allowing an advertised oversized payload. */
export async function readBoundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  const advertisedLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(advertisedLength) && advertisedLength > maximumBytes) {
    throw new BoundedJsonError("too-large", "Request body exceeds the allowed size");
  }
  const reader = request.body?.getReader();
  if (reader === undefined) {
    throw new BoundedJsonError("invalid-json", "Request body must be valid JSON");
  }
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    receivedBytes += chunk.value.byteLength;
    if (receivedBytes > maximumBytes) {
      await reader.cancel();
      throw new BoundedJsonError("too-large", "Request body exceeds the allowed size");
    }
    chunks.push(chunk.value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new BoundedJsonError("invalid-json", "Request body must be valid JSON");
  }
}
