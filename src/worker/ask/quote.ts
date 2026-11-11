/* The reply /ask sends with a pick: one or two of the picked answer's own
   lines, chosen by number: a sentence of a paragraph, an item of a list, a
   row of a card, a figure. The model only gives the numbers, so the reply
   is always the owner's words, never the model's. */
import { isLabel, isReplyText, MAX_REPLY_LENGTH } from "../../shared/ask.ts";
import { isArrayOf, isCount } from "../../shared/guards.ts";

/** The most lines a reply quotes. */
export const MAX_QUOTED = 2;

/** Why a quote asked for wasn't sent: the numbers aren't a list of at most
    MAX_QUOTED, one names no numbered line, the lines are the whole answer
    (which the page shows anyway), or together they're too long. */
export type QuoteCheck = "unreadable" | "range" | "whole" | "length";

/** The reply, or why it was dropped; null when the model asked for none. */
export type Quoted =
  | { outcome: "sent"; reply: string; check?: undefined }
  | { outcome: "dropped"; check: QuoteCheck; reply?: undefined }
  | null;

const dropped = (check: QuoteCheck): Quoted => ({ outcome: "dropped", check });

/** A piece of an answer's text: a sentence, or a line that isn't one (a
    list's item, a card's row, a figure, a label, what's left of a paragraph
    after its last sentence), and its number if it may be quoted. */
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
// A line that only leads into what's under it: a heading ("The stack:"),
// or the end of a paragraph before a list ("He has two:").
const LEADS_IN = /[:：]$/u;

/** The text's pieces, a line at a time: ask.json gives each block of an
    answer (a paragraph, a list's item, a card's row, a figure) a line of
    its own, so one's words never run into the next's. A label is one piece,
    whatever is in it. */
export const piecesOf = (text: string): Piece[] =>
  text.split("\n").flatMap((line) => (isLabel(line) ? [{ text: line, sentence: false }] : piecesOfLine(line)));

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

// What an answer says itself: its pieces but for the labels.
const said = (pieces: Piece[]) => pieces.filter(({ text }) => !isLabel(text));

// Anything the answer says may be quoted, but a line that only leads into
// the next, and one too long (or otherwise unfit) for a reply.
const isQuotable = ({ text }: Piece) => !isLabel(text) && !LEADS_IN.test(text) && isReplyText(text);

/** The answer's pieces, the ones that may be quoted numbered from 1. An
    answer that says one thing has nothing to quote. */
export function numbered(text: string): Piece[] {
  const pieces = piecesOf(text);
  if (said(pieces).length < 2) return pieces;
  let n = 0;
  return pieces.map((piece) => (isQuotable(piece) ? { ...piece, n: ++n } : piece));
}

/** The answer as the model reads it: each numbered piece after its number
    ("[1] Alex is…"). */
export const withNumbers = (text: string): string =>
  numbered(text)
    .map(({ text, n }) => (n === undefined ? text : `[${n}] ${text}`))
    .join(" ");

const squashed = (text: string) => text.replace(/\s+/g, "");

/** What goes between two lines that aren't sentences, quoted side by side. */
export const BETWEEN_LINES = " · ";

// What goes after a piece when another follows: nothing after a Japanese
// sentence, a space after any other, and a dot after a line that isn't one
// (a list's item, a card's row), which would run into the next.
const gap = ({ text, sentence }: Piece) => (!sentence ? BETWEEN_LINES : WIDE_ENDS.has(text.at(-1) ?? "") ? "" : " ");

const joined = (pieces: Piece[]) =>
  pieces.reduce((before, piece, i) => `${before}${piece.text}${i < pieces.length - 1 ? gap(piece) : ""}`, "");

/** The reply quoting the pieces `numbers` names, in the answer's order. */
export function quote(text: string, numbers: unknown): Quoted {
  if (numbers === undefined || numbers === null || (Array.isArray(numbers) && !numbers.length)) return null;
  if (!isArrayOf(numbers, isCount) || numbers.length > MAX_QUOTED) return dropped("unreadable");
  const pieces = numbered(text);
  const chosen: Piece[] = [];
  for (const n of [...new Set(numbers)].sort((a, b) => a - b)) {
    const piece = pieces.find((item) => item.n === n);
    if (!piece) return dropped("range");
    chosen.push(piece);
  }
  // All the answer says is what the page shows under the reply anyway.
  const texts = (list: Piece[]) => squashed(list.map((piece) => piece.text).join(""));
  if (texts(chosen) === texts(said(pieces))) return dropped("whole");
  const reply = joined(chosen);
  if (reply.length > MAX_REPLY_LENGTH) return dropped("length");
  return { outcome: "sent", reply };
}
