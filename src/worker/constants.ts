/* The Worker's fixed names and numbers: its paths, models, limits, and what
   AskGuard stores. The settings (ASK_*) are in env.ts, and the contract with
   the page in src/shared/ask.ts. */

import { ASK_INDEX_FILE } from "../shared/ask.ts";

/** The answers it picks from, as the build writes them (/ask.json). */
export const ASK_INDEX_PATH = `/${ASK_INDEX_FILE}`;

// ---- Workers AI ------------------------------------------------------------------

/** The model that picks, unless ASK_MODEL names another. */
export const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";

/** How each model is told that a pick from a list needs no long reasoning.
    Any other model is called without options. */
export const MODEL_OPTIONS: ReadonlyMap<string, Record<string, unknown>> = new Map([
  [DEFAULT_MODEL, { chat_template_kwargs: { enable_thinking: false } }],
  ["@cf/qwen/qwen3.8-27b", { reasoning_effort: "low" }],
  ["@cf/deepseek-ai/deepseek-v4.1-flash-1017", { reasoning_effort: "none" }],
]);

/** Llama Guard, which reads every question beside the picker. */
export const GUARD_MODEL = "@cf/meta/llama-guard-3-8b";

/** How it's run: its verdict ("safe", or "unsafe" and the categories) is a
    few tokens, and the first word is all that's read, so it's cut short
    and not left to chance. */
export const GUARD_OPTIONS = { max_tokens: 10, temperature: 0 } as const;

/** How long the pick waits for its verdict, in milliseconds. */
export const GUARD_TIMEOUT = 2500;

/** The one tool the picker may call, and what it may say besides an id. */
export const PICK_TOOL = "pick_answer";
/** No answer says what was asked. */
export const NONE = "none";
/** The question is rude, or tries to make the model do something else. */
export const INAPPROPRIATE = "inappropriate";

/** The most the picker may write (its tool call, and any reasoning). */
export const MAX_PICK_TOKENS = 1024;

// ---- Limits ------------------------------------------------------------------------

/** A visitor with this many questions or fewer left today is told so. */
export const WARN_AT = 10;

/** What a visitor's address is hashed with, unless ASK_SALT says. The hash
    keys their rate limit, count and any block, so changing it starts
    everyone afresh (counts are per day and blocks last a day, so nothing
    much is lost). */
export const VISITOR_SALT = "portfolio-ask:";

// ---- AskGuard ----------------------------------------------------------------------

/** The name the site's one AskGuard is found by. */
export const GUARD_NAME = "ask";

/** Where its two requests go, and what each says in its query. Any host
    does: a Durable Object gets whatever it's sent. */
export const GUARD_ORIGIN = "https://guard";
export const GUARD_PATH = { take: "/take", block: "/block" } as const;
export type TakeQuery = { limit: string; each: string; who: string };
export type BlockQuery = { hours: string; who: string };

/** What it answers: to /take, "ok <left>" or another of these (client.ts's
    Gate says what each means); to /block, "ok". */
export const GUARD_REPLY = { ok: "ok", limited: "limited", spent: "spent", blocked: "blocked" } as const;

/** What it keeps. These keys are the deployed site's state, so they stay:
    - today: { day, used }, the site's questions on that day;
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
