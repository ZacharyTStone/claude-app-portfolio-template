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

type PlacedPiece = Piece & {
  /** Where its words start in the text it was cut from. */
  start: number;
};

const SENTENCE_ENDS = new Set([".", "!", "?", "。", "！", "？"]);
/** Japanese ends a sentence with no space after it; the others need one. */
export const JAPANESE_ENDS = new Set(["。", "！", "？"]);
// A full stop between an opening mark and its closing one doesn't end the
// sentence they're in.
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
  placedPiecesOf(text).map(({ text, sentence }) => ({ text, sentence }));

/** Where each of the text's pieces starts. */
export const pieceStartsIn = (text: string): number[] => placedPiecesOf(text).map(({ start }) => start);

function placedPiecesOf(text: string): PlacedPiece[] {
  const pieces: PlacedPiece[] = [];
  let lineStart = 0;
  for (const line of text.split("\n")) {
    for (const piece of piecesOfLine(line)) pieces.push({ ...piece, start: lineStart + piece.start });
    lineStart += line.length + "\n".length;
  }
  return pieces;
}

function piecesOfLine(line: string): PlacedPiece[] {
  if (isLabel(line)) return [{ text: line, sentence: false, start: 0 }];
  const pieces: PlacedPiece[] = [];
  const addPiece = (start: number, end: number, sentence: boolean) => {
    const untrimmed = line.slice(start, end);
    const leadingSpace = untrimmed.length - untrimmed.trimStart().length;
    if (untrimmed.trim()) pieces.push({ text: untrimmed.trim(), sentence, start: start + leadingSpace });
  };
  let sentenceStart = 0;
  let openMarks = 0;
  for (let at = 0; at < line.length; at++) {
    const char = line.charAt(at);
    if (OPENING_MARKS.has(char)) openMarks++;
    else if (CLOSING_MARKS.has(char)) openMarks = Math.max(0, openMarks - 1);
    else if (SENTENCE_ENDS.has(char)) {
      const sentenceEnd = sentenceEndAfter(line, at, openMarks);
      if (sentenceEnd === null) continue;
      addPiece(sentenceStart, sentenceEnd, true);
      sentenceStart = sentenceEnd;
      openMarks = 0;
      at = sentenceEnd - 1;
    }
  }
  addPiece(sentenceStart, line.length, false);
  return pieces;
}

/** Where the sentence ends whose mark is at `markAt`, with `openMarks`
    quotes and brackets open there: past the mark, what closes with it, and
    a bracket that trails it. Null if the mark doesn't end a sentence. */
function sentenceEndAfter(line: string, markAt: number, openMarks: number): number | null {
  const { end, stillOpen } = pastWhatClosesWith(line, markAt, openMarks);
  if (stillOpen > 0) return null;
  const rest = line.slice(end);
  const endsSentence = JAPANESE_ENDS.has(line.charAt(markAt))
    ? japaneseMarkEndsSentence(rest, openMarks > 0)
    : otherMarkEndsSentence(line.slice(0, markAt + 1), rest);
  return endsSentence ? end + (TRAILING_BRACKET.exec(rest)?.[0].length ?? 0) : null;
}

// Past a mark and the marks, quotes and brackets that close with it:
// "…done?!”)". `stillOpen` is how many quotes and brackets are open after.
function pastWhatClosesWith(line: string, markAt: number, openMarks: number): { end: number; stillOpen: number } {
  let stillOpen = openMarks;
  let end = markAt + 1;
  for (; end < line.length; end++) {
    const char = line.charAt(end);
    if (CLOSING_MARKS.has(char)) stillOpen = Math.max(0, stillOpen - 1);
    else if (!SENTENCE_ENDS.has(char)) break;
  }
  return { end, stillOpen };
}

const isBeforeSpaceOrEnd = (rest: string): boolean => rest === "" || /^\s/.test(rest);

// "「好き。」と言った": after a quote closes, the sentence it's in may go on.
const japaneseMarkEndsSentence = (rest: string, closedAQuote: boolean): boolean =>
  !closedAQuote || isBeforeSpaceOrEnd(rest);

const otherMarkEndsSentence = (upToMark: string, rest: string): boolean =>
  isBeforeSpaceOrEnd(rest) && !/^\s*\p{Ll}/u.test(rest) && !ABBREVIATION.test(upToMark);
