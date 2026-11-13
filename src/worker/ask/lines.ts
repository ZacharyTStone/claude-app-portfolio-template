/* The lines of an answer the picker may choose by number: a sentence of a
   paragraph, an item of a list, a row of a card, a figure. A reply made of
   them is read with nothing around it, so a sentence that opens by pointing
   back at the one before it ("It shipped with no downtime.") comes with
   that sentence, or has no number. */
import { isLabel, isReplyText } from "../../contracts/ask.ts";
import { isArrayOf, isCount } from "../../contracts/guards.ts";
import { JAPANESE_ENDS, piecesOf, type Piece } from "./text/sentences.ts";

/** The most the picker may name for a reply. */
export const MAX_QUOTED_LINES = 2;

export type Line = Piece & {
  /** The number the model names it by (from 1), if it may be quoted. */
  n?: number;
};

// A heading ("The stack:"), or the end of a paragraph before a list ("He
// has two:").
const LEADS_INTO_THE_NEXT = /[:：]$/u;

/** What an answer says itself: its lines but for the labels. */
export const ownLines = (lines: Line[]): Line[] => lines.filter(({ text }) => !isLabel(text));

// With a capital or without ("It", "it"), never all in capitals ("IT was
// his first job.").
const asSentenceOpening = (words: string): string =>
  words
    .split(" ")
    .map((word) => `[${word.charAt(0).toUpperCase()}${word.charAt(0)}]${word.slice(1)}`)
    .join("|");

// A demonstrative that points at nothing said before: the site itself
// ("This site runs on…").
const THE_SITE = "(?! (?:site|page|portfolio)\\b)";
const PREPOSITIONS = asSentenceOpening(
  "about across after alongside among at before besides beyond by despite during for from in into like of on " +
    "onto over since through to under unlike until with within without",
);

// "He", "She" and "They" aren't here: on a site about one person, they're
// that person. Nor are "these days" and "those who…".
const IT_OR_A_DEMONSTRATIVE = new RegExp(
  `^(?:[Ii]ts?|[Tt]his${THE_SITE}|[Tt]hat|[Tt]hese(?! days\\b)|[Tt]hose(?! who\\b))\\b`,
);
// "With that workflow, …", "Since then, …".
const A_PREPOSITION_AND_WHAT_IT_POINTS_AT = new RegExp(
  `^(?:${PREPOSITIONS}) (?:this${THE_SITE}|that|these|those|it|them|then|there)\\b`,
);
const A_WORD_THAT_CARRIES_ON = new RegExp(
  `^(?:${asSentenceOpening("and but also then instead both however meanwhile otherwise")}|[Ss]o(?! far\\b))\\b`,
);
const A_PHRASE_THAT_CARRIES_ON = /^(?:[Ff]or (?:example|instance)|[Ii]n addition|[Aa]s a result)\b/;
const THE_SAME_IN_JAPANESE =
  /^(?:これ(?!まで)|それ(?!ぞれ)|この(?!サイト|ページ|ポートフォリオ)|その|こうして|こうした|そこで|また、|さらに|そして|しかし|ただし|なお、|同時に|同様に|同じく|同社|加えて|あわせて|たとえば|例えば|つまり)/u;

/** How a sentence opens when it can't be read without the one before it. */
const POINTS_BACK = [
  IT_OR_A_DEMONSTRATIVE,
  A_PREPOSITION_AND_WHAT_IT_POINTS_AT,
  A_WORD_THAT_CARRIES_ON,
  A_PHRASE_THAT_CARRIES_ON,
  THE_SAME_IN_JAPANESE,
];

// An emoji, a dash. Not a quote mark or a bracket: someone's words quoted
// are theirs, as they are.
const BEFORE_A_SENTENCE_S_WORDS = /^[^\p{L}\p{N}"'“‘「『(（[]+/u;

export function pointsBack({ text }: Line): boolean {
  const opening = text.replace(BEFORE_A_SENTENCE_S_WORDS, "");
  return POINTS_BACK.some((pattern) => pattern.test(opening));
}

// The sentence a line points back at is the line before it, a picture or a
// link between the two aside. Null when that's no sentence but a heading, a
// list, a card, or the question the answer was written under: none of
// which a reply can bring along.
function sentenceBefore(lines: Line[], at: number): number | null {
  let before = at - 1;
  while (isLabel(lines[before]?.text ?? "")) before--;
  return lines[before]?.sentence ? before : null;
}

/** Where in `lines` the ones are that a reply with the line at `at` needs:
    itself and, while the first of them points back, the sentence before it.
    Null when it points back at no sentence. */
export function neededFor(lines: Line[], at: number): number[] | null {
  const needed = [at];
  let first = at;
  while (opensByPointingBack(lines[first])) {
    const before = sentenceBefore(lines, first);
    if (before === null) return null;
    needed.unshift(before);
    first = before;
  }
  return needed;
}

const opensByPointingBack = (line: Line | undefined): boolean => line !== undefined && pointsBack(line);

function mayBeQuoted(lines: Line[], at: number): boolean {
  const line = lines[at];
  if (!line || isLabel(line.text) || LEADS_INTO_THE_NEXT.test(line.text)) return false;
  const needed = neededFor(lines, at);
  return needed !== null && isReplyText(joinLines(needed.flatMap((place) => lines[place] ?? [])));
}

/** The answer's lines, the ones that may be quoted numbered from 1. An
    answer that says one thing has nothing to choose from. */
export function numbered(text: string): Line[] {
  const lines = piecesOf(text);
  if (ownLines(lines).length < 2) return lines;
  let n = 0;
  return lines.map((line, at) => (mayBeQuoted(lines, at) ? { ...line, n: ++n } : line));
}

/** The answer as the picker reads it: each numbered line after its number
    ("[1] Alex is…"). */
export const withNumbers = (text: string): string =>
  numbered(text)
    .map(({ text, n }) => (n === undefined ? text : `[${n}] ${text}`))
    .join(" ");

/** What goes between two lines that aren't sentences, side by side: a
    list's item or a card's row would run into the next. */
const BETWEEN_LINES = " · ";

function gapAfter({ text, sentence }: Line): string {
  if (!sentence) return BETWEEN_LINES;
  return JAPANESE_ENDS.has(text.at(-1) ?? "") ? "" : " ";
}

/** As a reply quotes them, and as the writer reads them. */
export const joinLines = (lines: Line[]): string =>
  lines.map((line, at) => (at < lines.length - 1 ? `${line.text}${gapAfter(line)}` : line.text)).join("");

export const namesNoLines = (numbers: unknown): boolean =>
  numbers === undefined || numbers === null || (Array.isArray(numbers) && !numbers.length);

/** Why the lines some numbers name can't be told: the numbers aren't a list
    of at most MAX_QUOTED_LINES, or one names no numbered line. */
export type Unnamed = "unreadable" | "range";

/** The lines `numbers` names, each with the sentences it can't be read
    without, in the answer's order; or why they can't be told. */
export function linesNamed(lines: Line[], numbers: unknown): Line[] | Unnamed {
  if (!isArrayOf(numbers, isCount) || numbers.length > MAX_QUOTED_LINES) return "unreadable";
  const places = new Set<number>();
  for (const n of numbers) {
    const at = lines.findIndex((line) => line.n === n);
    if (at < 0) return "range";
    // A numbered line has what it needs: that's what gave it its number.
    for (const place of neededFor(lines, at) ?? [at]) places.add(place);
  }
  return [...places].sort((a, b) => a - b).flatMap((place) => lines[place] ?? []);
}

/** The lines a reply is written from: the ones `numbers` names, each with
    what it needs, however long together; or all an answer says when it says
    one thing, which has no numbers to name. Never a label. Null when there's
    nothing to go by. */
export function linesToWriteFrom(text: string, numbers: unknown): Line[] | null {
  const lines = numbered(text);
  const hasNumberedLines = lines.some(({ n }) => n !== undefined);
  if (!hasNumberedLines) {
    const everythingSaid = ownLines(lines);
    return everythingSaid.length ? everythingSaid : null;
  }
  if (namesNoLines(numbers)) return null;
  const named = linesNamed(lines, numbers);
  return typeof named === "string" ? null : named;
}
