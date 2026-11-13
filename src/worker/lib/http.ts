export const HTTP_STATUS = {
  ok: 200,
  badRequest: 400,
  methodNotAllowed: 405,
  payloadTooLarge: 413,
  unsupportedMediaType: 415,
  tooManyRequests: 429,
} as const;

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
