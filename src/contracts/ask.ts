/* Ask's wire formats: the build writes every answer to /ask.json, the page
   POSTs a visitor's question to /ask, and the Worker says which answer
   answers it. Each format is a schema with its type read off it. The
   browser code imports only the types and the plain checks, and the
   bundler has to be able to drop every schema from its script: a spread
   of one into another keeps them all (tests/contracts/page-script.test.ts). */

import * as v from "valibot";
import { ID_PATTERN } from "../config/language.ts";
import { isCount } from "./guards.ts";
import { personalTabId } from "./page-ids.ts";

/** wrangler.jsonc runs the Worker first at this path, under the site's own. */
export const ASK_PATH = "/ask";

export const ASK_INDEX_FILE = "ask.json";

export const MAX_QUESTION_LENGTH = 300;

export const MAX_REQUEST_BYTES = 2048;

/** Room for two of an answer's lines quoted, and the sentence before one
    that can't be read without it. */
export const MAX_REPLY_LENGTH = 400;

/** The lines the picker named, and for each the sentences before it that
    it can't be read without. */
export const MAX_CITED_LINES = 8;

/** Room for two lines as long as a reply may be. Lines longer than that
    are not sent at all, rather than cut: what's cited is the site's words
    as they are, or nothing. */
export const MAX_CITED_LENGTH = 800;

const LABEL_KINDS = ["picture", "link"] as const;

type LabelKind = (typeof LABEL_KINDS)[number];

/** A line of an answer's text that only names something the page shows:
    "(picture: The home page)". The model reads it to know what's there;
    it isn't the owner's sentence, so Ask never quotes it. */
export const labelled = (kind: LabelKind, name: string): string => `(${kind}: ${name})`;

// A whole line that `labelled` wrote: "(picture: The home page)", "(link: Resume)".
const LABEL_LINE = new RegExp(`^\\((?:${LABEL_KINDS.join("|")}): .*\\)$`, "u");

export const isLabel = (line: string): boolean => LABEL_LINE.test(line);

/** "work.2": a thread's answers are counted from 1. */
export const threadAnswerId = (threadId: string, answerNumber: number): string => `${threadId}.${answerNumber}`;

/** "personal-food.1": a personal answer is the one answer in its own tab. */
export const personalAnswerId = (personalId: string): string => threadAnswerId(personalTabId(personalId), 1);

type AnswerPlace = { tabId: string; answerNumber: number };

// As threadAnswerId writes it: "2", never "02", "2.0" or "1e1".
const ANSWER_NUMBER = /^[1-9][0-9]*$/;

/** parseAnswerId("work.2") is { tabId: "work", answerNumber: 2 }. Null for
    anything threadAnswerId wouldn't have written. */
export function parseAnswerId(id: string): AnswerPlace | null {
  const lastDot = id.lastIndexOf(".");
  if (lastDot === -1) return null;
  const tabId = id.slice(0, lastDot);
  const answerNumber = id.slice(lastDot + 1);
  if (!ID_PATTERN.test(tabId) || !ANSWER_NUMBER.test(answerNumber)) return null;
  return Number.isSafeInteger(Number(answerNumber)) ? { tabId, answerNumber: Number(answerNumber) } : null;
}

const AskAnswerSchema = v.object({
  /** "work.2" is the second question in the "work" thread;
      "personal-food.1" the personal answer "food". */
  id: v.string(),
  /** The title of the tab it's from: the words the model reads it by. */
  title: v.string(),
  q: v.string(),
  /** Plain text: a line for each of the answer's blocks (a paragraph, a
      list's item, a card's row, a figure), a picture or a link as a label
      (`labelled`). */
  text: v.string(),
});

/** One answer /ask can pick, as /ask.json has it. */
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
  /** By language. */
  answers: v.record(v.string(), v.array(AskAnswerSchema)),
});

export type AskIndex = v.InferOutput<typeof AskIndexSchema>;

export type AskRequest = {
  question: string;
  /** The page's <html lang>. */
  lang: string;
};

// Control and format characters: line breaks, zero-width and bidi marks.
const CONTROL = /[\p{Cc}\p{Cf}\u2028\u2029]/u;

/** Text the page can show: something in it, one line, nothing hidden or
    reordered. The Worker sends only text that passes, and the page checks
    what it's sent. */
const isShowableText = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.trim() !== "" && value.length <= maxLength && !CONTROL.test(value);

export const isReplyText = (value: unknown): value is string => isShowableText(value, MAX_REPLY_LENGTH);

export const isQuestionToOwner = (value: unknown): value is string => isShowableText(value, MAX_QUESTION_LENGTH);

export const isCitedLines = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length >= 1 &&
  value.length <= MAX_CITED_LINES &&
  value.every((line: unknown) => isShowableText(line, MAX_CITED_LENGTH) && !isLabel(line)) &&
  value.join("").length <= MAX_CITED_LENGTH;

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
  /** A sentence or two written from the answer's lines
      (src/worker/ask/write.ts), or those lines as they are (quote.ts). */
  reply: v.custom<string>(isReplyText),
  /** The site's own lines a written reply was made from, for the page to
      show under it: each a line of the answer as /ask.json has it, in the
      answer's order. Never with a reply that is those lines themselves. */
  cited: v.optional(v.custom<string[]>(isCitedLines)),
  /** The questions the visitor has left today, when they're few. */
  left: v.optional(Count),
});

/** No answer says what was asked: the page shows how to reach the owner
    (the "Something else" reply), with the question in an email and a
    message to send them. */
const AskUnansweredSchema = v.strictObject({
  id: v.null(),
  /** The question as it's said to the owner ("Do you know testing?" for
      "Does Alex know testing?"), for that email and message
      (src/worker/ask/to-owner.ts). Without one, it goes in as it was typed. */
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
  /** How many questions a day that is. */
  limit: Count,
});

/** No pick was made. */
const AskSkippedSchema = v.strictObject({
  id: v.null(),
  /** For the logs: Ask is turned off, the visitor is asking too fast, the
      site's day is used up (or its counter can't be reached), or something
      failed. */
  why: v.picklist(["off", "busy", "budget", "error"]),
});

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

/** A kind's own fields, and never another kind's. So no reply is of two
    kinds, and one field says which kind a reply is: `response.blocked`,
    `response.limited`, `response.id`, `response.reply`. */
type ReplyKind<Schema extends v.GenericSchema> = v.InferOutput<Schema> & {
  [Other in Exclude<ReplyField, keyof v.InferOutput<Schema>>]?: never;
};

export type AskPicked = ReplyKind<typeof AskPickedSchema>;
export type AskReplied = ReplyKind<typeof AskRepliedSchema>;
export type AskUnanswered = ReplyKind<typeof AskUnansweredSchema>;
export type AskBlocked = ReplyKind<typeof AskBlockedSchema>;
export type AskLimited = ReplyKind<typeof AskLimitedSchema>;
export type AskSkipped = ReplyKind<typeof AskSkippedSchema>;

export type AskResponse = AskPicked | AskReplied | AskUnanswered | AskBlocked | AskLimited | AskSkipped;

/** For a test to check a reply against. A kind it reads and AskResponse
    leaves out doesn't compile. */
export const AskResponseSchema = v.union(REPLY_KINDS) satisfies v.GenericSchema<unknown, AskResponse>;
