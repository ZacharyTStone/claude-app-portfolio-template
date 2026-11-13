/* The lines of a picked answer, chosen by number: a sentence of a
   paragraph, an item of a list, a row of a card, a figure.

   A reply is read with nothing around it, so it has to make sense that way.
   A sentence that opens by pointing back at the one before it ("It shipped
   with no downtime.") doesn't: it's quoted with that sentence, or not at
   all (`neededFor`). */
import { isLabel, isReplyText } from "../../contracts/ask.ts";
import { isArrayOf, isCount } from "../../contracts/guards.ts";
import { MAX_QUOTED_LINES } from "../constants.ts";
import { JAPANESE_ENDS, piecesOf, type Piece as PieceOfText } from "./text/sentences.ts";

/** A piece of an answer's text, with the number the model names it by
    (from 1) if it may be quoted. */
export type Piece = PieceOfText & { n?: number };

// A line that only leads into what's under it: a heading ("The stack:"),
// or the end of a paragraph before a list ("He has two:").
const LEADS_IN = /[:：]$/u;

// What an answer says itself: its pieces but for the labels.
export const ownLines = (pieces: Piece[]) => pieces.filter(({ text }) => !isLabel(text));

// Words as a sentence starts with them: with a capital or without ("It",
// "it"), never all in capitals ("IT was his first job.").
const asSentenceOpening = (words: string) =>
  words
    .split(" ")
    .map((word) => `[${word.charAt(0).toUpperCase()}${word.charAt(0)}]${word.slice(1)}`)
    .join("|");

// How a sentence opens when it points back at the one before it, and so
// can't be read without it. In English: "it" or a demonstrative first ("It
// shipped…", "Those include…", "That workflow…") or after a preposition
// ("With that workflow, …", "Since then, …"), or a word that carries on
// ("And", "Then", "Also", "For example"). In Japanese: これ, それ, この, その
// and the words that carry on (また、さらに、たとえば). "He", "She" and "They"
// aren't here: on a site about one person, they're that person. Nor is a
// demonstrative that points at nothing said before: the site itself ("This
// site runs on…"), "these days", "those who…".
const THE_SITE = "(?! (?:site|page|portfolio)\\b)";
const PREPOSITIONS = asSentenceOpening(
  "about across after alongside among at before besides beyond by despite during for from in into like of on " +
    "onto over since through to under unlike until with within without",
);
const POINTS_BACK = [
  new RegExp(`^(?:[Ii]ts?|[Tt]his${THE_SITE}|[Tt]hat|[Tt]hese(?! days\\b)|[Tt]hose(?! who\\b))\\b`),
  new RegExp(`^(?:${PREPOSITIONS}) (?:this${THE_SITE}|that|these|those|it|them|then|there)\\b`),
  new RegExp(
    `^(?:${asSentenceOpening("and but also then instead both however meanwhile otherwise")}|[Ss]o(?! far\\b))\\b`,
  ),
  /^(?:[Ff]or (?:example|instance)|[Ii]n addition|[Aa]s a result)\b/,
  /^(?:これ(?!まで)|それ(?!ぞれ)|この(?!サイト|ページ|ポートフォリオ)|その|こうして|こうした|そこで|また、|さらに|そして|しかし|ただし|なお、|同時に|同様に|同じく|同社|加えて|あわせて|たとえば|例えば|つまり)/u,
];
// What may come before a sentence's first word: an emoji, a dash. Not a
// quote mark or a bracket: someone's words quoted are theirs, as they are.
const BEFORE_WORDS = /^[^\p{L}\p{N}"'“‘「『(（[]+/u;

/** Whether a piece opens by pointing back at the sentence before it. */
export function pointsBack({ text }: Piece): boolean {
  const opening = text.replace(BEFORE_WORDS, "");
  return POINTS_BACK.some((pattern) => pattern.test(opening));
}

/** Where in `pieces` the lines are that a reply quoting the one at `at`
    needs: itself and, while one of them points back, the sentence before it
    (a picture or a link between the two aside). Null when it points back at
    no sentence: at a heading, a list, a card, or the question its answer was
    written under, none of which a reply can bring along. */
export function neededFor(pieces: Piece[], at: number): number[] | null {
  const needed = [at];
  for (let i = at, piece = pieces[i]; piece && pointsBack(piece); piece = pieces[i]) {
    let before = i - 1;
    while (isLabel(pieces[before]?.text ?? "")) before--;
    if (!pieces[before]?.sentence) return null;
    needed.unshift(before);
    i = before;
  }
  return needed;
}

// Anything the answer says may be quoted, but a line that only leads into
// the next, one that can't be read without lines a reply can't bring, and
// one too long (or otherwise unfit) for a reply, with what it needs.
function isQuotable(pieces: Piece[], at: number): boolean {
  const piece = pieces[at];
  if (!piece || isLabel(piece.text) || LEADS_IN.test(piece.text)) return false;
  const needed = neededFor(pieces, at);
  return needed !== null && isReplyText(joinPieces(needed.flatMap((i) => pieces[i] ?? [])));
}

/** The answer's pieces, the ones that may be quoted numbered from 1. An
    answer that says one thing has nothing to quote. */
export function numbered(text: string): Piece[] {
  const pieces = piecesOf(text);
  if (ownLines(pieces).length < 2) return pieces;
  let n = 0;
  return pieces.map((piece, at) => (isQuotable(pieces, at) ? { ...piece, n: ++n } : piece));
}

/** The answer as the model reads it: each numbered piece after its number
    ("[1] Alex is…"). */
export const withNumbers = (text: string): string =>
  numbered(text)
    .map(({ text, n }) => (n === undefined ? text : `[${n}] ${text}`))
    .join(" ");

/** What goes between two lines that aren't sentences, quoted side by side. */
export const BETWEEN_LINES = " · ";

// What goes after a piece when another follows: nothing after a Japanese
// sentence, a space after any other, and a dot after a line that isn't one
// (a list's item, a card's row), which would run into the next.
const gap = ({ text, sentence }: Piece) =>
  !sentence ? BETWEEN_LINES : JAPANESE_ENDS.has(text.at(-1) ?? "") ? "" : " ";

/** The pieces as one text, as a reply quotes them and as the model that
    writes a reply reads them: each followed by what keeps it apart from
    the next (`gap`). */
export function joinPieces(pieces: Piece[]): string {
  return pieces.reduce((before, piece, i) => `${before}${piece.text}${i < pieces.length - 1 ? gap(piece) : ""}`, "");
}

/** Whether the model named no lines. */
export const gaveNoNumbers = (numbers: unknown) =>
  numbers === undefined || numbers === null || (Array.isArray(numbers) && !numbers.length);

/** Why the lines `numbers` names can't be told: they aren't a list of at
    most MAX_QUOTED_LINES, or one names no numbered line. */
export type Unnamed = "unreadable" | "range";

// The pieces `numbers` names, each with the sentences it can't be read
// without, in the answer's order; or why they can't be told.
export function piecesNumbered(pieces: Piece[], numbers: unknown): Piece[] | Unnamed {
  if (!isArrayOf(numbers, isCount) || numbers.length > MAX_QUOTED_LINES) return "unreadable";
  const places = new Set<number>();
  for (const n of numbers) {
    const at = pieces.findIndex((item) => item.n === n);
    if (at < 0) return "range";
    // A numbered piece has what it needs: that's what gave it its number.
    for (const place of neededFor(pieces, at) ?? [at]) places.add(place);
  }
  return [...places].sort((a, b) => a - b).flatMap((place) => pieces[place] ?? []);
}

/** The pieces a reply is written from (write.ts): the ones `numbers` names,
    each with what it needs, however long together; or all an answer says
    when it says one thing, which has no numbers to name. Never a label.
    Null when there's nothing to go by. */
export function citedPieces(text: string, numbers: unknown): Piece[] | null {
  const pieces = numbered(text);
  const hasNumberedPieces = pieces.some(({ n }) => n !== undefined);
  if (!hasNumberedPieces) {
    const everythingSaid = ownLines(pieces);
    return everythingSaid.length ? everythingSaid : null;
  }
  if (gaveNoNumbers(numbers)) return null;
  const chosen = piecesNumbered(pieces, numbers);
  return typeof chosen === "string" ? null : chosen;
}
