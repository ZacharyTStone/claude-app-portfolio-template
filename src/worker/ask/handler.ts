/* POST /ask, from the request to the reply:

   1. admit() turns away what can't go to the model: a bad request, Ask
      turned off, a visitor past a limit, a day's budget spent.
   2. pickWhileModerating() has the model pick an answer while Llama Guard
      reads the question. Either can call the question inappropriate, and
      then turnAway() blocks the visitor.
   3. answerToShow() drops a pick that doesn't name what was asked, and
      replyFrom() has a reply written from the lines picked, which goes
      with those lines for the page to show under it (or quotes them, when
      no reply passes its check). With no answer to show, saidToOwner() has
      the question rewritten as it's said to the owner, for the email and
      the message the page offers instead (or leaves it as typed, when no
      rewrite passes its check).
   4. What the calls cost goes to AskGuard once the reply has gone, and one
      line goes to the log.

   Every reply is an AskResponse, or a 4xx. */
import type { AskAnswer, AskResponse } from "../../contracts/ask.ts";
import { INAPPROPRIATE, LOGGED_NEURON_DECIMALS, WARN_AT_QUESTIONS_LEFT } from "../constants.ts";
import type { Env } from "../env.ts";
import { guardFor, type Guard } from "../guard/client.ts";
import type { Gate } from "../guard/wire.ts";
import { HTTP_STATUS, json } from "../lib/http.ts";
import { readSettings, type Settings } from "../settings.ts";
import { hashAddress, visitorAddress } from "../lib/visitor.ts";
import { ownerNames, readChoices, type Choices } from "./answers.ts";
import { NO_TOKENS, neuronCost } from "./cost.ts";
import { covers } from "./coverage.ts";
import { LLAMA_GUARD_MODEL, priceOf } from "./known-models.ts";
import { llamaGuardVerdict } from "./moderation.ts";
import { pick, type Picked } from "./pick.ts";
import type { QuoteCheck } from "./quote.ts";
import { NONE } from "./prompts/wording.ts";
import { NO_REPLY, replyFrom } from "./reply.ts";
import { readAskRequest, refuseUnlessJsonPost, type CheckedAskRequest } from "./request.ts";
import { sayToOwner, type NotSaid } from "./to-owner.ts";
import type { Unwritten } from "./write.ts";

const respond = (data: AskResponse, status: number = HTTP_STATUS.ok) => json(data, status);

// ---- The log ---------------------------------------------------------------------------

/** One JSON line per question (wrangler.jsonc, at ASK_LOG_QUESTIONS, says
    what's in it). Fields left undefined are left out. The owner reads these
    names in Workers Logs, so they stay as they are. */
type LogLine = {
  /** What came of the question: the id of the answer shown, "none",
      "blocked", "refused" (turned away before the model) or "error". */
  ask: string;
  /** What the question's model calls cost, in Neurons. */
  neurons?: number;
  /** With "refused": the limit it was turned away at, or "down". */
  why?: string;
  /** With "error": a Workers AI error's number, or the kind of error. */
  error?: string;
  /** The answer picked, which didn't name what was asked (coverage.ts). */
  uncovered?: string;
  /** Whether a reply was written from the lines picked and passed its
      check, and if not, why. */
  wrote?: "sent" | "dropped";
  unwritten?: Unwritten;
  /** Whether those lines could be quoted instead, and if not, why. */
  reply?: "sent" | "dropped";
  check?: QuoteCheck;
  /** With no answer shown: whether the question was rewritten as it's said
      to the owner, for the page's email and message, and passed its check;
      and if not, why. Neither on a page in a language it isn't rewritten
      in. */
  toOwner?: "sent" | "dropped";
  unaddressed?: NotSaid;
  /** The model ran out of room to write before it had picked. */
  cut?: true;
  /** What the visitor typed. This and the five below are logged only with
      ASK_LOG_QUESTIONS on: each may repeat the question. */
  question?: string;
  /** What the model made of the question before it picked. */
  thought?: string;
  /** The line numbers the model gave. */
  chose?: string;
  /** The names and numbers a reply it wrote had that those lines don't. */
  unsaid?: string;
  /** The reply sent, written or quoted. */
  said?: string;
  /** What the model wrote as the question said to the owner, sent or not. */
  rewrote?: string;
};
const log = (line: LogLine) => console.log(JSON.stringify(line));

// Neurons as the log has them: to LOGGED_NEURON_DECIMALS decimal places.
function roundedForLog(neurons: number): number {
  const scale = 10 ** LOGGED_NEURON_DECIMALS;
  return Math.round(neurons * scale) / scale;
}

// What's logged of an error: a Workers AI error's number ("3036" for
// "3036: account limited") or the kind of error, never its message, which
// could repeat the question.
function errorCode(error: unknown): string {
  const code = error instanceof Error ? /^\d+(?=:)/.exec(error.message)?.[0] : undefined;
  if (code) return code;
  return error instanceof Error && /^\w+Error$/.test(error.name) ? error.name : "unknown";
}

// ---- The request, from start to finish -------------------------------------------------

/** What the handler needs of Cloudflare's ExecutionContext: a way to finish
    something after the reply has gone. */
type AfterReply = Pick<ExecutionContext, "waitUntil">;

/** Answers a request to /ask. */
export async function handleAsk(request: Request, env: Env, executionContext: AfterReply): Promise<Response> {
  const admitted = await admit(request, env);
  return admitted instanceof Response ? admitted : answer(env, executionContext, admitted);
}

// ---- 1. Whether the question may go to the model ---------------------------------------

/** A question that may go to the model, and what answering it needs. */
type Admitted = {
  /** The question, and the language of the page it was typed on. */
  askRequest: CheckedAskRequest;
  /** The visitor, as the hash of their address. */
  visitorHash: string;
  /** How many more questions they may ask today, this one taken off. */
  questionsLeft: number;
  /** The site's answers, still being read when this is made. */
  choicesBeingRead: Promise<Choices>;
  settings: Settings;
  guard: Guard;
};

// The question in the request, if it may go to the model; otherwise the
// reply that turns it away. Each check comes before anything dearer than
// it: nothing is read for a request that isn't a JSON POST, and nothing is
// counted for a visitor who's asking too fast.
async function admit(request: Request, env: Env): Promise<Admitted | Response> {
  const refusal = refuseUnlessJsonPost(request);
  if (refusal) return refusal;
  const settings = readSettings(env);
  if (!settings.enabled) return respond({ id: null, why: "off" });
  const visitorHash = await hashAddress(visitorAddress(request), settings.salt);
  const rateLimit = await checkRateLimit(env.ASK_LIMIT, visitorHash);
  if (rateLimit === "busy") return respond({ id: null, why: "busy" }, HTTP_STATUS.tooManyRequests);
  if (rateLimit === "down") {
    log({ ask: "refused", why: "down" });
    return respond({ id: null, why: "budget" });
  }
  const askRequest = await readAskRequest(request);
  if (askRequest instanceof Response) return askRequest;
  // The answers are read while AskGuard (in North America) is asked, not
  // after: one less wait.
  const choicesBeingRead = readChoices(env.ASSETS, request, askRequest.lang);
  choicesBeingRead.catch(() => {}); // a reply before it's awaited leaves it unhandled otherwise
  const guard = guardFor(env.ASK_GUARD, settings);
  const gate = await guard.takeQuestion(visitorHash);
  if (gate.state === "ok") {
    return { askRequest, visitorHash, questionsLeft: gate.questionsLeft, choicesBeingRead, settings, guard };
  }
  // Turned away here, the reply is a 200 like any other, so the log is the
  // only place a visitor at a limit, or a guard that's down, can be seen.
  log({ ask: "refused", why: gate.state, question: settings.logQuestions ? askRequest.question : undefined });
  return respond(refusalAt(gate, settings.visitorLimit));
}

// Whether the visitor is under the minute's limit ("ok") or over it
// ("busy"). A limiter that's missing or fails ("down") lets no one through.
async function checkRateLimit(limiter: RateLimit | undefined, visitorHash: string): Promise<"ok" | "busy" | "down"> {
  try {
    if (!limiter) return "down";
    return (await limiter.limit({ key: visitorHash })).success ? "ok" : "busy";
  } catch {
    return "down";
  }
}

// What a visitor AskGuard turned away is told.
function refusalAt(gate: Exclude<Gate, { state: "ok" }>, visitorLimit: number): AskResponse {
  switch (gate.state) {
    case "blocked":
      return { blocked: true };
    case "limited":
      return { id: null, limited: true, limit: visitorLimit };
    case "spent":
    case "down":
      return { id: null, why: "budget" };
  }
}

// ---- 2 to 4. The answer ----------------------------------------------------------------

// Has the model pick an answer and a reply made from it, and sends them; or
// blocks a visitor whose question was inappropriate. Anything that fails
// on the way is logged, and the visitor gets no pick.
async function answer(env: Env, executionContext: AfterReply, admitted: Admitted): Promise<Response> {
  const { askRequest, questionsLeft, choicesBeingRead, settings } = admitted;
  const { question } = askRequest;
  const loggedQuestion = settings.logQuestions ? question : undefined;
  try {
    const choices = await choicesBeingRead;
    const {
      picked,
      isInappropriate,
      costNeurons: pickCostNeurons,
    } = await pickWhileModerating(env.AI, settings, question, choices);
    if (isInappropriate) return await turnAway(executionContext, admitted, picked, pickCostNeurons);

    const { answer: answerShown, uncoveredId } = answerToShow(picked.id, question, choices);
    const reply = answerShown
      ? await replyFrom(
          env.AI,
          settings.model,
          { question, answer: answerShown, lineNumbers: picked.sentences },
          choices,
        )
      : NO_REPLY;
    // With no answer, the page offers a message to the owner with the
    // question in it: said to them, where it can be.
    const addressed = answerShown ? undefined : await sayToOwner(env.AI, settings.model, question, choices);
    const costNeurons =
      pickCostNeurons +
      neuronCost(reply.written?.tokens ?? NO_TOKENS, settings.price) +
      neuronCost(addressed?.tokens ?? NO_TOKENS, settings.price);
    // What the calls cost goes on the day's count once the reply has gone:
    // the visitor doesn't wait for it.
    executionContext.waitUntil(admitted.guard.spendNeurons(costNeurons));
    const { written, quoted } = reply;
    const logsQuestion = loggedQuestion !== undefined;
    log({
      ask: answerShown?.id ?? NONE,
      neurons: roundedForLog(costNeurons),
      uncovered: uncoveredId,
      wrote: written ? (written.reply === undefined ? "dropped" : "sent") : undefined,
      unwritten: written?.why,
      reply: quoted?.outcome,
      check: quoted?.check,
      toOwner: addressed ? (addressed.toOwner === undefined ? "dropped" : "sent") : undefined,
      unaddressed: addressed?.why,
      cut: picked.ranOutOfRoom,
      question: loggedQuestion,
      // Its thinking may repeat the question, and so may what it wrote, so
      // they're logged only with it.
      thought: logsQuestion ? picked.thought : undefined,
      chose: logsQuestion && quoted ? JSON.stringify(picked.sentences) : undefined,
      unsaid: logsQuestion && written?.unsourced?.length ? written.unsourced.join(" ") : undefined,
      said: logsQuestion ? reply.text : undefined,
      rewrote: logsQuestion ? addressed?.rewrite : undefined,
    });
    const left = questionsLeft <= warnAtQuestionsLeft(settings.visitorLimit) ? questionsLeft : undefined;
    if (!answerShown) return respond({ id: null, toOwner: addressed?.toOwner, left });
    if (reply.text === undefined) return respond({ id: answerShown.id, left });
    return respond({ id: answerShown.id, reply: reply.text, cited: reply.cited, left });
  } catch (error) {
    log({ ask: "error", error: errorCode(error), question: loggedQuestion });
    return respond({ id: null, why: "error" });
  }
}

// A visitor is told how many questions they have left once it's this few:
// WARN_AT_QUESTIONS_LEFT, or a third of a limit too small for that to be
// near its end.
const warnAtQuestionsLeft = (visitorLimit: number) => Math.min(WARN_AT_QUESTIONS_LEFT, Math.floor(visitorLimit / 3));

/** What the picker chose, and what the two models made of the question. */
type ModeratedPick = {
  picked: Picked;
  /** The picker or Llama Guard called the question inappropriate. */
  isInappropriate: boolean;
  /** What the two calls cost, in Neurons. */
  costNeurons: number;
};

// The model picks while Llama Guard reads the question: neither waits for
// the other.
async function pickWhileModerating(
  ai: Ai,
  settings: Settings,
  question: string,
  choices: Choices,
): Promise<ModeratedPick> {
  const [picked, verdict] = await Promise.all([
    pick(ai, settings.model, question, choices),
    llamaGuardVerdict(ai, question),
  ]);
  return {
    picked,
    isInappropriate: picked.id === INAPPROPRIATE || verdict.isUnsafe,
    costNeurons: neuronCost(picked.tokens, settings.price) + neuronCost(verdict.tokens, priceOf(LLAMA_GUARD_MODEL)),
  };
}

// Turns an inappropriate question away, and blocks its asker. The models
// read it all the same, so what that cost is counted.
async function turnAway(
  executionContext: AfterReply,
  { askRequest, visitorHash, settings, guard }: Admitted,
  picked: Picked,
  costNeurons: number,
): Promise<Response> {
  executionContext.waitUntil(guard.spendNeurons(costNeurons));
  await guard.blockVisitor(visitorHash);
  log({
    ask: "blocked",
    neurons: roundedForLog(costNeurons),
    question: settings.logQuestions ? askRequest.question : undefined,
    // Its thinking may repeat the question, so it's logged only with it.
    thought: settings.logQuestions ? picked.thought : undefined,
  });
  return respond({ blocked: true, flagged: true });
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
