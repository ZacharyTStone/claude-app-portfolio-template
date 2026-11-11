/* The contract for Ask: the build writes every answer to /ask.json
   (AskIndex), the page POSTs a visitor's question to /ask (AskRequest), and
   the Worker says which answer answers it (AskResponse). */

import { personalTab } from "./page-data.ts";

/** The index's file name on the site, which the Worker reads at /ask.json. */
export const ASK_INDEX_FILE = "ask.json";

/** Longest question the page sends and the Worker reads. */
export const MAX_QUESTION_LENGTH = 300;

/** Largest request body the Worker reads, in bytes. */
export const MAX_REQUEST_BYTES = 2048;

/** Longest reply the Worker sends and the page shows, in characters. */
export const MAX_REPLY_LENGTH = 280;

/** Where Ask's Worker answers, under the site's path: the pages send a
    typed question there, and wrangler.jsonc runs the Worker first there. */
export const ASK_PATH = "/ask";

/** One answer /ask can pick. */
export type AskAnswer = {
  /** "work.2" is the second question in the "work" thread;
      "personal-food.1" the personal answer "food". */
  id: string;
  /** The title of the tab it's from: the words the model reads it by. */
  title: string;
  /** Its question. */
  q: string;
  /** The answer, as plain text. */
  text: string;
};

/** /ask.json. */
export type AskIndex = {
  /** Whose site it is, for the model's instructions ("Alex Example"). */
  name: string;
  /** Their name as each language writes it ({ ja: "アレックス・イグザンプル" }),
      so a question in that language may use it. */
  names?: Record<string, string>;
  /** Who they are, in a few words ("a software engineer"). */
  role: string;
  /** The site's main language: the answers to use for any other. */
  main: string;
  /** The answers, in each of the site's languages. */
  answers: Record<string, AskAnswer[]>;
};

/** What the page sends. */
export type AskRequest = {
  question: string;
  /** The page's language (<html lang>). */
  lang: string;
};

/** What /ask replies. The page shows a picked answer from its own copy,
    word for word; with a reply, the reply first (as text, never HTML),
    then where it's from, then the answer, folded. */
export type AskResponse =
  // The answer picked, or null for none (the "Something else" reply); with
  // an id, maybe a reply: one or two of that answer's own sentences, the
  // ones that answer the question (src/worker/ask/quote.ts); and, when
  // they're few, the questions the visitor has left today.
  | { id: string | null; reply?: string; left?: number }
  // The question was inappropriate (`flagged`), or the visitor was blocked
  // for one earlier: the page goes without Ask for the rest of the visit.
  | { blocked: true; flagged?: true }
  // The visitor has asked `limit` today, the most there is.
  | { id: null; limited: true; limit: number }
  // No pick, and why, for the logs.
  | { id: null; why: AskSkipReason };

export type AskSkipReason = "off" | "busy" | "budget" | "error";

/** The id of a thread's nth answer (from 1). */
export const threadAnswerId = (thread: string, n: number): string => `${thread}.${n}`;

/** The id of a personal answer: the one answer in its tab. */
export const personalAnswerId = (personal: string): string => threadAnswerId(personalTab(personal), 1);

// Control and format characters: line breaks, zero-width and bidi marks.
const CONTROL = /[\p{Cc}\p{Cf}\u2028\u2029]/u;

/** Text the page can show as a reply: a string with something in it, at
    most MAX_REPLY_LENGTH characters, with no control or format characters
    (so one line, and nothing hidden or reordered). The Worker quotes only
    sentences that pass it, and the page checks what it's sent. */
export const isReplyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "" && value.length <= MAX_REPLY_LENGTH && !CONTROL.test(value);
