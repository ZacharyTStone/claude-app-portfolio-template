/* The Worker with everything it's bound to stood in for, so its tests need
   no network or account: what each stand-in was asked, and what the Worker
   logged. */
import { ASK_INDEX_PATH } from "../../../src/worker/ask/answers.ts";
import { handleAsk } from "../../../src/worker/ask/handler.ts";
import { LLAMA_GUARD_MODEL } from "../../../src/worker/ask/known-models.ts";
import type { LogLine } from "../../../src/worker/ask/log.ts";
import { MAX_TO_OWNER_TOKENS } from "../../../src/worker/ask/to-owner.ts";
import type { Env } from "../../../src/worker/env.ts";
import { VISITOR_ADDRESS_HEADER } from "../../../src/worker/lib/visitor.ts";
import { INDEX } from "./answers.ts";
import { guardStub, type GuardStub } from "./guard.ts";
import { toolCall, wrote, type Call, type ModelInput, type Run } from "./models.ts";

/** The visitor's address, as Cloudflare gives it. */
export const ADDRESS = "203.0.113.9";

export type Options = {
  /** What the picker and Llama Guard say (`models()` makes one). */
  run?: Run;
  /** What the model writes when it's asked for a reply: each time it's
      asked, the next of these (the last, from then on). Nothing, unless a
      test is about what's written. */
  writes?: unknown[];
  /** What it writes when it's asked to say the question to the owner.
      Nothing, unless a test is about that. */
  rewrites?: unknown[];
  /** What AskGuard says to a question it's asked to take. */
  guardSays?: string;
  guard?: GuardStub;
  /** The rate limiter, if not one that lets every question through. */
  limit?: (options: { key: string }) => Promise<{ success: boolean }>;
  /** Bindings to leave out. */
  without?: ("ASK_GUARD" | "ASK_LIMIT")[];
  /** What /ask.json serves: a Response as it is, anything else as JSON. */
  index?: unknown;
  /** The settings (ASK_ENABLED is "true" unless it's given). */
  vars?: Partial<Record<keyof Env, string>>;
  /** Where the Worker's log lines go, for a test that asks several Workers
      and reads what they logged between them. */
  logged?: LogLine[];
};

// Asked for a reply, or to say a question to the owner, the stand-in
// writes nothing and uses nothing: a test about picking or quoting is the
// same with or without either.
const WRITES_NOTHING = [wrote("", [0, 0])];

/** What the log says of a reply the stand-in was asked for and didn't
    write: a line's fields after `ask`. */
export const UNWRITTEN = { wrote: "dropped", unwritten: "empty" } as const;

/** What the log says of a question with no answer, which the stand-in was
    asked to say to the owner and didn't: a line's fields after `ask`. */
export const UNADDRESSED = { toOwner: "dropped", unaddressed: "empty" } as const;

/** The next of `texts` for the call that makes `madeSoFar` calls of its
    kind: the last, once they've run out. */
function nextOf(texts: unknown[], madeSoFar: number): unknown {
  const said = texts[Math.min(madeSoFar, texts.length) - 1];
  if (said instanceof Error) throw said;
  return said;
}

/** How a request is sent, where it isn't as the page sends one. */
export type Send = { method?: string; type?: string; url?: string; headers?: Record<string, string> };

/** The request the page sends with `body` (a JSON POST to /ask). */
export function askRequest(body: unknown, how: Send = {}): Request {
  const { method = "POST", type = "application/json", url = "https://site.example/ask", headers } = how;
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(url, {
    method,
    headers: { "Content-Type": type, [VISITOR_ADDRESS_HEADER]: ADDRESS, ...headers },
    body: method === "POST" ? text : undefined,
  });
}

/** Runs `handle` with a stand-in for Cloudflare's context, and waits for
    what it leaves until after its reply (a question's cost, sent to
    AskGuard). */
export async function withContext(handle: (context: ExecutionContext) => Promise<Response>): Promise<Response> {
  const after: Promise<unknown>[] = [];
  // Only what the Worker uses of its context is stood in for.
  const context = { waitUntil: (work: Promise<unknown>) => void after.push(work) } as unknown as ExecutionContext;
  const response = await handle(context);
  await Promise.all(after);
  return response;
}

/** A stand-in Workers AI, and what each of the four kinds of call was
    sent: the picker's, the writer's, the one that says a question to the
    owner, and Llama Guard's. */
function aiStandIn({ run = () => toolCall("about.1"), writes = WRITES_NOTHING, rewrites = WRITES_NOTHING }: Options) {
  const calls: Call[] = [];
  const writeCalls: Call[] = [];
  const rewriteCalls: Call[] = [];
  const guardCalls: Call[] = [];
  const text = (model: string, input: ModelInput) => {
    // A call to the picker's model with no tool is for a line of text: the
    // question said to the owner if it may write only as much as that
    // takes, else a reply.
    const isRewrite = input.max_completion_tokens === MAX_TO_OWNER_TOKENS;
    const [textCalls, texts] = isRewrite ? [rewriteCalls, rewrites] : [writeCalls, writes];
    textCalls.push({ model, input });
    return nextOf(texts, textCalls.length);
  };
  const ai = {
    run: async (model: string, input: ModelInput) => {
      if (model !== LLAMA_GUARD_MODEL && !input.tools) return text(model, input);
      (model === LLAMA_GUARD_MODEL ? guardCalls : calls).push({ model, input });
      return run(model, input);
    },
  };
  return { ai, calls, writeCalls, rewriteCalls, guardCalls };
}

/** The Worker's bindings, stood in for; what each model call was sent;
    the keys the rate limiter was asked about; and what the Worker logged.
    `ask` sends it what the page would. */
export function stubs(options: Options = {}) {
  const { guard = guardStub(options.guardSays), limit = async () => ({ success: true }), index = INDEX } = options;
  const { without = [], logged = [] } = options;
  const { ai, ...modelCalls } = aiStandIn(options);
  const limitKeys: string[] = [];
  const bindings: Record<string, unknown> = {
    ASK_ENABLED: "true",
    ...options.vars,
    AI: ai,
    ASK_GUARD: guard,
    ASSETS: {
      fetch: async (request: Request) => {
        if (new URL(request.url).pathname !== ASK_INDEX_PATH) return new Response("a static file");
        return index instanceof Response ? index : new Response(JSON.stringify(index));
      },
    },
    ASK_LIMIT: {
      limit: (asked: { key: string }) => {
        limitKeys.push(asked.key);
        return limit(asked);
      },
    },
  };
  for (const name of without) delete bindings[name];
  // Only what the Worker uses is stood in for, so this is cast to the real
  // bindings.
  const env = bindings as unknown as Env;
  const send = (request: Request) =>
    withContext((context) => handleAsk(request, env, context, (line) => void logged.push(line)));
  const ask = (body: unknown, how?: Send) => send(askRequest(body, how));
  /** What /ask replies to `question`, as JSON. */
  const askJson = async (question: string, lang = "en"): Promise<unknown> => (await ask({ question, lang })).json();
  return { env, ...modelCalls, guard, limitKeys, logged, send, ask, askJson };
}

/** The lines logged, as JSON, without what each question cost (`costs` has
    that). */
export const lines = (logged: LogLine[]): string[] => logged.map(({ neurons: _cost, ...line }) => JSON.stringify(line));

/** What each logged question cost, in Neurons; undefined for a line without. */
export const costs = (logged: LogLine[]): unknown[] => logged.map((line) => line.neurons);
