/* The Worker's fixed names and numbers: its paths, limits, and what
   AskGuard stores. The settings (ASK_*) are in settings.ts, the models and
   their prices in ask/known-models.ts, and the contract with the page in
   src/contracts/ask.ts.

   Two things here are called a guard. Llama Guard (LLAMA_GUARD_*) is the
   model that reads each question for abuse; AskGuard (ASK_GUARD_*) is the
   Durable Object that counts the day's questions and keeps the blocks.

   Nothing here may use a type only Workers has: tests/config.test.ts reads
   ask/quote.ts, and so this file, with Node's types alone. (That's why the
   Durable Object locations are in settings.ts.) */

import { ASK_INDEX_FILE } from "../contracts/ask.ts";

/** The answers it picks from, as the build writes them (/ask.json). */
export const ASK_INDEX_PATH = `/${ASK_INDEX_FILE}`;

// ---- The picker ------------------------------------------------------------------

/** The most the picker may write: its tool call, with the sentence or two
    of thinking the call starts with (pick.ts), and any reasoning of the
    model's own. What it writes costs several times what it reads, and the
    day's budget counts what was really used. */
export const MAX_PICK_TOKENS = 1024;

/** The most a model told not to reason on its own may write: the call's
    thinking is a sentence or two, and the rest of it a few dozen tokens. */
export const MAX_PLAIN_PICK_TOKENS = 512;

/** The one tool the picker may call. */
export const PICK_TOOL_NAME = "pick_answer";

/** What the picker may say instead of an answer's id: the question is
    rude, or tries to make the model do something else. */
export const INAPPROPRIATE = "inappropriate";

/** The most of the picker's thinking that's kept, in characters: a log
    line is for reading, and the thinking was asked to be short. */
export const MAX_THOUGHT_LENGTH = 400;

// ---- Llama Guard -----------------------------------------------------------------

/** How it's run: its verdict ("safe", or "unsafe" and the categories) is a
    few tokens, and the first word is all that's read, so it's cut short
    and not left to chance. */
export const LLAMA_GUARD_OPTIONS = { max_tokens: 10, temperature: 0 } as const;

/** How long the pick waits for its verdict, in milliseconds. */
export const LLAMA_GUARD_TIMEOUT_MS = 2500;

/** About what Llama Guard reads besides the question: its own instructions
    and categories, in tokens. Used for a verdict that came too late to say
    what it used. */
export const LLAMA_GUARD_PROMPT_TOKENS = 250;

// ---- What a call costs -----------------------------------------------------------

/** How many tokens a Price is for. */
export const TOKENS_PER_PRICE = 1_000_000;

/** The fewest bytes of text a token is counted as, for a call that didn't
    say what it used (cost.ts): a token is rarely under three bytes of
    English, or under one Japanese character (three bytes), so the count
    errs high. */
export const MIN_BYTES_PER_TOKEN = 3;

/** How many decimal places a question's cost has in the log, in Neurons. */
export const LOGGED_NEURON_DECIMALS = 1;

// ---- Limits, and who's asking ------------------------------------------------------

/** A visitor with this many questions or fewer left today is told so (or,
    where a visitor's limit is under three times this, a third of it). */
export const WARN_AT_QUESTIONS_LEFT = 10;

/** The header Cloudflare puts the visitor's address in. */
export const VISITOR_ADDRESS_HEADER = "CF-Connecting-IP";

/** What stands for the address of a request that came without one. */
export const UNKNOWN_VISITOR_ADDRESS = "unknown";

/** How much of the hash is kept, in bytes: the first half of a SHA-256,
    which is 32 hex characters. Changing it starts everyone afresh too. */
export const VISITOR_HASH_BYTES = 16;

/** How many of an IPv6 address's eight groups name its network: the first
    64 bits, which one home or phone is given all of. */
export const IPV6_NETWORK_GROUPS = 4;

// ---- AskGuard ----------------------------------------------------------------------

/** The name the site's one AskGuard is found by. */
export const ASK_GUARD_NAME = "ask";

/** Where its requests go. Any host does: a Durable Object gets whatever
    it's sent. */
export const ASK_GUARD_ORIGIN = "https://guard";

/** What it's asked: to take one question from the day's allowances, to
    block a visitor, or to add what a question cost to the day's. */
export const ASK_GUARD_PATH = { take: "/take", block: "/block", spend: "/spend" } as const;

/** What /take says in its query. */
export type TakeQuery = {
  /** The most questions the whole site may be asked today. */
  limit: string;
  /** The most one visitor may ask today. */
  each: string;
  /** The most Neurons the day's questions may cost. */
  budget: string;
  /** The visitor, as the hash of their address. */
  who: string;
};

/** What /block says in its query. */
export type BlockQuery = {
  /** How many hours the block lasts. */
  hours: string;
  /** The visitor, as the hash of their address. */
  who: string;
};

/** What /spend says in its query. */
export type SpendQuery = {
  /** What a question's model calls cost. */
  neurons: string;
};

/** What it answers: to /take, "ok <questions left>" or another of these
    (client.ts's Gate says what each means); to /block and /spend, "ok". */
export const ASK_GUARD_REPLY = { ok: "ok", limited: "limited", spent: "spent", blocked: "blocked" } as const;

/** What it keeps. These keys are the deployed site's state, so they stay:
    - today: { day, used, neurons }, the site's questions on that day, and
      the Neurons they cost (not there before the first is counted);
    - count + who: { day, asked }, one visitor's;
    - block + who: when their block runs out (ms since 1970). */
export const ASK_GUARD_KEYS = { today: "today", count: "count:", block: "block:" } as const;

/** storage.delete() takes at most this many keys at once. */
export const MAX_KEYS_PER_DELETE = 128;

/** An hour, in milliseconds: a block's length is given in hours. */
export const MS_PER_HOUR = 3_600_000;
