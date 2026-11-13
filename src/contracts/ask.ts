/* The contract for Ask: the build writes every answer to /ask.json
   (AskIndex), the page POSTs a visitor's question to /ask (AskRequest), and
   the Worker says which answer answers it (AskResponse).

   /ask.json and /ask's reply are declared as schemas, with their types
   read off them, so each shape is written once: what the build writes is
   what the Worker checks for, and what the Worker sends is what a test
   can check a reply against. The browser never uses the schemas, so they
   add nothing to its script. */

import * as v from "valibot";
import { ID_PATTERN } from "../config/language.ts";
import { isCount } from "./guards.ts";
import { personalTabId } from "./page-ids.ts";

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
export const personalAnswerId = (personal: string): string => threadAnswerId(personalTabId(personal), 1);

/** Where an answer is: its tab, and which of the tab's answers it is,
    counted from 1. */
export type AnswerPlace = { tabId: string; answerNumber: number };

// Which of a tab's answers, as an id has it: a whole number from 1, written
// as threadAnswerId writes it ("2", never "02", "2.0" or "1e1").
const ANSWER_NUMBER = /^[1-9][0-9]*$/;

/** The tab and the answer an answer's id names: parseAnswerId("work.2") is
    { tabId: "work", answerNumber: 2 }, and "personal-food.1" is the first
    answer in the tab "personal-food". Null for anything threadAnswerId
    wouldn't have written: no dot, a tab id that isn't one (ID_PATTERN), or
    a number that isn't a whole one from 1. */
export function parseAnswerId(id: string): AnswerPlace | null {
  const lastDot = id.lastIndexOf(".");
  if (lastDot === -1) return null;
  const tabId = id.slice(0, lastDot);
  const answerNumber = id.slice(lastDot + 1);
  if (!ID_PATTERN.test(tabId) || !ANSWER_NUMBER.test(answerNumber)) return null;
  return Number.isSafeInteger(Number(answerNumber)) ? { tabId, answerNumber: Number(answerNumber) } : null;
}

// ---- POST /ask ---------------------------------------------------------------------

/** What the page sends. */
export type AskRequest = {
  /** What the visitor typed. */
  question: string;
  /** The page's language (<html lang>). */
  lang: string;
};

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

// ---- What /ask replies -------------------------------------------------------------

/** A whole number, 0 or more. */
const Count = v.custom<number>(isCount);

/** An answer was picked: the page shows it from its own copy, word for
    word, then a link to the tab it's in. */
const AskPickedSchema = v.strictObject({
  /** The answer picked: "work.2". */
  id: v.string(),
  /** The questions the visitor has left today, when they're few. */
  left: v.optional(Count),
});

/** An answer was picked, and a reply made from it: the page shows the
    reply instead (as text, never HTML), then a link to the answer's tab. */
const AskRepliedSchema = v.strictObject({
  /** The answer picked: "work.2". */
  id: v.string(),
  /** A sentence or two the model wrote from the lines of that answer that
      say what was asked, with every name and number in it checked against
      them (src/worker/ask/write.ts); or those lines as they are
      (quote.ts). `isReplyText` says what the page takes. */
  reply: v.custom<string>(isReplyText),
  /** With a reply the model wrote: the site's own lines the reply was
      written from, for the page to show under it. Each is one line of the
      answer exactly as /ask.json has it, so plain text, never HTML or
      Markdown (a sentence, a list's item, a card's row, a figure), and
      they're in the answer's order. Never a label, and never with a reply
      that is those lines themselves (quoted, or written word for word the
      same). `isCitedLines` says what the page takes; lines that wouldn't
      pass it aren't sent. */
  cited: v.optional(v.custom<string[]>(isCitedLines)),
  /** The questions the visitor has left today, when they're few. */
  left: v.optional(Count),
});

/** No answer says what was asked: the page shows how to reach the owner
    (the "Something else" reply), with the question in an email and a
    message to send them. */
const AskUnansweredSchema = v.strictObject({
  id: v.null(),
  /** The visitor's question as it's said to the owner ("Do you know
      testing?" for "Does Alex know testing?"), for that email and message.
      A model wrote it, and the Worker checked that it's the same question,
      give or take who it's about (src/worker/ask/to-owner.ts). Without one,
      the question goes in as it was typed. `isQuestionToOwner` says what
      the page takes; one that wouldn't pass it isn't sent. */
  toOwner: v.optional(v.custom<string>(isQuestionToOwner)),
  /** The questions the visitor has left today, when they're few. */
  left: v.optional(Count),
});

/** The visitor may not ask: the page goes without Ask for the rest of the
    visit. */
const AskBlockedSchema = v.strictObject({
  blocked: v.literal(true),
  /** This question was inappropriate. Without it, the visitor was blocked
      for one asked earlier. */
  flagged: v.optional(v.literal(true)),
});

/** The visitor has asked all they may today. */
const AskLimitedSchema = v.strictObject({
  id: v.null(),
  limited: v.literal(true),
  /** How many that is. */
  limit: Count,
});

/** No pick was made. */
const AskSkippedSchema = v.strictObject({
  id: v.null(),
  /** Why, for the logs: Ask is turned off, the visitor is asking too fast,
      the site's day is used up (or its counter can't be reached), or
      something failed. */
  why: v.picklist(["off", "busy", "budget", "error"]),
});

/** Each kind of reply /ask sends. */
const REPLY_KINDS = [
  AskPickedSchema,
  AskRepliedSchema,
  AskUnansweredSchema,
  AskBlockedSchema,
  AskLimitedSchema,
  AskSkippedSchema,
] as const;

/** Every field some kind of reply has. */
type ReplyField<Reply = v.InferOutput<(typeof REPLY_KINDS)[number]>> = Reply extends unknown ? keyof Reply : never;

/** One kind of reply, as its schema reads it: its own fields, and never
    another kind's. So no reply is of two kinds (a reply with no answer, a
    question to the owner beside an answer), and one field says which kind
    a reply is: `response.blocked`, `response.limited`, `response.id`,
    `response.reply`. */
type ReplyKind<Schema extends v.GenericSchema> = v.InferOutput<Schema> & {
  [Other in Exclude<ReplyField, keyof v.InferOutput<Schema>>]?: never;
};

export type AskPicked = ReplyKind<typeof AskPickedSchema>;
export type AskReplied = ReplyKind<typeof AskRepliedSchema>;
export type AskUnanswered = ReplyKind<typeof AskUnansweredSchema>;
export type AskBlocked = ReplyKind<typeof AskBlockedSchema>;
export type AskLimited = ReplyKind<typeof AskLimitedSchema>;
export type AskSkipped = ReplyKind<typeof AskSkippedSchema>;

/** Why no pick was made. */
export type AskSkipReason = AskSkipped["why"];

/** What /ask replies: exactly one of these. */
export type AskResponse = AskPicked | AskReplied | AskUnanswered | AskBlocked | AskLimited | AskSkipped;

/** What /ask replies, as the schema a test checks a reply against: one of
    REPLY_KINDS, with no field that isn't its kind's. A kind it reads and
    AskResponse leaves out doesn't compile. */
export const AskResponseSchema = v.union(REPLY_KINDS) satisfies v.GenericSchema<unknown, AskResponse>;
