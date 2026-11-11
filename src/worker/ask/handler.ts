/* POST /ask: admit() turns away what can't go to the model (a bad request,
   a visitor past a limit), then answer() picks while Llama Guard reads the
   question, and quotes the pick. Every reply is an AskResponse, or a 4xx. */
import type { AskResponse } from "../../shared/ask.ts";
import { INAPPROPRIATE, NONE, WARN_AT } from "../constants.ts";
import { readSettings, type Env, type Settings } from "../env.ts";
import { block, take } from "../guard/client.ts";
import { json } from "../lib/http.ts";
import { hashAddress, visitorAddress } from "../lib/visitor.ts";
import { readChoices, type Choices } from "./answers.ts";
import { covers } from "./coverage.ts";
import { isUnsafe } from "./moderation.ts";
import { pick } from "./pick.ts";
import { quote, type QuoteCheck } from "./quote.ts";
import { readQuestion, refuseRequest, type Question } from "./request.ts";

const respond = (data: AskResponse, status = 200) => json(data, status);

/** One JSON line per question (wrangler.jsonc, at ASK_LOG_QUESTIONS, says
    what's in it). Fields left undefined are left out. */
type LogLine = {
  ask: string;
  why?: string;
  error?: string;
  /** The answer picked, which didn't name what was asked (coverage.ts). */
  uncovered?: string;
  reply?: "sent" | "dropped";
  check?: QuoteCheck;
  question?: string;
  /** The sentence numbers the model gave, and the reply quoted from them. */
  chose?: string;
  said?: string;
};
const log = (line: LogLine) => console.log(JSON.stringify(line));

/** A question that may go to the model, and what answering it needs. */
type Admitted = { asked: Question; who: string; left: number; choices: Promise<Choices>; settings: Settings };

export async function handleAsk(request: Request, env: Env): Promise<Response> {
  const admitted = await admit(request, env);
  return admitted instanceof Response ? admitted : answer(env, admitted);
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

async function answer(env: Env, { asked, who, left, choices, settings }: Admitted): Promise<Response> {
  const question = settings.logQuestions ? asked.question : undefined;
  try {
    const answers = await choices;
    const [picked, unsafe] = await Promise.all([
      pick(env.AI, settings.model, asked.question, answers),
      isUnsafe(env.AI, asked.question),
    ]);
    if (picked.id === INAPPROPRIATE || unsafe) {
      await block(env.ASK_GUARD, who, settings);
      log({ ask: "blocked", question });
      return respond({ blocked: true, flagged: true });
    }
    const found = answers.answers.find((item) => item.id === picked.id);
    // An answer that doesn't name what was asked ("Does Alex use Vercel?"
    // answered by skills that don't say Vercel) would read as a "no" that
    // may not be true: the visitor is told to ask the owner instead.
    const uncovered = found && !covers(found, asked.question, ownerNames(answers)) ? found.id : undefined;
    const shown = uncovered ? undefined : found;
    const quoted = shown ? quote(shown.text, picked.sentences) : null;
    log({
      ask: shown?.id ?? NONE,
      uncovered,
      reply: quoted?.outcome,
      check: quoted?.check,
      question,
      chose: question && quoted ? JSON.stringify(picked.sentences) : undefined,
      said: question ? quoted?.reply : undefined,
    });
    return respond({ id: shown?.id ?? null, reply: quoted?.reply, left: left <= WARN_AT ? left : undefined });
  } catch (error) {
    log({ ask: "error", error: errorCode(error), question });
    return respond({ id: null, why: "error" });
  }
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
