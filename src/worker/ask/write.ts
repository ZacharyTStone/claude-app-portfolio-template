/* The reply to a typed question: a sentence or two the model writes from
   the lines the picker chose, answering the question as it was asked ("Does
   he need a visa?" gets "No: he's a US citizen…", not the line itself). It
   isn't taken at its word for the facts a check can tell: a reply that
   fails the check is asked for once more, with what was wrong, and dropped
   if it fails again. */
import { isReplyText } from "../../contracts/ask.ts";
import { checkReply, isCheckedLanguage } from "./checks/grounded.ts";
import { NO_TOKENS, type Tokens } from "./cost.ts";
import { callForText, ranOutOfRoom, textIn, type Called } from "./model.ts";
import { askAgainAfter, askForReply, type Failure, type Writing } from "./prompts/reply.ts";
import { NONE } from "./prompts/wording.ts";

/** The most the model may write for a reply: a sentence or two, in Japanese
    too (where a character is about a token), and room for a model that
    reasons a little first. A reply cut off at it is asked for again,
    shorter. */
export const MAX_WRITE_TOKENS = 320;

/** The longest reply it may write, in characters: a sentence or two, not a
    paragraph. A longer one is asked for again, shorter. */
export const MAX_WRITTEN_LENGTH = 240;

/** How many times it's asked: once, and once more with what was wrong. */
export const MAX_WRITE_TRIES = 2;

/** How long the writing may take in all, in milliseconds: past it, the
    lines are quoted as they are. The page waits 12 s for /ask. */
const WRITE_TIMEOUT_MS = 5000;

/** Whether replies are written in a language: one the check can read. */
export const writesIn = isCheckedLanguage;

/** Why no reply was written: the last one failed (`long` or `words`, a
    Failure), or
    - none: the model said the lines don't answer the question;
    - empty: it wrote nothing;
    - late: it ran out of time;
    - error: it couldn't be reached. */
export type Unwritten = Failure["why"] | "none" | "empty" | "late" | "error";

type Attempts = {
  /** How many times the model was asked. */
  tries: number;
  /** The tokens its calls used, all together. */
  tokens: Tokens;
};

/** How the writing went: a reply that passed the check is `sent`; with
    none, the writing is `dropped`, and `why` says why. `unsourced` has what
    failed the last check, when that's why. */
export type Written =
  | ({ outcome: "sent"; reply: string; why?: undefined; unsourced?: undefined } & Attempts)
  | ({ outcome: "dropped"; reply?: undefined; why: Unwritten; unsourced?: string[] } & Attempts);

// "…", “…”, 「…」, 『…』: some models put them round a reply.
const QUOTES_AROUND = /^["“「『]+|["”」』]+$/g;

// "none", "None.", "none。".
const ONLY_NONE = new RegExp(`^${NONE}[.。!]?$`, "i");

/** What the model wrote, as one of: the reply; why it may not be one, which
    the model is told before it's asked again (`failure`, with what it
    wrote); or why it isn't asked again (`why`). */
type Judged = { reply: string } | { failure: Failure; text: string } | { why: "empty" | "none" };

function judge(modelReply: unknown, writing: Writing): Judged {
  const text = textIn(modelReply).replace(QUOTES_AROUND, "").trim();
  if (!text) return { why: "empty" };
  if (ONLY_NONE.test(text)) return { why: "none" };
  const isTooLong = ranOutOfRoom(modelReply) || text.length > MAX_WRITTEN_LENGTH || !isReplyText(text);
  if (isTooLong) return { failure: { why: "long" }, text };
  const checked = checkReply(text, writing, writing.question, writing.lang);
  if (checked.reply !== undefined) return { reply: checked.reply };
  return { failure: { why: "words", unsourced: checked.unsourced }, text };
}

const sumOf = (one: Tokens, other: Tokens): Tokens => ({
  input: one.input + other.input,
  output: one.output + other.output,
});

/** The reply to `writing.question`, written by `model` from `writing.lines`
    and checked against them, within `timeoutMs` in all. One the model can't
    or won't write isn't asked for again. */
export async function write(
  ai: Ai,
  model: string,
  writing: Writing,
  timeoutMs: number = WRITE_TIMEOUT_MS,
): Promise<Written> {
  const messages = askForReply(writing);
  const deadline = Date.now() + timeoutMs;
  let tokens = NO_TOKENS;
  let lastFailure: Failure | undefined;
  for (let tries = 1; tries <= MAX_WRITE_TRIES; tries++) {
    const timeLeftMs = deadline - Date.now();
    if (timeLeftMs <= 0) return { outcome: "dropped", why: "late", tries: tries - 1, tokens };
    let called: Called;
    try {
      const limits = { maxTokens: MAX_WRITE_TOKENS, timeoutMs: timeLeftMs };
      called = await callForText(ai, model, { messages, temperature: 0 }, limits);
    } catch {
      return { outcome: "dropped", why: "error", tries, tokens };
    }
    tokens = sumOf(tokens, called.tokens);
    if (called.modelReply === undefined) return { outcome: "dropped", why: "late", tries, tokens };
    const judged = judge(called.modelReply, writing);
    if ("reply" in judged) return { outcome: "sent", reply: judged.reply, tries, tokens };
    if ("why" in judged) return { outcome: "dropped", why: judged.why, tries, tokens };
    lastFailure = judged.failure;
    messages.push(...askAgainAfter(judged.text, judged.failure));
  }
  return { outcome: "dropped", why: "empty", ...lastFailure, tries: MAX_WRITE_TRIES, tokens };
}
