export const HTTP_STATUS = {
  ok: 200,
  seeOther: 303,
  badRequest: 400,
  forbidden: 403,
  methodNotAllowed: 405,
  payloadTooLarge: 413,
  unsupportedMediaType: 415,
  tooManyRequests: 429,
  serviceUnavailable: 503,
} as const;

/** As much of fetch() as the Worker's own requests use: the daily
    rebuild's, to Workers Builds, and the contact form's, to its sender's
    API. Their tests pass one of their own. */
export type Fetch = (address: string, init: RequestInit) => Promise<Response>;

/** Why a request isn't one the Worker reads, and the status it's turned
    away with. */
export type Rejection = { status: number; error: string; headers?: Record<string, string> };

/** The body of a request as text, read as it comes; null for one longer
    than `maxBytes`, of which no more is read. */
export async function readBodyText(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    bytesRead += chunk.value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

/** A reply with `data` as its JSON body, that no cache keeps and no browser
    reads as another type. `headers` are added to those. */
export function json(data: unknown, status: number = HTTP_STATUS.ok, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

/** A redirect to `address` that the browser follows with a GET, as a form
    post's should be, and that no cache keeps. */
export const seeOther = (address: string): Response =>
  new Response(null, { status: HTTP_STATUS.seeOther, headers: { Location: address, "Cache-Control": "no-store" } });
