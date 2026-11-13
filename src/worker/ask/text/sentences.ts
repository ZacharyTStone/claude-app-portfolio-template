/* An answer's text, cut into pieces: its sentences, and what isn't one. */
import { isLabel } from "../../../contracts/ask.ts";

/** A piece of an answer's text. */
export type Piece = {
  /** Its words, trimmed. */
  text: string;
  /** Whether it's a sentence. One that isn't is a list's item, a card's
      row, a figure, a label, or what's left of a paragraph after its last
      sentence. */
  sentence: boolean;
};

// The marks a sentence ends with.
const SENTENCE_ENDS = new Set([".", "!", "?", "。", "！", "？"]);
// Japanese ends a sentence with no space after it; the others need one.
export const JAPANESE_ENDS = new Set(["。", "！", "？"]);
// What opens a quote or a bracket, and what closes one. A full stop between
// the two doesn't end the sentence they're in.
const OPENING_MARKS = new Set(["(", "（", "“", "「", "『"]);
const CLOSING_MARKS = new Set([")", "）", "”", "」", "』"]);
// A full stop that ends a word, not a sentence: "e.g. React".
const ABBREVIATION = /(?:^|[\s(（])(?:e\.g|i\.e|vs|cf|approx|Mr|Mrs|Ms|Dr|St|Jr|Sr)\.$/i;
// A bracket just after a sentence belongs to it: "…the team.” (A coworker)".
const TRAILING_BRACKET = /^\s*[(（](?:[^()（）]|[(（][^()（）]*[)）])*[)）]/;

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
function piecesOfLine(line: string): Piece[] {
  const pieces: Piece[] = [];
  const addPiece = (text: string, sentence: boolean) => {
    if (text.trim()) pieces.push({ text: text.trim(), sentence });
  };
  let sentenceStart = 0;
  // How many quotes and brackets are open where `at` is.
  let nesting = 0;
  for (let at = 0; at < line.length; at++) {
    const char = line.charAt(at);
    if (OPENING_MARKS.has(char)) nesting++;
    else if (CLOSING_MARKS.has(char)) nesting = Math.max(0, nesting - 1);
    else if (SENTENCE_ENDS.has(char)) {
      const sentenceEnd = sentenceEndAfter(line, at, nesting);
      if (sentenceEnd === null) continue;
      addPiece(line.slice(sentenceStart, sentenceEnd), true);
      sentenceStart = sentenceEnd;
      nesting = 0;
      at = sentenceEnd - 1;
    }
  }
  // What's left after the last sentence isn't one.
  addPiece(line.slice(sentenceStart), false);
  return pieces;
}

// Where the sentence ends whose mark is at `markAt`, `nesting` quotes and
// brackets deep: past the mark, any marks, quotes and brackets that close
// with it, and a bracket that trails it. Null if the mark doesn't end a
// sentence.
function sentenceEndAfter(line: string, markAt: number, nesting: number): number | null {
  const isInsideQuote = nesting > 0;
  let stillOpen = nesting;
  let end = markAt + 1;
  for (; end < line.length; end++) {
    const char = line.charAt(end);
    if (CLOSING_MARKS.has(char)) stillOpen = Math.max(0, stillOpen - 1);
    else if (!SENTENCE_ENDS.has(char)) break;
  }
  // A quote or a bracket is still open: what it's in goes on.
  if (stillOpen > 0) return null;
  const rest = line.slice(end);
  const isBeforeSpaceOrEnd = rest === "" || /^\s/.test(rest);
  if (JAPANESE_ENDS.has(line.charAt(markAt))) {
    // "「好き。」と言った": the sentence goes on after the quote.
    if (isInsideQuote && !isBeforeSpaceOrEnd) return null;
  } else {
    const startsLowerCase = /^\s*\p{Ll}/u.test(rest);
    if (!isBeforeSpaceOrEnd || startsLowerCase || ABBREVIATION.test(line.slice(0, markAt + 1))) return null;
  }
  return end + (TRAILING_BRACKET.exec(rest)?.[0].length ?? 0);
}
