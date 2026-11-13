/* With no answer to show, the page offers an email and a message to the
   owner with the question in them, where the question was typed about the
   owner ("Does Alex know testing?"). So one small call says it to them ("Do
   you know testing?"). It's asked once: a rewrite that isn't the same
   question, or doesn't come, leaves the question as it was typed. */
import { ownerNames, type Choices } from "./answers.ts";
import { checkSameQuestion, type Refused } from "./checks/same-question.ts";
import { NO_TOKENS, type Tokens } from "./cost.ts";
import { callForText, ranOutOfRoom, textIn, type Called, type Prompt } from "./model.ts";
import { askForRewrite, isRewrittenLanguage, type Rewriting } from "./prompts/to-owner.ts";

/** The question over again, which is a line or two at its longest. */
export const MAX_TO_OWNER_TOKENS = 120;

/** The visitor waits for it. */
const TO_OWNER_TIMEOUT_MS = 3000;

export const saysToOwnerIn = isRewrittenLanguage;

/** Why a question wasn't said to the owner: the rewrite was refused; or
    - empty: the model wrote nothing;
    - late: it ran out of time;
    - error: it couldn't be reached. */
export type NotSaid = Refused | "empty" | "late" | "error";

/** A rewrite that passed the check is `sent` as `toOwner`. `rewrite` is
    what the model wrote, whether or not it passed: for the log. */
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

export async function rewriteToOwner(
  ai: Ai,
  model: string,
  rewriting: Rewriting,
  timeoutMs: number = TO_OWNER_TIMEOUT_MS,
): Promise<SaidToOwner> {
  const { question, owner } = rewriting;
  const prompt: Prompt = { messages: askForRewrite(rewriting), temperature: 0 };
  let called: Called;
  try {
    called = await callForText(ai, model, prompt, { maxTokens: MAX_TO_OWNER_TOKENS, timeoutMs });
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

/** Undefined on a page in a language a question isn't rewritten in: it
    then goes as it was typed. */
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
