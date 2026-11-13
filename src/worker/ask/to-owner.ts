/* The visitor's question, said to the owner. With no answer to show, the
   page offers an email and a message with the question in them, and those
   are written to the owner, where the question was typed about them ("Does
   Alex know testing?"). So one small call rewrites it as said to them ("Do
   you know testing?"). It's asked once: a rewrite that isn't the same
   question (checks/same-question.ts), or doesn't come, leaves the question
   as it was typed. */
import { ownerNames, type Choices } from "./answers.ts";
import { checkSameQuestion, type Refused } from "./checks/same-question.ts";
import { NO_TOKENS, type Tokens } from "./cost.ts";
import { callForText, ranOutOfRoom, textIn, type Called } from "./model.ts";
import { askForRewrite, isRewrittenLanguage, type Rewriting } from "./prompts/to-owner.ts";

/** The most the model may write when it says a question to the owner: the
    question over again, which is a line or two at its longest. One cut off
    at it isn't used. */
export const MAX_TO_OWNER_TOKENS = 120;

/** How long that may take, in milliseconds. The visitor waits for it. */
const TO_OWNER_TIMEOUT_MS = 3000;

/** Whether a question is said to the owner on a page in a language. */
export const saysToOwnerIn = isRewrittenLanguage;

/** Why a question wasn't said to the owner: the rewrite was refused; or
    - empty: the model wrote nothing;
    - late: it ran out of time;
    - error: it couldn't be reached. */
export type NotSaid = Refused | "empty" | "late" | "error";

/** How saying a question to the owner went: a rewrite that passed the
    check is `sent` as `toOwner`; with none, it's `dropped`, and `why` says
    why. `rewrite` is what the model wrote, on one line, whether or not it
    passed (for the log), and `tokens` what the call used. */
export type SaidToOwner =
  | { outcome: "sent"; toOwner: string; why?: undefined; rewrite: string; tokens: Tokens }
  | { outcome: "dropped"; toOwner?: undefined; why: NotSaid; rewrite?: string; tokens: Tokens };

// '"Senior" in what sense?'
const OPENS_WITH_A_QUOTE = /^["“]/;

// "…", “…”: some models put them round the whole of what they write. The
// first group is what's inside them.
const QUOTED_WHOLE = /^["“](.*)["”]$/;

// A question that opens with a mark of its own is left as it is: its marks
// can't be told from the model's.
const withoutQuotesAround = (written: string, question: string): string =>
  OPENS_WITH_A_QUOTE.test(question) ? written : written.replace(QUOTED_WHOLE, "$1").trim();

/** `rewriting.question` as it's said to the owner, rewritten by `model`
    within `timeoutMs` and checked against the question. */
export async function rewriteToOwner(
  ai: Ai,
  model: string,
  rewriting: Rewriting,
  timeoutMs: number = TO_OWNER_TIMEOUT_MS,
): Promise<SaidToOwner> {
  const { question, owner } = rewriting;
  let called: Called;
  try {
    const limits = { maxTokens: MAX_TO_OWNER_TOKENS, timeoutMs };
    called = await callForText(ai, model, { messages: askForRewrite(rewriting), temperature: 0 }, limits);
  } catch {
    // A call that failed wasn't run, so it isn't paid for.
    return { outcome: "dropped", why: "error", tokens: NO_TOKENS };
  }
  const { modelReply, tokens } = called;
  if (modelReply === undefined) return { outcome: "dropped", why: "late", tokens };
  const rewrite = withoutQuotesAround(textIn(modelReply), question);
  if (!rewrite) return { outcome: "dropped", why: "empty", tokens };
  // Cut off by MAX_TO_OWNER_TOKENS, it isn't all of the question.
  if (ranOutOfRoom(modelReply)) return { outcome: "dropped", why: "long", rewrite, tokens };
  const checked = checkSameQuestion(rewrite, question, owner);
  if (checked.toOwner === undefined) return { outcome: "dropped", why: checked.why, rewrite, tokens };
  return { outcome: "sent", toOwner: checked.toOwner, rewrite, tokens };
}

/** The question as it's said to the owner, for the email and the message the
    page offers when no answer is shown. Undefined on a page in a language a
    question isn't rewritten in: it then goes as it was typed. */
export function sayToOwner(
  ai: Ai,
  model: string,
  question: string,
  choices: Choices,
): Promise<SaidToOwner> | undefined {
  const { lang, localName } = choices;
  if (!saysToOwnerIn(lang)) return undefined;
  return rewriteToOwner(ai, model, { question, lang, name: localName, owner: ownerNames(choices) });
}
