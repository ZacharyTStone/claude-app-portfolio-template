/* What /ask accepts: a JSON POST of at most MAX_REQUEST_BYTES with a
   question in it (an AskRequest). Anything else is turned away with a 4xx
   and a word on why, before anything is spent on it. */
import * as v from "valibot";
import {
  MAX_EARLIER_TURNS,
  MAX_QUESTION_LENGTH,
  MAX_REQUEST_BYTES,
  parseAnswerId,
  type AskRequest,
  type AskTurn,
} from "../../contracts/ask.ts";
import { HTTP_STATUS, readBodyText, type Rejection } from "../lib/http.ts";

/** What the visitor typed: trimmed, and cut to MAX_QUESTION_LENGTH. One
    that isn't text, or is only spaces, isn't a question. */
const QuestionSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.transform((question) => question.slice(0, MAX_QUESTION_LENGTH)),
);

/** An earlier turn as the Worker reads it. */
const CheckedTurnSchema = v.object({
  question: QuestionSchema,
  /** An id threadAnswerId could have written, or none: one that isn't is
      read as none sent. Whether the site has that answer is for the
      answers to say (earlier.ts). */
  id: v.fallback(
    v.optional(
      v.pipe(
        v.string(),
        v.check((id) => parseAnswerId(id) !== null),
      ),
    ),
    undefined,
  ),
  // Every field of an AskTurn is read here, and nothing else is.
} satisfies Record<keyof AskTurn, v.GenericSchema>);

export type CheckedTurn = v.InferOutput<typeof CheckedTurnSchema>;

// The last MAX_EARLIER_TURNS of what was sent, each that can be read.
function readTurns(sent: unknown[]): CheckedTurn[] {
  return sent.slice(-MAX_EARLIER_TURNS).flatMap((turn) => {
    const checked = v.safeParse(CheckedTurnSchema, turn);
    return checked.success ? [checked.output] : [];
  });
}

const NO_TURNS: CheckedTurn[] = [];

/** An AskRequest as the Worker reads it. The body is whatever was sent, so
    each field says what's done with one that isn't as the page sends it. */
const CheckedAskRequestSchema = v.object({
  /** A request with no question is turned away. */
  question: QuestionSchema,
  /** The page's language. One that's missing or isn't text is read as none
      sent, not turned away: the question is then answered in the site's
      main language. */
  lang: v.fallback(v.optional(v.string()), undefined),
  /** The turns before the question. Missing, or not a list, is none; of a
      longer list, only the last MAX_EARLIER_TURNS are read, and a turn
      without a question is left out. None of it turns the question away:
      it's answered as if it came alone. */
  earlier: v.fallback(v.pipe(v.array(v.unknown()), v.transform(readTurns)), NO_TURNS),
  // Every field of an AskRequest is read here, and nothing else is.
} satisfies Record<keyof AskRequest, v.GenericSchema>);

export type CheckedAskRequest = v.InferOutput<typeof CheckedAskRequestSchema>;

export function rejectionUnlessJsonPost(request: Request): Rejection | undefined {
  if (request.method !== "POST") {
    return { status: HTTP_STATUS.methodNotAllowed, error: "POST only", headers: { Allow: "POST" } };
  }
  // A page on another site can't send this content type without asking
  // first, and isn't allowed to.
  const contentType = request.headers.get("Content-Type") ?? "";
  const isJson = contentType.startsWith("application/json");
  return isJson ? undefined : { status: HTTP_STATUS.unsupportedMediaType, error: "JSON only" };
}

const TOO_LONG: Rejection = { status: HTTP_STATUS.payloadTooLarge, error: "too long" };

export async function readAskRequest(request: Request): Promise<CheckedAskRequest | Rejection> {
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_REQUEST_BYTES) return TOO_LONG;
  let body: unknown;
  try {
    // Measured as it comes, too: Content-Length can be missing.
    const text = await readBodyText(request, MAX_REQUEST_BYTES);
    if (text === null) return TOO_LONG;
    body = JSON.parse(text);
  } catch {
    return { status: HTTP_STATUS.badRequest, error: "bad JSON" };
  }
  const checked = v.safeParse(CheckedAskRequestSchema, body);
  return checked.success ? checked.output : { status: HTTP_STATUS.badRequest, error: "no question" };
}
