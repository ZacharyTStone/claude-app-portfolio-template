/* Whether a reply the model wrote says only what the site says. A reply is
   written from the lines the picker chose (write.ts), and every word in it
   is checked here before a visitor sees it:

   - A name, a number, a description, a verb: each has to be in those lines,
     in their tab's name or in the site's own question over them. Only plain
     grammar ("he", "is", "the", "with") and a few verbs that claim little
     ("know", "use", "work", "have") may be added.
   - What the lines deny, the reply can't leave undenied: one that takes a
     word from a sentence with a "not" in it has to have a "not" too.
   - "Yes" stands only when the lines have everything the visitor's question
     names, and deny nothing. Otherwise it's taken off, and the rest stands
     on its own.

   What the visitor typed is never a source: a question can't put its own
   words in the reply. A reply that fails is not shown (the lines are quoted
   instead), so the check errs towards failing. It reads English and
   Japanese; a site in another language is quoted, as before. */

import { piecesOf } from "./quote.ts";

/** The languages a reply can be written, and checked, in. */
export const WRITTEN_IN: readonly string[] = ["en", "ja"];

/** What a reply may be made of: the lines it's written from, their tab's
    name, the site's question they answer, and the owner's names. */
export type Sources = { lines: string; title: string; q: string; owner: string };

/** Why a reply wasn't shown: it has words its sources don't (`unsaid`), it
    says nothing but grammar, or it leaves out a "not" its lines have. */
export type Failing = "words" | "nothing" | "denial";

/** The reply as it may be shown, or why it may not be, with the words its
    sources don't have: for the log, and for asking the model again. */
export type Checked =
  { reply: string; failing?: undefined } | { failing: Failing; unsaid: string[]; reply?: undefined };

// ---- Words --------------------------------------------------------------------------

// Text as it's compared: one form of each character (ｆｕｌｌ width to plain),
// lower case, one kind of apostrophe.
const plain = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'");

// A text's pieces, by script: a word in Latin letters or digits with what's
// written inside one ("node.js", "2,350+", "ci/cd", "doesn't", "c#"), or a
// run of kanji, katakana or hiragana.
const PIECES =
  /(?<word>[\p{Script=Latin}\p{N}]+(?:[.,'+#/&-]+[\p{Script=Latin}\p{N}]+)*[+#]*)|(?<kanji>[\p{Script=Han}々]+)|(?<katakana>[\p{Script=Katakana}ー]+)|(?<hiragana>[\p{Script=Hiragana}]+)/gu;

type Piece = { kind: "word" | "kanji" | "katakana" | "hiragana"; text: string };

function scriptsOf(text: string): Piece[] {
  return [...plain(text).matchAll(PIECES)].flatMap(({ groups = {} }) =>
    (["word", "kanji", "katakana", "hiragana"] as const).flatMap((kind) => {
      const found = groups[kind];
      return found ? [{ kind, text: found }] : [];
    }),
  );
}

// "alex's" as "alex", "he's" as "he", "they're" as "they". Not "doesn't":
// what a word denies is part of it.
const unowned = (word: string) => word.replace(/'(?:s|re|ve|ll|d)$/, "");

// A name without the dots and dashes some write in it: "frontend" for
// "front-end", "nodejs" for "Node.js".
const undotted = (word: string) => word.replace(/[.-]/g, "");

// A number as it's compared: "2,350+" and "2350" are the same number.
const asNumber = (word: string) => word.replace(/,/g, "").replace(/\+$/, "");
const hasDigit = (word: string) => /\p{N}/u.test(word);

// A word without its ending, so "knows", "knowing" and "known" aren't three
// words, nor "customers" and "customer". Rough, and only ever compared with
// another word's: a wrong cut on both sides is still a match.
function stem(word: string): string {
  let cut = word;
  if (word.length >= 4 && !word.endsWith("ss")) {
    for (const [ending, instead] of [
      ["ies", "y"],
      ["ied", "y"],
      ["ing", ""],
      ["ed", ""],
      ["es", ""],
      // "known" as "know".
      ["wn", "w"],
      ["s", ""],
    ] as const) {
      if (word.endsWith(ending) && word.length - ending.length >= 2) {
        cut = word.slice(0, -ending.length) + instead;
        break;
      }
    }
  }
  // "shipp" (from "shipped") as "ship", "use" as "us" (from "using").
  cut = cut.replace(/([^aeiouls])\1$/, "$1");
  return cut.length >= 3 ? cut.replace(/e$/, "") : cut;
}

// Grammar, and the few verbs that claim little: what a reply may add to its
// sources' words. Nothing here counts, compares, judges or denies ("all",
// "only", "best", "not" have to come from the lines), and nothing guesses
// ("may", "probably").
const GLUE = new Set(
  (
    "a an the this that these those he him his she her hers they them their it its you your who whom whose which " +
    "what where when how there here is are was were be been being am has have had having does do did doing done " +
    "can could will would and or so as at by for from in into of on onto to with within about across after " +
    "before between during over under through until since than then also too both such per via while " +
    "know use work include including experience part able"
  )
    .split(" ")
    .map(stem),
);

// A word that says yes, and one that denies. A denial is never glue: it has
// to be in the lines.
const YES = new Set(["yes", "yeah", "yep", "yup"]);
const DENIES =
  /^(?:no|not|never|none|nor|neither|nothing|nobody|nowhere|without|cannot|unable|hardly|barely|rarely|seldom)$|n't$/;
// The same in Japanese, which writes them in hiragana, inside a longer run.
const JA_YES = /^はい/;
const JA_DENIES = /ない|ません|なかった|なく(?!な)|せず|おらず|ずに|いいえ/g;
// Hiragana that isn't grammar: it counts, compares, judges or guesses, so it
// has to be in the lines too.
const JA_CLAIMS =
  /すべて|ぜんぶ|だけ|しか(?!し)|いつも|とても|かなり|もっとも|いちばん|すご|すばらし|たぶん|おそらく|かもしれ|でしょう|だろう|らしい|みたい/g;
// Kanji a reply may add: the same few verbs, and "he".
const JA_GLUE = ["使用", "使", "知", "働", "持", "経験", "可能", "彼"];

// ---- A text's words, to check others against ---------------------------------------

type Known = { words: Set<string>; stems: Set<string>; text: string };

// The words of the texts: each whole, and the parts of one written with a
// slash, a dash or a dot ("Svelte / SvelteKit", "full-stack", "Node.js").
function known(...texts: string[]): Known {
  const words = new Set<string>();
  const stems = new Set<string>();
  const add = (word: string) => {
    words.add(word);
    words.add(undotted(word));
    if (hasDigit(word)) words.add(asNumber(word));
    else stems.add(stem(word));
  };
  for (const piece of texts.flatMap(scriptsOf)) {
    if (piece.kind !== "word") continue;
    const word = unowned(piece.text);
    add(word);
    // A number's dots and commas are part of it: "1.04" has no "04".
    if (!hasDigit(word)) for (const part of word.split(/[.,'+#/&-]+/)) if (part) add(part);
  }
  return { words, stems, text: plain(texts.join("\n")) };
}

// Whether a Latin word is one the texts have: itself, the same number, the
// same word with another ending, or parts that each are.
function hasWord({ words, stems }: Known, word: string): boolean {
  if (words.has(word) || words.has(undotted(word))) return true;
  if (hasDigit(word)) return words.has(asNumber(word));
  if (stems.has(stem(word))) return true;
  const parts = word.split(/[/&-]+/).filter(Boolean);
  return parts.length > 1 && parts.every((part) => words.has(part) || stems.has(stem(part)));
}

// Whether a run of kanji is made of the texts' own: of pieces two or more
// long that the texts have, or the few a reply may add. A kanji on its own
// (働く) has to be in the texts as it is.
function hasKanji({ text }: Known, run: string): boolean {
  if (run.length === 1) return text.includes(run) || JA_GLUE.includes(run);
  // reached[i]: the run's first i kanji are accounted for.
  const reached = [true, ...Array<boolean>(run.length).fill(false)];
  for (let from = 0; from < run.length; from++) {
    if (!reached[from]) continue;
    for (let to = from + 1; to <= run.length; to++) {
      const piece = run.slice(from, to);
      if (JA_GLUE.includes(piece) || (piece.length >= 2 && text.includes(piece))) reached[to] = true;
    }
  }
  return reached[run.length] === true;
}

// ---- The check ------------------------------------------------------------------------

// The words of `text` that `from` doesn't have, glue aside; and how many it
// does (`said`), so a reply of nothing but grammar can be told.
function unsaidIn(text: string, from: Known): { unsaid: string[]; said: number } {
  const unsaid: string[] = [];
  let said = 0;
  for (const piece of scriptsOf(text)) {
    if (piece.kind === "word") {
      const word = unowned(piece.text);
      if (!DENIES.test(word) && GLUE.has(stem(word))) continue;
      if (hasWord(from, word)) said++;
      else unsaid.push(word);
    } else if (piece.kind === "kanji") {
      if (hasKanji(from, piece.text)) said++;
      else unsaid.push(piece.text);
    } else if (piece.kind === "katakana") {
      if (from.text.includes(piece.text)) said++;
      else unsaid.push(piece.text);
    } else {
      // Hiragana is grammar, but for what denies or claims.
      for (const [found] of [...piece.text.matchAll(JA_DENIES), ...piece.text.matchAll(JA_CLAIMS)]) {
        if (!from.text.includes(found)) unsaid.push(found);
      }
    }
  }
  return { unsaid, said };
}

// Whether a text denies something: has a "not", or a ない.
const denies = (text: string) =>
  scriptsOf(text).some(({ kind, text: piece }) =>
    kind === "word" ? DENIES.test(piece) : kind === "hiragana" && [...piece.matchAll(JA_DENIES)].length > 0,
  );

// The lines, a sentence at a time (quote.ts cuts them the same way).
const sentencesOf = (lines: string) => piecesOf(lines).map((piece) => piece.text);

// A reply's opening "Yes," or 「はい、」, if it has one, and the rest.
function opening(reply: string): { yes: string; rest: string } | null {
  const match = /^(\p{L}+)[\s,.:!、。！—–-]+(.+)$/su.exec(reply);
  const [, first = "", rest = ""] = match ?? [];
  if (!YES.has(plain(first)) && !JA_YES.test(first)) return null;
  return { yes: first, rest: rest.replace(/^\p{Ll}/u, (letter) => letter.toUpperCase()) };
}

/** `written`, as it may be shown: checked word by word against `sources`,
    its "Yes" kept only if `question` asks nothing the lines don't have. */
export function check(written: string, sources: Sources, question: string): Checked {
  const { title, q, owner } = sources;
  const lines = known(sources.lines);
  const all = known(sources.lines, title, q, owner);
  const denied = denies(sources.lines);
  const start = opening(written);
  const body = start ? start.rest : written;
  const { unsaid, said } = unsaidIn(body, all);
  if (unsaid.length) return { failing: "words", unsaid: [...new Set(unsaid)] };
  if (!said) return { failing: "nothing", unsaid: [] };
  // What only a sentence with a "not" in it says is said with the "not":
  // "He hasn't competed" is no source for "He has competed".
  if (denied && !denies(body)) {
    const undenied = sentencesOf(sources.lines).filter((sentence) => !denies(sentence));
    if (unsaidIn(body, known(...undenied, title, q, owner)).unsaid.length) return { failing: "denial", unsaid: [] };
  }
  if (!start) return { reply: written };
  // "Yes" answers the question, so the lines must say it themselves, or
  // have all the question asks about (the owner's name and grammar aside)
  // and deny none of it: "Has he competed?" isn't a yes on "He hasn't".
  const asked = unsaidIn(question, all);
  const saysYes = lines.words.has("yes") || lines.text.includes("はい");
  const yes = saysYes || (!denied && !asked.unsaid.length && asked.said > 0);
  return { reply: yes ? written : body };
}
