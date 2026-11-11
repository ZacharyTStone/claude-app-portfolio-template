/* The lines of a picked answer that say what was asked, chosen by number:
   a sentence of a paragraph, an item of a list, a row of a card, a figure.
   A reply is written from them (write.ts) and checked against them
   (grounded.ts); when none can be written, they're quoted as they are, the
   owner's own words.

   A reply is read with nothing around it, so it has to make sense that way.
   A sentence that opens by pointing back at the one before it ("It shipped
   with no downtime.") doesn't: it's quoted with that sentence, or not at
   all (`neededFor`). */
import { isLabel, isReplyText, MAX_REPLY_LENGTH } from "../../shared/ask.ts";
import { isArrayOf, isCount } from "../../shared/guards.ts";

/** The most lines the model may name for a reply. One that can't be read
    without the sentence before it brings that along (`neededFor`). */
export const MAX_QUOTED = 2;

/** Why a quote asked for wasn't sent: the numbers aren't a list of at most
    MAX_QUOTED, one names no numbered line, the lines (and the ones they
    can't be read without) are the whole answer, which the page shows as it
    is, with no reply, or together they're too long; or one is a card's row,
    a list's item or a figure where only a sentence will do (`rows`). */
export type QuoteCheck = "unreadable" | "range" | "whole" | "length" | "rows";

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

// Words as a sentence starts with them: with a capital or without ("It",
// "it"), never all in capitals ("IT was his first job.").
const starting = (words: string) =>
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
const AFTER = starting(
  "about across after alongside among at before besides beyond by despite during for from in into like of on " +
    "onto over since through to under unlike until with within without",
);
const POINTS_BACK = [
  new RegExp(`^(?:[Ii]ts?|[Tt]his${THE_SITE}|[Tt]hat|[Tt]hese(?! days\\b)|[Tt]hose(?! who\\b))\\b`),
  new RegExp(`^(?:${AFTER}) (?:this${THE_SITE}|that|these|those|it|them|then|there)\\b`),
  new RegExp(`^(?:${starting("and but also then instead both however meanwhile otherwise")}|[Ss]o(?! far\\b))\\b`),
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
  return needed !== null && isReplyText(joined(needed.flatMap((i) => pieces[i] ?? [])));
}

/** The answer's pieces, the ones that may be quoted numbered from 1. An
    answer that says one thing has nothing to quote. */
export function numbered(text: string): Piece[] {
  const pieces = piecesOf(text);
  if (said(pieces).length < 2) return pieces;
  let n = 0;
  return pieces.map((piece, at) => (isQuotable(pieces, at) ? { ...piece, n: ++n } : piece));
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

function joined(pieces: Piece[]): string {
  return pieces.reduce((before, piece, i) => `${before}${piece.text}${i < pieces.length - 1 ? gap(piece) : ""}`, "");
}

const noneGiven = (numbers: unknown) =>
  numbers === undefined || numbers === null || (Array.isArray(numbers) && !numbers.length);

// The pieces `numbers` names, each with the sentences it can't be read
// without, in the answer's order; or why they can't be told.
function chosenBy(pieces: Piece[], numbers: unknown): Piece[] | QuoteCheck {
  if (!isArrayOf(numbers, isCount) || numbers.length > MAX_QUOTED) return "unreadable";
  const places = new Set<number>();
  for (const n of numbers) {
    const at = pieces.findIndex((item) => item.n === n);
    if (at < 0) return "range";
    // A numbered piece has what it needs: that's what gave it its number.
    for (const place of neededFor(pieces, at) ?? [at]) places.add(place);
  }
  return [...places].sort((a, b) => a - b).flatMap((place) => pieces[place] ?? []);
}

/** The lines a reply is written from (write.ts): the ones `numbers` names,
    each with what it needs, however long together; or all an answer says
    when it says one thing, which has no numbers to name. Null when there's
    nothing to go by. */
export function cited(text: string, numbers: unknown): string | null {
  const pieces = numbered(text);
  if (!pieces.some(({ n }) => n !== undefined)) return joined(said(pieces)) || null;
  if (noneGiven(numbers)) return null;
  const chosen = chosenBy(pieces, numbers);
  return typeof chosen === "string" ? null : joined(chosen);
}

/** The reply quoting the pieces `numbers` names, each with the sentences it
    can't be read without, in the answer's order. With `sentencesOnly`, only
    sentences are quoted: a card's row ("frontend: React, Svelte") is what a
    reply is written from, and no reply itself, so where one was to be
    written and wasn't, the page shows the answer instead. */
export function quote(text: string, numbers: unknown, { sentencesOnly = false } = {}): Quoted {
  if (noneGiven(numbers)) return null;
  const pieces = numbered(text);
  const chosen = chosenBy(pieces, numbers);
  if (typeof chosen === "string") return dropped(chosen);
  if (sentencesOnly && chosen.some(({ sentence }) => !sentence)) return dropped("rows");
  // All the answer says: the page shows the answer itself, as it's written.
  const texts = (list: Piece[]) => squashed(list.map((piece) => piece.text).join(""));
  if (texts(chosen) === texts(said(pieces))) return dropped("whole");
  const reply = joined(chosen);
  if (reply.length > MAX_REPLY_LENGTH) return dropped("length");
  return { outcome: "sent", reply };
}
