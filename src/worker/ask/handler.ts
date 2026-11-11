/* POST /ask: admit() turns away what can't go to the model (a bad request,
   a visitor past a limit, a day's budget spent), then answer() picks while
   Llama Guard reads the question, has a reply written from the lines
   picked (or quotes them, when none passes its check), and has what the
   calls cost counted. Every reply is an AskResponse, or a 4xx. */
import type { AskAnswer, AskResponse } from "../../shared/ask.ts";
import { GUARD_MODEL, INAPPROPRIATE, NONE, PRICES, UNLISTED_PRICE, WARN_AT } from "../constants.ts";
import { readSettings, type Env, type Settings } from "../env.ts";
import { block, spend, take } from "../guard/client.ts";
import { json } from "../lib/http.ts";
import { hashAddress, visitorAddress } from "../lib/visitor.ts";
import { readChoices, type Choices } from "./answers.ts";
import { neurons } from "./cost.ts";
import { covers } from "./coverage.ts";
import { verdictOn } from "./moderation.ts";
import { pick } from "./pick.ts";
import { cited, quote, type QuoteCheck } from "./quote.ts";
import { readQuestion, refuseRequest, type Question } from "./request.ts";
import { write, writesIn, type Unwritten, type Written } from "./write.ts";

const respond = (data: AskResponse, status = 200) => json(data, status);

/** One JSON line per question (wrangler.jsonc, at ASK_LOG_QUESTIONS, says
    what's in it). Fields left undefined are left out. */
type LogLine = {
  ask: string;
  /** What the question's model calls cost, in Neurons. */
  neurons?: number;
  why?: string;
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
  /** The model ran out of room to write before it had picked. */
  cut?: true;
  question?: string;
  /** What the model made of the question before it picked. */
  thought?: string;
  /** The line numbers the model gave; the words a reply it wrote had that
      those lines don't; and the reply sent, written or quoted. */
  chose?: string;
  unsaid?: string;
  said?: string;
};
const log = (line: LogLine) => console.log(JSON.stringify(line));

/** A question that may go to the model, and what answering it needs. */
type Admitted = { asked: Question; who: string; left: number; choices: Promise<Choices>; settings: Settings };

/** Something to finish after the reply has gone (ExecutionContext's). */
type Later = Pick<ExecutionContext, "waitUntil">;

export async function handleAsk(request: Request, env: Env, later: Later): Promise<Response> {
  const admitted = await admit(request, env);
  return admitted instanceof Response ? admitted : answer(env, later, admitted);
}

async function admit(request: Request, env: Env): Promise<Admitted | Response> {
  const refused = refuseRequest(request);
  if (refused) return refused;
  const settings = readSettings(env);
  if (!settings.enabled) return respond({ id: null, why: "off" });
  const who = await hashAddress(visitorAddress(request), settings.salt);
  const rate = await rateLimit(env.ASK_LIMIT, who);
  if (rate === "busy") return respond({ id: null, why: "busy" }, 429);
  if (rate === "down") {
    log({ ask: "refused", why: "down" });
    return respond({ id: null, why: "budget" });
  }
  const asked = await readQuestion(request);
  if (asked instanceof Response) return asked;
  // The answers are read while AskGuard (in North America) is asked, not
  // after: one less wait.
  const choices = readChoices(env.ASSETS, request, asked.lang);
  choices.catch(() => {}); // a reply before it's awaited leaves it unhandled otherwise
  const gate = await take(env.ASK_GUARD, who, settings);
  if (gate.state === "ok") return { asked, who, left: gate.left, choices, settings };
  // Turned away here, the reply is a 200 like any other, so the log is the
  // only place a visitor at a limit, or a guard that's down, can be seen.
  log({ ask: "refused", why: gate.state, question: settings.logQuestions ? asked.question : undefined });
  if (gate.state === "blocked") return respond({ blocked: true });
  if (gate.state === "limited") return respond({ id: null, limited: true, limit: gate.limit });
  return respond({ id: null, why: "budget" });
}

// A visitor is told how many questions they have left once it's this few:
// WARN_AT, or a third of a limit too small for that to be near its end.
const warnAt = (visitorLimit: number) => Math.min(WARN_AT, Math.floor(visitorLimit / 3));

// Neurons as the log has them: to one decimal place.
const rounded = (amount: number) => Math.round(amount * 10) / 10;

async function answer(env: Env, later: Later, { asked, who, left, choices, settings }: Admitted): Promise<Response> {
  const question = settings.logQuestions ? asked.question : undefined;
  try {
    const answers = await choices;
    const [picked, verdict] = await Promise.all([
      pick(env.AI, settings.model, asked.question, answers),
      verdictOn(env.AI, asked.question),
    ]);
    // What the calls cost goes on the day's count once the reply has gone:
    // the visitor doesn't wait for it.
    const read =
      neurons(picked.tokens, settings.price) + neurons(verdict.tokens, PRICES.get(GUARD_MODEL) ?? UNLISTED_PRICE);
    if (picked.id === INAPPROPRIATE || verdict.unsafe) {
      later.waitUntil(spend(env.ASK_GUARD, read, settings));
      await block(env.ASK_GUARD, who, settings);
      log({ ask: "blocked", neurons: rounded(read), question, thought: question ? picked.thought : undefined });
      return respond({ blocked: true, flagged: true });
    }
    const found = answers.answers.find((item) => item.id === picked.id);
    // An answer that doesn't name what was asked ("Does Alex use Vercel?"
    // answered by skills that don't say Vercel) would read as a "no" that
    // may not be true: the visitor is told to ask the owner instead.
    const uncovered = found && !covers(found, asked.question, ownerNames(answers)) ? found.id : undefined;
    const shown = uncovered ? undefined : found;
    // The reply is written from the lines picked, and checked against
    // them; if none passes, the lines are quoted as they are, where they're
    // sentences. Where no reply is written at all (a language the check
    // can't read), any line is quoted, as it always was.
    const written = shown
      ? await writeFrom(env.AI, settings.model, asked, shown, picked.sentences, answers)
      : undefined;
    const quoted = shown ? quote(shown.text, picked.sentences, { sentencesOnly: written !== undefined }) : null;
    const reply = written?.reply ?? quoted?.reply;
    const cost = read + (written ? neurons(written.tokens, settings.price) : 0);
    later.waitUntil(spend(env.ASK_GUARD, cost, settings));
    log({
      ask: shown?.id ?? NONE,
      neurons: rounded(cost),
      uncovered,
      wrote: written ? (written.reply === undefined ? "dropped" : "sent") : undefined,
      unwritten: written?.why,
      reply: quoted?.outcome,
      check: quoted?.check,
      cut: picked.cut,
      question,
      // Its thinking may repeat the question, and so may what it wrote, so
      // they're logged only with it.
      thought: question ? picked.thought : undefined,
      chose: question && quoted ? JSON.stringify(picked.sentences) : undefined,
      unsaid: question && written?.unsaid?.length ? written.unsaid.join(" ") : undefined,
      said: question ? reply : undefined,
    });
    return respond({
      id: shown?.id ?? null,
      reply,
      left: left <= warnAt(settings.visitorLimit) ? left : undefined,
    });
  } catch (error) {
    log({ ask: "error", error: errorCode(error), question });
    return respond({ id: null, why: "error" });
  }
}

// A reply to the question, written from the lines of `answer` the picker
// chose; undefined when there are none to write from, or the page's
// language isn't one a reply can be checked in.
async function writeFrom(
  ai: Ai,
  model: string,
  { question }: Question,
  { text, title, q }: AskAnswer,
  sentences: unknown,
  choices: Choices,
): Promise<Written | undefined> {
  const lines = cited(text, sentences);
  if (lines === null || !writesIn(choices.lang)) return undefined;
  const { name, role, lang } = choices;
  return write(ai, model, { question, lang, lines, title, q, name, role, owner: ownerNames(choices) });
}

// The owner's name, and as the page's language writes it if that differs:
// what a question may name besides the answer's own words.
const ownerNames = ({ name, localName }: Choices) => (localName === name ? name : `${name} ${localName}`);

// Whether the visitor is under the minute's limit. A limiter that's
// missing or fails lets no one through.
async function rateLimit(limiter: RateLimit | undefined, key: string): Promise<"ok" | "busy" | "down"> {
  try {
    if (!limiter) return "down";
    return (await limiter.limit({ key })).success ? "ok" : "busy";
  } catch {
    return "down";
  }
}

// What's logged of an error: a Workers AI error's number ("3036" for
// "3036: account limited") or the kind of error, never its message, which
// could repeat the question.
function errorCode(error: unknown): string {
  const code = error instanceof Error ? /^\d+(?=:)/.exec(error.message)?.[0] : undefined;
  if (code) return code;
  return error instanceof Error && /^\w+Error$/.test(error.name) ? error.name : "unknown";
}
