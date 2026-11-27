import type { AskAnswer } from "../../contracts/ask.ts";
import type { Env } from "../env.ts";
import { guardFor, type Guard } from "../guard/client.ts";
import { readSettings, type Settings } from "../settings.ts";
import { admit, type Admitted } from "./admit.ts";
import { ownerNames, type Choices } from "./answers.ts";
import { NO_TOKENS, neuronCost, type Tokens } from "./cost.ts";
import { covers } from "./coverage.ts";
import { isCrude } from "./crude.ts";
import { earlierQuestions, earlierTurns } from "./earlier.ts";
import { LLAMA_GUARD_MODEL, priceOf, type Price } from "./known-models.ts";
import { lineFor, type LogSink } from "./log.ts";
import { llamaGuardVerdict } from "./moderation.ts";
import { neuronsSpentOn, responseTo, type Outcome } from "./outcome.ts";
import { pick, type Picked } from "./pick.ts";
import { INAPPROPRIATE, type Asking } from "./prompts/pick.ts";
import { replyFrom } from "./reply.ts";
import { sayToOwner } from "./to-owner.ts";

/** A way to finish something after the reply has gone. */
type AfterReply = Pick<ExecutionContext, "waitUntil">;

/** Answers a request to /ask. What came of it, an Outcome, says what the
    visitor is told, what the log gets and what the day's count is charged. */
export async function handleAsk(request: Request, env: Env, afterReply: AfterReply, log: LogSink): Promise<Response> {
  const settings = readSettings(env);
  const guard = guardFor(env.ASK_GUARD, settings);
  const outcome = await outcomeOf(request, env, settings, guard);

  // The visitor doesn't wait for the day's count to take what they cost.
  const neurons = neuronsSpentOn(outcome);
  if (neurons !== undefined) afterReply.waitUntil(guard.spendNeurons(neurons));
  if (outcome.kind === "flagged") await guard.blockVisitor(outcome.visitorHash);
  const line = lineFor(outcome, settings.logQuestions);
  if (line) log(line);
  return responseTo(outcome);
}

async function outcomeOf(request: Request, env: Env, settings: Settings, guard: Guard): Promise<Outcome> {
  const admission = await admit(request, env, settings, guard);
  if (admission.kind !== "admitted") return admission;
  try {
    return await answer(env.AI, settings, admission);
  } catch (error) {
    return { kind: "failed", error, question: admission.askRequest.question, neurons: 0 };
  }
}

async function answer(ai: Ai, settings: Settings, admitted: Admitted): Promise<Outcome> {
  const { question } = admitted.askRequest;
  const choices = await admitted.choicesBeingRead;
  const earlier = earlierTurns(admitted.askRequest.earlier, choices);
  const asking = { question, earlier };
  // A word no question needs turns it away before either model reads it (crude.ts).
  if (isCrude(question))
    return { kind: "flagged", ...asking, picked: CRUDE, visitorHash: admitted.visitorHash, neurons: 0 };
  const moderated = await pickWhileModerating(ai, settings, asking, choices);
  if ("error" in moderated) return { kind: "failed", error: moderated.error, question, neurons: moderated.costNeurons };
  const { picked, isInappropriate, costNeurons } = moderated;
  const asked = { ...asking, picked };
  if (isInappropriate) return { kind: "flagged", ...asked, visitorHash: admitted.visitorHash, neurons: costNeurons };
  if (picked.ranOutOfTime) return { kind: "timedOut", ...asked, neurons: costNeurons };

  const answeredIn = choices.lang === admitted.askRequest.lang ? {} : { lang: choices.lang };
  const allowance = { questionsLeft: admitted.questionsLeft, visitorLimit: settings.visitorLimit, ...answeredIn };
  // A pick has to cover the question as it was typed: a follow-up that
  // names nothing ("how long?") is covered by any answer.
  const { answer: answerShown, uncoveredId } = answerToShow(picked.id, question, choices);
  if (answerShown) {
    const chosen = { question, earlier: earlierQuestions(earlier), answer: answerShown, lineNumbers: picked.sentences };
    const reply = await replyFrom(ai, settings.model, chosen, choices);
    const neurons = costNeurons + neuronsFor(reply.written?.tokens, settings.price);
    return { kind: "answered", ...asked, ...allowance, answer: answerShown, reply, neurons };
  }
  const saidToOwner = await sayToOwner(ai, settings.model, question, choices);
  const neurons = costNeurons + neuronsFor(saidToOwner?.tokens, settings.price);
  return { kind: "unanswered", ...asked, ...allowance, uncoveredId, saidToOwner, neurons };
}

// What a call that may not have been made cost, in Neurons: with no
// tokens, it wasn't.
const neuronsFor = (tokens: Tokens | undefined, price: Price): number => neuronCost(tokens ?? NO_TOKENS, price);

/** What a question with a word no question needs is taken as: called inappropriate, with no model asked. */
const CRUDE: Picked = {
  id: INAPPROPRIATE,
  thought: "A word on the list no question needs (crude.ts).",
  tokens: NO_TOKENS,
};

/** What the picker chose, and what the two models made of the question. */
type ModeratedPick = {
  picked: Picked;
  /** The picker or Llama Guard called the question inappropriate. */
  isInappropriate: boolean;
  /** What the two calls cost, in Neurons. */
  costNeurons: number;
};

/** The pick failed: Workers AI couldn't run the picker's model. Llama
    Guard ran beside it all the same, and `costNeurons` is what it cost. */
type FailedPick = { error: unknown; costNeurons: number };

// The model picks while Llama Guard reads the question: neither waits for
// the other. Llama Guard reads only the question: the earlier ones were
// asked already, or are the site's own, and the picker judges only the
// last. A pick that fails doesn't stop Llama Guard, which is paid for
// whether or not the pick is: its verdict is waited for either way.
async function pickWhileModerating(
  ai: Ai,
  settings: Settings,
  asking: Asking,
  choices: Choices,
): Promise<ModeratedPick | FailedPick> {
  const [picking, verdict] = await Promise.all([
    pick(ai, settings.model, asking, choices).then(
      (picked) => ({ picked }),
      (error: unknown) => ({ error }),
    ),
    llamaGuardVerdict(ai, asking.question),
  ]);
  const verdictNeurons = neuronCost(verdict.tokens, priceOf(LLAMA_GUARD_MODEL));
  if ("error" in picking) return { error: picking.error, costNeurons: verdictNeurons };
  const { picked } = picking;
  return {
    picked,
    isInappropriate: picked.id === INAPPROPRIATE || verdict.isUnsafe,
    costNeurons: neuronCost(picked.tokens, settings.price) + verdictNeurons,
  };
}

/** The answer the page is to show for a pick: the one picked (`answer`), or
    none. When the one picked doesn't name what was asked, none is shown and
    `uncoveredId` is its id, for the log. */
type AnswerToShow = { answer?: AskAnswer; uncoveredId?: string };

// The answer the picker's id names, if it names one and that answer covers
// the question. An answer that doesn't name what was asked ("Does Alex use
// Vercel?" answered by skills that don't say Vercel) would read as a "no"
// that may not be true: the visitor is told to ask the owner instead.
function answerToShow(pickedId: string | null, question: string, choices: Choices): AnswerToShow {
  const pickedAnswer = choices.answers.find((answer) => answer.id === pickedId);
  if (!pickedAnswer) return {};
  const isCovered = covers(pickedAnswer, question, ownerNames(choices));
  return isCovered ? { answer: pickedAnswer } : { uncoveredId: pickedAnswer.id };
}
