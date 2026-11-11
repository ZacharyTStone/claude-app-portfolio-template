/* What /ask accepts: a JSON POST of at most MAX_REQUEST_BYTES with a
   question in it (an AskRequest). Anything else is turned away with a 4xx
   and a word on why, before anything is spent on it. */
import { MAX_QUESTION_LENGTH, MAX_REQUEST_BYTES } from "../../shared/ask.ts";
import { isString } from "../../shared/guards.ts";
import { json } from "../lib/http.ts";
import { get } from "../lib/shape.ts";

/** An AskRequest, checked: the question trimmed and cut to
    MAX_QUESTION_LENGTH, and the page's language if it sent one. */
export type Question = { question: string; lang: string | undefined };

const refuse = (status: number, error: string, headers?: Record<string, string>) => json({ error }, status, headers);

/** The reply that turns the request away if it isn't a JSON POST. */
export function refuseRequest(request: Request): Response | undefined {
  if (request.method !== "POST") return refuse(405, "POST only", { Allow: "POST" });
  // A page on another site can't send this content type without asking
  // first, and isn't allowed to.
  const type = request.headers.get("Content-Type") ?? "";
  if (!type.startsWith("application/json")) return refuse(415, "JSON only");
  return undefined;
}

// The body as text, read no further than `max` bytes: null past them.
async function readText(request: Request, max: number): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(read.value, { stream: true });
  }
  return text + decoder.decode();
}

/** The question in the request's body, or the reply that turns it away. */
export async function readQuestion(request: Request): Promise<Question | Response> {
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_REQUEST_BYTES) return refuse(413, "too long");
  let body: unknown;
  try {
    // Measured as it comes, too: Content-Length can be missing.
    const text = await readText(request, MAX_REQUEST_BYTES);
    if (text === null) return refuse(413, "too long");
    body = JSON.parse(text);
  } catch {
    return refuse(400, "bad JSON");
  }
  const sent = get(body, "question");
  const question = isString(sent) ? sent.trim().slice(0, MAX_QUESTION_LENGTH) : "";
  if (!question) return refuse(400, "no question");
  const lang = get(body, "lang");
  return { question, lang: isString(lang) ? lang : undefined };
}
