/* What the Worker's tests share: a small ask.json, and stand-ins for
   Workers AI, the static files, the rate limiter and AskGuard, so the
   tests need no network or account. */
import assert from "node:assert/strict";
import { mock } from "node:test";
import type { AskAnswer, AskIndex } from "../../src/shared/ask.ts";
import { ASK_INDEX_PATH, GUARD_MODEL, GUARD_PATH, GUARD_REPLY, PICK_TOOL } from "../../src/worker/constants.ts";
import type { Env } from "../../src/worker/env.ts";
import worker from "../../src/worker/index.ts";

// A small ask.json, in the shape the build writes.
export const EN: AskAnswer[] = [
  { id: "about.1", title: "About", q: "who is alex example?", text: "Alex is a senior software engineer." },
  { id: "about.2", title: "About", q: "where's alex based?", text: "New York, working with teams in Europe and Asia." },
  { id: "skills.1", title: "Skills", q: "what does alex work with?", text: "TypeScript, React, Node.js and Postgres." },
  { id: "skills.2", title: "Skills", q: "what languages does alex speak?", text: "English, and Japanese (JLPT N2)." },
  {
    id: "acme.1",
    title: "Acme",
    q: "what does alex do at acme?",
    text: "Alex has been at Acme since 2024. Alex moved the web app to server-rendered pages, which cut the time to first load by 40%.\nTime to load: Before 1.04 s, After 385 ms",
  },
  { id: "notes.2", title: "Pocket Notes", q: "what did alex build?", text: "An offline-first notes app." },
  { id: "contact.1", title: "Contact", q: "how do I reach alex?", text: "By email, or on LinkedIn." },
  { id: "personal-food.1", title: "Food", q: "what's alex's favorite food?", text: "Ramen." },
];
export const JA: AskAnswer[] = [
  { id: "about.1", title: "概要", q: "アレックス・イグザンプルとは？", text: "シニアソフトウェアエンジニアです。" },
  {
    id: "about.2",
    title: "概要",
    q: "どこに住んでいる？",
    text: "ニューヨーク在住で、欧州やアジアのチームと働いています。",
  },
  { id: "skills.1", title: "スキル", q: "使っている技術は？", text: "TypeScript、React、Node.js、Postgres。" },
  { id: "skills.2", title: "スキル", q: "日本語のレベルは？", text: "英語と日本語（JLPT N2）。" },
  {
    id: "acme.1",
    title: "Acme",
    q: "Acmeでは何をしている？",
    text: "2024年からAcmeで働いています。Webアプリをサーバーレンダリングに移行し、初回表示までの時間を40%短縮しました。",
  },
  { id: "notes.2", title: "Pocket Notes", q: "何を作った？", text: "オフライン対応のメモアプリ。" },
  { id: "contact.1", title: "連絡先", q: "連絡方法は？", text: "メールか LinkedIn で。" },
  { id: "personal-food.1", title: "食べ物", q: "好きな食べ物は？", text: "ラーメン。" },
];
export const INDEX: AskIndex = {
  name: "Alex Example",
  role: "a software engineer",
  main: "en",
  answers: { en: EN, ja: JA },
};
export const IDS = EN.map((a) => a.id);

/** The visitor's address, as Cloudflare gives it. */
export const ADDRESS = "203.0.113.9";

/** Keeps the Worker's log lines instead of printing them, for a test file
    that reads them. */
export const captureLogs = () => mock.method(console, "log", () => {});

// The log lines `logs` has kept since it was last reset, as they were written.
const written = (logs: ReturnType<typeof captureLogs>): Record<string, unknown>[] =>
  logs.mock.calls.map((call) => JSON.parse(String(call.arguments[0])));

/** The log lines `logs` has kept since it was last reset, without what each
    question cost (`costs` has that: cost.test.ts checks it). */
export const lines = (logs: ReturnType<typeof captureLogs>): string[] =>
  written(logs).map(({ neurons: _cost, ...line }) => JSON.stringify(line));

/** What each logged question cost, in Neurons; undefined for a line without. */
export const costs = (logs: ReturnType<typeof captureLogs>): unknown[] => written(logs).map((line) => line.neurons);

// What the tests read of what the model was sent.
type ModelInput = {
  messages: { role: string; content: string }[];
  tools: {
    function: {
      parameters: {
        properties: { id: { type: string; enum: string[] }; sentences: { type: string; maxItems: number } };
        required: string[];
      };
    };
  }[];
  [option: string]: unknown;
};
export type Call = { model: string; input: ModelInput };
type Run = (model: string, input: ModelInput) => unknown;

/** "ok <left>", as AskGuard says it to /take. */
export const okLeft = (left: number) => `${GUARD_REPLY.ok} ${left}`;

// The AskGuard object: what /take says (okLeft(), one of GUARD_REPLY, or
// "down" when it can't be reached; /block and /spend get "ok"), and the
// requests it got.
export type GuardStub = {
  requests: URL[];
  last?: { id: unknown; options: unknown };
  idFromName(name: string): string;
  get(id: unknown, options: unknown): { fetch(url: string): Promise<Response> };
};
export function guardStub(says = okLeft(25), status = 200): GuardStub {
  const stub: GuardStub = {
    requests: [],
    idFromName: (name) => name,
    get: (id, options) => ({
      fetch: async (url) => {
        if (says === "down") throw new Error("Durable Object unavailable");
        stub.last = { id, options };
        stub.requests.push(new URL(url));
        return new Response(new URL(url).pathname === GUARD_PATH.take ? says : GUARD_REPLY.ok, { status });
      },
    }),
  };
  return stub;
}

/** The request AskGuard got at `path`, if it got one. */
export const guardRequest = (guard: GuardStub, path: string) => guard.requests.find((url) => url.pathname === path);

/** A stand-in Workers AI: `pick` answers the picker, `guard` Llama Guard.
    An Error is thrown; a Promise is waited for. */
export const models =
  (pick: unknown, guard: unknown = { response: "safe" }): Run =>
  (model) => {
    if (model !== GUARD_MODEL) return pick;
    if (guard instanceof Error) throw guard;
    return guard;
  };

type Options = {
  run?: Run;
  /** What AskGuard says to /take. */
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
};

/** The Worker's bindings, stood in for; what the picker and Llama Guard
    were sent, and the keys the rate limiter was asked about. */
export function stubs({
  run = () => toolCall("about.1"),
  guardSays,
  guard = guardStub(guardSays),
  limit = async () => ({ success: true }),
  without = [],
  index = INDEX,
  vars,
}: Options = {}) {
  const calls: Call[] = [];
  const guardCalls: Call[] = [];
  const limitKeys: string[] = [];
  const bindings: Record<string, unknown> = {
    ASK_ENABLED: "true",
    ...vars,
    ASK_GUARD: guard,
    ASSETS: {
      fetch: async (request: Request) => {
        if (new URL(request.url).pathname !== ASK_INDEX_PATH) return new Response("a static file");
        return index instanceof Response ? index : new Response(JSON.stringify(index));
      },
    },
    ASK_LIMIT: {
      limit: (options: { key: string }) => {
        limitKeys.push(options.key);
        return limit(options);
      },
    },
    AI: {
      run: async (name: string, input: ModelInput) => {
        (name === GUARD_MODEL ? guardCalls : calls).push({ model: name, input });
        return run(name, input);
      },
    },
  };
  for (const name of without) delete bindings[name];
  // Only what the Worker uses is stood in for, so this is cast to the real
  // bindings.
  return { env: bindings as unknown as Env, calls, guardCalls, guard, limitKeys };
}

/** The picker's reply when it calls pick_answer with `id`, and the
    `sentences` it gave, if any. */
export const toolCall = (id: string, sentences?: unknown) => ({
  choices: [
    {
      message: {
        tool_calls: [{ type: "function", function: { name: PICK_TOOL, arguments: JSON.stringify({ id, sentences }) } }],
      },
    },
  ],
});

/** A model's reply that also says what its call used, as Workers AI does. */
export const using = <Reply extends object>(reply: Reply, prompt_tokens: number, completion_tokens: number) => ({
  ...reply,
  usage: { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens },
});

type Send = { method?: string; type?: string; url?: string; headers?: Record<string, string> };

/** Sends the Worker a request, and waits for what it leaves until after
    its reply (a question's cost, sent to AskGuard). */
export async function send(env: Env, request: Request): Promise<Response> {
  const after: Promise<unknown>[] = [];
  // Only what the Worker uses of its context is stood in for.
  const context = { waitUntil: (promise: Promise<unknown>) => void after.push(promise) } as unknown as ExecutionContext;
  const response = await worker.fetch(request, env, context);
  await Promise.all(after);
  return response;
}

/** Sends `body` to the Worker, as the page would (a JSON POST to /ask). */
export const ask = (
  env: Env,
  body: unknown,
  { method = "POST", type = "application/json", url = "https://site.example/ask", headers }: Send = {},
) =>
  send(
    env,
    new Request(url, {
      method,
      headers: { "Content-Type": type, "CF-Connecting-IP": ADDRESS, ...headers },
      body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),
  );

/** What /ask replies to `question` on the English page, as JSON. */
export const askJson = async (env: Env, question: string, lang = "en"): Promise<unknown> =>
  (await ask(env, { question, lang })).json();

/** The first call to the picker, which there must have been. */
export function firstCall(calls: Call[]): Call {
  const [call] = calls;
  assert.ok(call, "the model was called");
  return call;
}
export const systemMessage = (calls: Call[]) => firstCall(calls).input.messages[0]?.content ?? "";
export const offered = (calls: Call[]) => firstCall(calls).input.tools[0]?.function.parameters.properties.id.enum;
export const toolParameters = (calls: Call[]) => firstCall(calls).input.tools[0]?.function.parameters;
