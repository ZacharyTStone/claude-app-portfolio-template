/* What /ask accepts: a JSON POST of at most MAX_REQUEST_BYTES with a
   question in it (an AskRequest). Anything else is turned away with a 4xx
   and a word on why, before anything is spent on it. */
import * as v from "valibot";
import { MAX_QUESTION_LENGTH, MAX_REQUEST_BYTES, type AskRequest } from "../../contracts/ask.ts";
import { HTTP_STATUS, json } from "../lib/http.ts";

/** An AskRequest as the Worker reads it. The body is whatever was sent, so
    each field says what's done with one that isn't as the page sends it. */
const CheckedAskRequestSchema = v.object({
  /** What the visitor typed: trimmed, and cut to MAX_QUESTION_LENGTH. A
      request with none (or one that isn't text, or is only spaces) is
      turned away. */
  question: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(),
    v.transform((question) => question.slice(0, MAX_QUESTION_LENGTH)),
  ),
  /** The page's language. One that's missing or isn't text is read as none
      sent, not turned away: the question is then answered in the site's
      main language. */
  lang: v.fallback(v.optional(v.string()), undefined),
  // Every field of an AskRequest is read here, and nothing else is.
} satisfies Record<keyof AskRequest, v.GenericSchema>);

/** An AskRequest, checked: the question trimmed and cut to
    MAX_QUESTION_LENGTH, and the page's language if it sent one. */
export type CheckedAskRequest = v.InferOutput<typeof CheckedAskRequestSchema>;

const refuse = (status: number, error: string, headers?: Record<string, string>) => json({ error }, status, headers);

/** The reply that turns the request away if it isn't a JSON POST;
    undefined if it is one. */
export function refuseUnlessJsonPost(request: Request): Response | undefined {
  if (request.method !== "POST") return refuse(HTTP_STATUS.methodNotAllowed, "POST only", { Allow: "POST" });
  // A page on another site can't send this content type without asking
  // first, and isn't allowed to.
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.startsWith("application/json")) return refuse(HTTP_STATUS.unsupportedMediaType, "JSON only");
  return undefined;
}

// The body as text, read no further than `maxBytes`: null past them.
async function readBodyText(request: Request, maxBytes: number): Promise<string | null> {
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

/** The request's body as a checked AskRequest, or the reply that turns it
    away: too long, not JSON, or with no question in it. */
export async function readAskRequest(request: Request): Promise<CheckedAskRequest | Response> {
  const tooLong = () => refuse(HTTP_STATUS.payloadTooLarge, "too long");
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_REQUEST_BYTES) return tooLong();
  let body: unknown;
  try {
    // Measured as it comes, too: Content-Length can be missing.
    const text = await readBodyText(request, MAX_REQUEST_BYTES);
    if (text === null) return tooLong();
    body = JSON.parse(text);
  } catch {
    return refuse(HTTP_STATUS.badRequest, "bad JSON");
  }
  const checked = v.safeParse(CheckedAskRequestSchema, body);
  return checked.success ? checked.output : refuse(HTTP_STATUS.badRequest, "no question");
}
