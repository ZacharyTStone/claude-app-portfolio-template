/* The contract for Ask: the build writes every answer to /ask.json
   (AskIndex), the page POSTs a visitor's question to /ask (AskRequest), and
   the Worker says which answer answers it (AskResponse).

   /ask.json is declared as a schema, with its type read off it, so the
   shape the build writes and the shape the Worker checks for are written
   once. The browser never uses the schemas, so they add nothing to its
   script. */

import * as v from "valibot";
import { personalTab } from "./page-ids.ts";

// ---- Labels ------------------------------------------------------------------------

const LABEL_KINDS = ["picture", "link"] as const;

/** What a label names: something the page shows that isn't text. */
export type LabelKind = (typeof LABEL_KINDS)[number];

/** A line of an answer's text that only names something the page shows, a
    picture or a link: "(picture: The home page)". The model reads it to
    know what's there; it isn't the owner's sentence, so Ask never quotes it. */
export const labelled = (kind: LabelKind, name: string): string => `(${kind}: ${name})`;

// A whole line that `labelled` wrote: "(picture: The home page)", "(link: Resume)".
const LABEL_LINE = new RegExp(`^\\((?:${LABEL_KINDS.join("|")}): .*\\)$`, "u");

/** Whether a line of an answer's text is a label (`labelled`), not words of
    the owner's. */
export const isLabel = (line: string): boolean => LABEL_LINE.test(line);

// ---- Paths and limits --------------------------------------------------------------

/** The index's file name on the site, which the Worker reads at /ask.json. */
export const ASK_INDEX_FILE = "ask.json";

/** Longest question the page sends and the Worker reads. */
export const MAX_QUESTION_LENGTH = 300;

/** Largest request body the Worker reads, in bytes. */
export const MAX_REQUEST_BYTES = 2048;

/** Longest reply the Worker sends and the page shows, in characters: room
    for two of an answer's lines quoted, and the sentence before one that
    can't be read without it. A reply written from them is shorter. */
export const MAX_REPLY_LENGTH = 400;

/** The most lines a written reply is sent with as the ones it was written
    from (AskPick's `cited`): the lines the picker named, and for each the
    sentences before it that it can't be read without. */
export const MAX_CITED_LINES = 8;

/** The most characters those lines have together: room for two lines as
    long as a reply may be. Lines longer than that are not sent at all,
    rather than cut: what's cited is the site's words as they are, or
    nothing. */
export const MAX_CITED_LENGTH = 800;

/** Where Ask's Worker answers, under the site's path: the pages send a
    typed question there, and wrangler.jsonc runs the Worker first there. */
export const ASK_PATH = "/ask";

// ---- /ask.json ---------------------------------------------------------------------

/** One answer /ask can pick, as /ask.json has it. */
export const AskAnswerSchema = v.object({
  /** "work.2" is the second question in the "work" thread;
      "personal-food.1" the personal answer "food". */
  id: v.string(),
  /** The title of the tab it's from: the words the model reads it by. */
  title: v.string(),
  /** Its question. */
  q: v.string(),
  /** The answer, as plain text: a line for each of its blocks (a paragraph,
      a list's item, a card's row, a figure), a picture or a link as a
      label (`labelled`). */
  text: v.string(),
});

/** One answer /ask can pick. */
export type AskAnswer = v.InferOutput<typeof AskAnswerSchema>;

/** /ask.json, as the build writes it and the Worker checks it. */
export const AskIndexSchema = v.object({
  /** Whose site it is, for the model's instructions ("Alex Example"). */
  name: v.string(),
  /** Their name as each language writes it ({ ja: "アレックス・イグザンプル" }),
      so a question in that language may use it. */
  names: v.optional(v.record(v.string(), v.string())),
  /** Who they are, in a few words ("a software engineer"). */
  role: v.string(),
  /** The site's main language: the answers to use for any other. */
  main: v.string(),
  /** The answers, in each of the site's languages. */
  answers: v.record(v.string(), v.array(AskAnswerSchema)),
});

/** /ask.json. */
export type AskIndex = v.InferOutput<typeof AskIndexSchema>;

/** The id of a thread's nth answer (from 1). */
export const threadAnswerId = (thread: string, n: number): string => `${thread}.${n}`;

/** The id of a personal answer: the one answer in its tab. */
export const personalAnswerId = (personal: string): string => threadAnswerId(personalTab(personal), 1);

// ---- POST /ask ---------------------------------------------------------------------

/** What the page sends. */
export type AskRequest = {
  /** What the visitor typed. */
  question: string;
  /** The page's language (<html lang>). */
  lang: string;
};

/** An answer was picked, or none was: the page shows a picked answer from
    its own copy, word for word; with a reply, the reply instead (as text,
    never HTML), then a link to the tab the answer is in. With none, it
    shows how to reach the owner, with the question in an email and a
    message to send them. */
export type AskPick = {
  /** The answer picked, or null for none (the "Something else" reply). */
  id: string | null;
  /** Only ever with an id: a sentence or two the model wrote from the
      lines of that answer that say what was asked, with every name and
      number in it checked against them (src/worker/ask/write.ts); or those
      lines as they are (quote.ts). */
  reply?: string;
  /** Only ever with a reply the model wrote: the site's own lines the reply
      was written from, for the page to show under it. Each is one line of
      the answer exactly as /ask.json has it, so plain text, never HTML or
      Markdown (a sentence, a list's item, a card's row, a figure), and
      they're in the answer's order. Never a label, and never with a reply
      that is those lines themselves (quoted, or written word for word the
      same). `isCitedLines` says what the page takes; lines that wouldn't
      pass it aren't sent. */
  cited?: string[];
  /** Only ever without an id: the visitor's question as it's said to the
      owner ("Do you know testing?" for "Does Alex know testing?"), for the
      email and the message the page offers in place of an answer. A model
      wrote it, and the Worker checked that it's the same question, give
      or take who it's about (src/worker/ask/address.ts). Without one, the
      question goes in as it was typed. `isQuestionToOwner` says what the
      page takes; one that wouldn't pass it isn't sent. */
  toOwner?: string;
  /** The questions the visitor has left today, when they're few. */
  left?: number;
};

/** The visitor may not ask: the page goes without Ask for the rest of the
    visit. */
export type AskBlocked = {
  blocked: true;
  /** This question was inappropriate. Without it, the visitor was blocked
      for one asked earlier. */
  flagged?: true;
};

/** The visitor has asked all they may today. */
export type AskLimited = {
  id: null;
  limited: true;
  /** How many that is. */
  limit: number;
};

/** No pick was made, and why, for the logs. */
export type AskSkipped = { id: null; why: AskSkipReason };

/** Why no pick was made: Ask is turned off, the visitor is asking too fast,
    the site's day is used up (or its counter can't be reached), or
    something failed. */
export type AskSkipReason = "off" | "busy" | "budget" | "error";

/** What /ask replies. */
export type AskResponse = AskPick | AskBlocked | AskLimited | AskSkipped;

// Control and format characters: line breaks, zero-width and bidi marks.
const CONTROL = /[\p{Cc}\p{Cf}\u2028\u2029]/u;

// Text the page can show: a string with something in it, at most
// `maxLength` characters, with no control or format characters (so one
// line, and nothing hidden or reordered).
const isShowableText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim() !== "" && value.length <= maxLength && !CONTROL.test(value);

/** Text the page can show as a reply: a string with something in it, at
    most MAX_REPLY_LENGTH characters, with no control or format characters
    (so one line, and nothing hidden or reordered). The Worker quotes only
    lines that pass it, and the page checks what it's sent. */
export const isReplyText = (value: unknown): value is string => isShowableText(value, MAX_REPLY_LENGTH);

/** Text the page can put in the email and the message as the visitor's
    question, said to the owner: a string with something in it, at most
    MAX_QUESTION_LENGTH characters (no longer than a question may be), with
    no control or format characters (so one line, and nothing hidden or
    reordered). The Worker sends only a question that passes it, and the
    page checks what it's sent. */
export const isQuestionToOwner = (value: unknown): value is string => isShowableText(value, MAX_QUESTION_LENGTH);

/** Lines the page can show under a written reply as the ones it was
    written from: 1 to MAX_CITED_LINES of them, each text with something in
    it and no control or format characters, none of them a label, and
    together at most MAX_CITED_LENGTH characters. The Worker sends only
    lines that pass it, and the page checks what it's sent. */
export const isCitedLines = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length >= 1 &&
  value.length <= MAX_CITED_LINES &&
  value.every((line: unknown) => isShowableText(line, MAX_CITED_LENGTH) && !isLabel(line)) &&
  value.join("").length <= MAX_CITED_LENGTH;
