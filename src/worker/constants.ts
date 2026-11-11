/* The Worker's fixed names and numbers: its paths, models, prices, limits,
   and what AskGuard stores. The settings (ASK_*) are in env.ts, and the
   contract with the page in src/shared/ask.ts. */

import { ASK_INDEX_FILE } from "../shared/ask.ts";

/** The answers it picks from, as the build writes them (/ask.json). */
export const ASK_INDEX_PATH = `/${ASK_INDEX_FILE}`;

// ---- Workers AI ------------------------------------------------------------------

/** The model that picks, unless ASK_MODEL names another. */
export const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";

/** The most the picker may write: its tool call, with the sentence or two
    of thinking the call starts with (pick.ts), and any reasoning of the
    model's own. What it writes costs several times what it reads, and the
    day's budget counts what was really used. */
export const MAX_PICK_TOKENS = 1024;

/** The most a model told not to reason on its own may write: the call's
    thinking is a sentence or two, and the rest of it a few dozen tokens. */
export const MAX_PLAIN_PICK_TOKENS = 512;

/** How each model is told to keep its own reasoning short or off: the
    thinking the pick needs is in the tool call, where it's a sentence or
    two and the log can show it. With that, how much a model that doesn't
    reason may write. Any other model is called without options. */
export const MODEL_OPTIONS: ReadonlyMap<string, Record<string, unknown>> = new Map([
  [DEFAULT_MODEL, { chat_template_kwargs: { enable_thinking: false }, max_completion_tokens: MAX_PLAIN_PICK_TOKENS }],
  ["@cf/qwen/qwen3.8-27b", { reasoning_effort: "low" }],
  [
    "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
    { reasoning_effort: "none", max_completion_tokens: MAX_PLAIN_PICK_TOKENS },
  ],
]);

/** The most the model may write for a reply (write.ts): a sentence, and
    room for a model that reasons a little first. */
export const MAX_WRITE_TOKENS = 256;

/** The longest reply it may write, in characters: a sentence, not a
    paragraph. A longer one is asked for again, shorter. */
export const MAX_WRITTEN = 240;

/** How many times it's asked: once, and once more with what was wrong. */
export const WRITE_TRIES = 2;

/** How long the writing may take in all, in milliseconds: past it, the
    lines are quoted as they are. The page waits 12 s for /ask. */
export const WRITE_TIMEOUT = 5000;

/** Llama Guard, which reads every question beside the picker. */
export const GUARD_MODEL = "@cf/meta/llama-guard-3-8b";

/** How it's run: its verdict ("safe", or "unsafe" and the categories) is a
    few tokens, and the first word is all that's read, so it's cut short
    and not left to chance. */
export const GUARD_OPTIONS = { max_tokens: 10, temperature: 0 } as const;

/** How long the pick waits for its verdict, in milliseconds. */
export const GUARD_TIMEOUT = 2500;

/** About what Llama Guard reads besides the question: its own instructions
    and categories, in tokens. Used for a verdict that came too late to say
    what it used. */
export const GUARD_PROMPT_TOKENS = 250;

/** The one tool the picker may call, and what it may say besides an id. */
export const PICK_TOOL = "pick_answer";
/** No answer says what was asked. */
export const NONE = "none";
/** The question is rude, or tries to make the model do something else. */
export const INAPPROPRIATE = "inappropriate";

// ---- What a call costs -----------------------------------------------------------

/** A model's price: Neurons for a million tokens read, and for a million
    written (developers.cloudflare.com/workers-ai/platform/pricing). */
export type Price = { input: number; output: number };

/** The prices of the models above. The day's budget (ASK_DAILY_NEURONS) is
    counted with these, so when Cloudflare changes one, change it here. */
export const PRICES: ReadonlyMap<string, Price> = new Map([
  [DEFAULT_MODEL, { input: 5_500, output: 36_400 }],
  ["@cf/qwen/qwen3.8-27b", { input: 40_909, output: 290_909 }],
  ["@cf/deepseek-ai/deepseek-v4.1-flash-1017", { input: 27_273, output: 109_091 }],
  [GUARD_MODEL, { input: 44_003, output: 2_730 }],
]);

/** A model with no price here is counted at the dearest picker's, so the
    budget stops early rather than late; ASK_MODEL_PRICE gives its own. */
export const UNLISTED_PRICE: Price = { input: 40_909, output: 290_909 };

// ---- Limits ------------------------------------------------------------------------

/** A visitor with this many questions or fewer left today is told so (or,
    where a visitor's limit is under three times this, a third of it). */
export const WARN_AT = 10;

/** What a visitor's address is hashed with, unless ASK_SALT says. The hash
    keys their rate limit, count and any block, so changing it starts
    everyone afresh (counts are per day and blocks last a day, so nothing
    much is lost). */
export const VISITOR_SALT = "portfolio-ask:";

// ---- AskGuard ----------------------------------------------------------------------

/** The name the site's one AskGuard is found by. */
export const GUARD_NAME = "ask";

/** Where its requests go, and what each says in its query. Any host does:
    a Durable Object gets whatever it's sent. */
export const GUARD_ORIGIN = "https://guard";
export const GUARD_PATH = { take: "/take", block: "/block", spend: "/spend" } as const;
/** `limit` and `each` are the day's questions, the site's and one visitor's;
    `budget` the day's Neurons. */
export type TakeQuery = { limit: string; each: string; budget: string; who: string };
export type BlockQuery = { hours: string; who: string };
export type SpendQuery = { neurons: string };

/** What it answers: to /take, "ok <left>" or another of these (client.ts's
    Gate says what each means); to /block and /spend, "ok". */
export const GUARD_REPLY = { ok: "ok", limited: "limited", spent: "spent", blocked: "blocked" } as const;

/** What it keeps. These keys are the deployed site's state, so they stay:
    - today: { day, used, neurons }, the site's questions on that day, and
      the Neurons they cost (not there before the first is counted);
    - count + who: { day, asked }, one visitor's;
    - block + who: when their block runs out (ms since 1970). */
export const GUARD_KEYS = { today: "today", count: "count:", block: "block:" } as const;

/** storage.delete() takes at most this many keys at once. */
export const DELETE_BATCH = 128;

/** Cloudflare's location hints for a Durable Object (ASK_GUARD_LOCATION is
    one of them). */
export const LOCATIONS: readonly DurableObjectLocationHint[] = [
  "wnam",
  "enam",
  "sam",
  "weur",
  "eeur",
  "apac",
  "oc",
  "afr",
  "me",
];
