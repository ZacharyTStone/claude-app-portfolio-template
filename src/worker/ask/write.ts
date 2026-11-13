/* A sentence or two the model writes from the lines the picker chose,
   answering the question as it was asked ("Does he need a visa?" gets "No:
   he's a US citizen…", not the line itself). It isn't taken at its word: a
   reply that fails the check is asked for once more, then dropped. */
import { isReplyText } from "../../contracts/ask.ts";
import { checkReply, isCheckedLanguage } from "./checks/grounded.ts";
import { NO_TOKENS, type Tokens } from "./cost.ts";
import { callForText, ranOutOfRoom, textIn, type Called } from "./model.ts";
import { askAgainAfter, askForReply, type Failure, type Writing } from "./prompts/reply.ts";
import { NONE } from "./prompts/wording.ts";

/** A sentence or two, in Japanese too (where a character is about a
    token), with room for a model that reasons a little first. */
export const MAX_WRITE_TOKENS = 320;

/** In characters: a sentence or two, not a paragraph. */
export const MAX_WRITTEN_LENGTH = 240;

/** Once, and once more with what was wrong. */
export const MAX_WRITE_TRIES = 2;

/** For every try together. The page waits 12 s for /ask. */
const WRITE_TIMEOUT_MS = 5000;

/** Only in a language the check can read. */
export const writesIn = isCheckedLanguage;

/** Why no reply was written: the last one failed (`long` or `words`, a
    Failure), or
    - none: the model said the lines don't answer the question;
    - empty: it wrote nothing;
    - late: it ran out of time;
    - error: it couldn't be reached. */
export type Unwritten = Failure["why"] | "none" | "empty" | "late" | "error";

type Attempts = {
  tries: number;
  /** Of every call together. */
  tokens: Tokens;
};

/** A reply that passed the check is `sent`. `unsourced` has what failed
    the last check, when that's why none did. */
export type Written =
  | ({ outcome: "sent"; reply: string; why?: undefined; unsourced?: undefined } & Attempts)
  | ({ outcome: "dropped"; reply?: undefined; why: Unwritten; unsourced?: string[] } & Attempts);

// "…", “…”, 「…」, 『…』: some models put them round a reply. A closing run
// is tried only where it starts, so a long one is read once.
const QUOTES_AROUND = /^["“「『]+|(?<!["”」』])["”」』]+$/g;

// "none", "None.", "none。".
const ONLY_NONE = new RegExp(`^${NONE}[.。!]?$`, "i");

/** The reply; or why what the model wrote isn't one, which it's told before
    it's asked again (`failure`); or why it isn't asked again (`why`). */
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

/** A reply the model can't or won't write isn't asked for again. */
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
