/* The reply /ask sends with a pick: one or two of the picked answer's own
   sentences, chosen by number. The model only gives the numbers, so the
   reply is always the owner's words, never the model's. */
import { isReplyText, MAX_REPLY_LENGTH } from "../../shared/ask.ts";
import { isArrayOf, isCount } from "../../shared/guards.ts";

/** The most sentences a reply quotes. */
export const MAX_QUOTED = 2;

/** Why a quote asked for wasn't sent: the numbers aren't a list of at most
    MAX_QUOTED, one names no numbered sentence, the sentences are the whole
    answer (which the page shows anyway), or together they're too long. */
export type QuoteCheck = "unreadable" | "range" | "whole" | "length";

/** The reply, or why it was dropped; null when the model asked for none. */
export type Quoted =
  | { outcome: "sent"; reply: string; check?: undefined }
  | { outcome: "dropped"; check: QuoteCheck; reply?: undefined }
  | null;

const dropped = (check: QuoteCheck): Quoted => ({ outcome: "dropped", check });

/** A piece of an answer's text: a sentence, or what's left of a line after
    its last one (a figure's line, a link's name), and its number if it may
    be quoted. */
export type Piece = { text: string; sentence: boolean; n?: number };

const ENDS = new Set([".", "!", "?", "。", "！", "？"]);
// Japanese ends a sentence with no space after it; the others need one.
const WIDE_ENDS = new Set(["。", "！", "？"]);
const OPENS = new Set(["(", "（", "“", "「", "『"]);
const CLOSES = new Set([")", "）", "”", "」", "』"]);
// A full stop that ends a word, not a sentence: "e.g. React".
const ABBREVIATION = /(?:^|[\s(（])(?:e\.g|i\.e|vs|cf|approx|Mr|Mrs|Ms|Dr|St|Jr|Sr)\.$/i;
// A bracket just after a sentence belongs to it: "…the team.” (A coworker)".
const TRAILING_BRACKET = /^\s*[(（](?:[^()（）]|[(（][^()（）]*[)）])*[)）]/;
// What ask.json makes of a card ("company: Acme; role: …") and a flow
// ("Draft → Review"), which aren't sentences to quote even when a line of
// one ends in a full stop.
const FIGURE = /[;→]/;

/** The text's pieces, a line at a time: ask.json gives each block of an
    answer (a paragraph, a list's item, a figure) a line of its own, so a
    figure's words never run into the sentence after it. */
export const piecesOf = (text: string): Piece[] => text.split("\n").flatMap(piecesOfLine);

// A line, cut into sentences after a full stop, question or exclamation
// mark (and any closing quotes or brackets after it) that's outside quotes
// and brackets: in Japanese (。！？) right there, unless it closes a quote
// the sentence goes on from; otherwise only before a space and something
// other than a lower-case letter, and not after an abbreviation.
function piecesOfLine(text: string): Piece[] {
  const pieces: Piece[] = [];
  const add = (piece: string, sentence: boolean) => {
    if (piece.trim()) pieces.push({ text: piece.trim(), sentence });
  };
  let start = 0;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (OPENS.has(char)) depth++;
    else if (CLOSES.has(char)) depth = Math.max(0, depth - 1);
    else if (ENDS.has(char)) {
      const end = sentenceEnd(text, i, depth);
      if (end === null) continue;
      add(text.slice(start, end), true);
      start = end;
      depth = 0;
      i = end - 1;
    }
  }
  add(text.slice(start), false);
  return pieces;
}

// Where the sentence whose mark is at `i` ends, or null if it doesn't.
function sentenceEnd(text: string, i: number, depth: number): number | null {
  const quoted = depth > 0;
  let end = i + 1;
  for (; end < text.length; end++) {
    const char = text.charAt(end);
    if (CLOSES.has(char)) depth = Math.max(0, depth - 1);
    else if (!ENDS.has(char)) break;
  }
  if (depth > 0) return null;
  const rest = text.slice(end);
  const spaced = rest === "" || /^\s/.test(rest);
  if (WIDE_ENDS.has(text.charAt(i))) {
    // "「好き。」と言った": the sentence goes on after the quote.
    if (quoted && !spaced) return null;
  } else if (!spaced || /^\s*\p{Ll}/u.test(rest) || ABBREVIATION.test(text.slice(0, i + 1))) return null;
  return end + (TRAILING_BRACKET.exec(rest)?.[0].length ?? 0);
}

const isQuotable = ({ text, sentence }: Piece) => sentence && !FIGURE.test(text) && isReplyText(text);

/** The answer's pieces, the ones that may be quoted numbered from 1. An
    answer that's one sentence has nothing to quote. */
export function numbered(text: string): Piece[] {
  const pieces = piecesOf(text);
  if (pieces.length < 2) return pieces;
  let n = 0;
  return pieces.map((piece) => (isQuotable(piece) ? { ...piece, n: ++n } : piece));
}

/** The answer as the model reads it: each numbered sentence after its
    number ("[1] Alex is…"). */
export const withNumbers = (text: string): string =>
  numbered(text)
    .map(({ text, n }) => (n === undefined ? text : `[${n}] ${text}`))
    .join(" ");

const squashed = (text: string) => text.replace(/\s+/g, "");

// Sentences side by side: in Japanese with nothing between them.
const joined = (sentences: string[]) =>
  sentences.reduce((before, next) => `${before}${WIDE_ENDS.has(before.at(-1) ?? "") ? "" : " "}${next}`);

/** The reply quoting the sentences `numbers` names, in the answer's order. */
export function quote(text: string, numbers: unknown): Quoted {
  if (numbers === undefined || numbers === null || (Array.isArray(numbers) && !numbers.length)) return null;
  if (!isArrayOf(numbers, isCount) || numbers.length > MAX_QUOTED) return dropped("unreadable");
  const pieces = numbered(text);
  const chosen: string[] = [];
  for (const n of [...new Set(numbers)].sort((a, b) => a - b)) {
    const piece = pieces.find((item) => item.n === n);
    if (!piece) return dropped("range");
    chosen.push(piece.text);
  }
  const reply = joined(chosen);
  if (squashed(reply) === squashed(text)) return dropped("whole");
  if (reply.length > MAX_REPLY_LENGTH) return dropped("length");
  return { outcome: "sent", reply };
}
