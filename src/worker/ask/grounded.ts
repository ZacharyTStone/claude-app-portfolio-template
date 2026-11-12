/* Whether a reply the model wrote names and counts only what the site does.

   A reply is written from the lines the picker chose (write.ts), in the
   model's own words: it may rephrase them, say yes or no, deny, hedge, and
   use the ordinary words of the question it answers. What it may not do is
   bring in a fact of its own, and the facts a check can tell from ordinary
   words are names and numbers. So every name and number in a reply has to
   be in the reply's sources: the lines it was written from, their tab's
   name, the site's own question over them, and the owner's name.

   - A number is one in digits ("2,350", "12%", "1.04", the 2 of "N2") or
     written out ("ten"). "2,350" is the same number as "2350", and "ten"
     the same as "10".
   - A name, in English, is a word with a capital inside it ("GraphQL",
     "AWS"), or a capitalised word that isn't just the first of its sentence
     and isn't grammar ("Tokyo" in "He lives in Tokyo.").
   - A name, in Japanese, is any word in Latin letters ("React", "JLPT").
   - An address is a name too, in either: an email, a handle or a link
     ("alex@example.com", "@alex", "https://example.com") has to be in the
     sources whole, and so does a word with a dot in it ("example.com").

   What the visitor typed is never a source: a name or a number that's only
   in the question fails like any other.

   What the check can't tell from an ordinary word, it lets through: a name
   that only starts a sentence ("Tokyo is…", unless the question names it),
   a name in kana or kanji, a number in kanji, and "one", which is as often
   a pronoun. Nor does it judge what a reply says in ordinary words: "No" on
   lines that mean yes passes. Keeping a reply to what its lines say is the
   job of the model's instructions (write.ts), and the page shows those
   lines under the reply (the `cited` lines /ask sends), so a visitor can
   see what it was made from.

   A reply that fails is not shown: the lines are quoted instead. The check
   reads English and Japanese; on a page in another language no reply is
   written, and the lines are quoted as before. */

import { namedIn } from "./coverage.ts";
import { piecesOf } from "./quote.ts";

/** The languages a reply can be written, and checked, in. */
export const CHECKABLE_LANGUAGES: readonly string[] = ["en", "ja"];

/** Of those, the ones written without capitals: a name can't be told by
    its capital there, so every word in Latin letters is read as one. */
const LANGUAGES_WITHOUT_CAPITALS: readonly string[] = ["ja"];

/** What a reply's names and numbers may come from. */
export type Sources = {
  /** The lines it's written from. */
  lines: string;
  /** The name of the tab they're in. */
  title: string;
  /** The site's own question they answer. */
  q: string;
  /** The owner's names, in every way the page writes them. */
  owner: string;
};

/** The reply as it may be shown; or, when it may not be, the names and
    numbers it has that its sources don't, as it wrote them: for the log,
    and for asking the model again. */
export type Checked = { reply: string; unsourced?: undefined } | { reply?: undefined; unsourced: string[] };

// ---- Words ------------------------------------------------------------------------------

// Text with one form of each character (ｆｕｌｌ width to plain, so "２０２４" is
// "2024") and one kind of apostrophe. Capitals are kept: a name is told by
// them.
const withPlainCharacters = (text: string) => text.normalize("NFKC").replace(/[’‘]/g, "'");

// A word in Latin letters or digits, with what's written inside one:
// "Node.js", "2,350+", "CI/CD", "doesn't", "C#", "full-stack". The "%" of
// "12%" and the "年" of "4年" aren't part of it.
const LATIN_WORD = /[\p{Script=Latin}\p{N}]+(?:[.,'+#/&-]+[\p{Script=Latin}\p{N}]+)*[+#]*/gu;

// "Alex's" as "Alex", "he's" as "he", "they're" as "they", "I'm" as "I".
const withoutApostropheEnding = (word: string) => word.replace(/'(?:s|re|ve|ll|d|m)$/i, "");

// The words a compound is made of, joined by a slash, an ampersand or a
// dash: "CI/CD", "US-based", "4-year". Each is checked on its own.
const compoundParts = (word: string) => word.split(/[/&-]+/).filter(Boolean);

const hasDigit = (word: string) => /\p{N}/u.test(word);
const hasLetter = (word: string) => /\p{L}/u.test(word);
const hasCapitalInside = (word: string) => /\p{Lu}/u.test(word.slice(1));
const startsWithCapital = (word: string) => /^\p{Lu}/u.test(word);

// A name's own parts, joined by a dot or a comma: "Node.js" is "Node" too.
// Not a number's: "1.04" has no "04", nor "2,350" a "350".
const dottedParts = (word: string) => (hasDigit(word) ? [word] : word.split(/[.,]+/).filter(Boolean));

// ---- Numbers ----------------------------------------------------------------------------

// A number in digits as it's compared: "2,350+" and "2350" are the same.
const withoutCommasOrPlus = (digits: string) => digits.replace(/,/g, "").replace(/\+$/, "");

// The numbers a reply may write out, and each in digits. "One" isn't here:
// it's as often a pronoun ("the one he built"), and a reply shouldn't fail
// for that. Nor are "first" and "second", "once" and "twice", "half".
const NUMBER_WORDS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    zero: "0",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    thirteen: "13",
    fourteen: "14",
    fifteen: "15",
    sixteen: "16",
    seventeen: "17",
    eighteen: "18",
    nineteen: "19",
    twenty: "20",
    thirty: "30",
    forty: "40",
    fifty: "50",
    sixty: "60",
    seventy: "70",
    eighty: "80",
    ninety: "90",
    hundred: "100",
    thousand: "1000",
    million: "1000000",
    billion: "1000000000",
    dozen: "12",
  }),
);

// The number a word says, as it's compared: "2,350+" is "2350", "Ten" and
// "tens" are "10", and "N2" (digits in a name) is "n2". Undefined for a
// word that says none.
function numberIn(word: string): string | undefined {
  const lowered = word.toLowerCase();
  if (hasDigit(lowered)) return withoutCommasOrPlus(lowered);
  return NUMBER_WORDS.get(lowered) ?? NUMBER_WORDS.get(lowered.replace(/s$/, ""));
}

// A number with its unit written on to it, in lower case: "385ms", "1.04s",
// "5k". The first group is the number.
const NUMBER_WITH_UNIT = /^(\p{Nd}[\p{Nd}.,]*)\p{Ll}+$/u;

// ---- Names ------------------------------------------------------------------------------

// Words that may have a capital in the middle of a sentence and name
// nothing: after a colon or a dash ("No: He has…"), or as "I" always does.
// "May" isn't here (a capitalised one is the month), and "US" never reaches
// this list: a word all in capitals is a name.
const GRAMMAR = new Set(
  (
    "a an the this that these those there here he him his she her hers they them their theirs it its we us our " +
    "you your i my me mr mrs ms who whom whose which what where when why how is are was were be been being am " +
    "has have had having does do did doing done can could will would shall should might must and or but so nor " +
    "yet if as at by for from in into of on onto to with within without about across after before between " +
    "during over under through until since than then also too both either neither each every all any some " +
    "most many much more less few several such only just even still already always never often sometimes " +
    "usually yes yeah yep no nope not none nothing ok okay sure right correct exactly absolutely indeed " +
    "actually basically currently mostly mainly primarily probably maybe perhaps unfortunately sorry well now " +
    "today however though although because while whereas besides instead otherwise meanwhile overall"
  ).split(" "),
);

// Whether a word in lower case is grammar: one of GRAMMAR, or a "doesn't".
const isGrammar = (lowered: string) => GRAMMAR.has(lowered) || lowered.endsWith("n't");

/** What tells whether a word of a reply is a name. */
type WordContext = {
  /** The word is the first of its sentence, where any word has a capital. */
  isFirstOfSentence: boolean;
  /** The reply is in a language without capitals (Japanese). */
  isEveryLatinWordAName: boolean;
  /** What the visitor's question names, in lower case (coverage.ts). */
  namedInQuestion: ReadonlySet<string>;
};

// Whether a word of a reply (one with no digit in it) names something.
function isName(word: string, { isFirstOfSentence, isEveryLatinWordAName, namedInQuestion }: WordContext): boolean {
  if (!hasLetter(word)) return false;
  const lowered = word.toLowerCase();
  // "OK" is no name, however it's written.
  if (lowered === "ok") return false;
  if (isEveryLatinWordAName || hasCapitalInside(word)) return true;
  if (!startsWithCapital(word)) return false;
  // A sentence's first word has its capital whatever it is, so it's read as
  // a name only when the question itself names it: "Does he use Vercel?"
  // can't have "Vercel is…" from lines that don't say Vercel.
  if (isFirstOfSentence) return namedInQuestion.has(lowered);
  return !isGrammar(lowered);
}

// An address: an email or a handle ("alex@example.com", "@alex"), or a
// link ("https://example.com/cv"). Whatever ends the sentence after one
// comes with it, and `addressesIn` takes that off.
const ADDRESS =
  /[A-Za-z0-9._%+-]*@[A-Za-z0-9_][A-Za-z0-9._-]*|[A-Za-z][A-Za-z0-9+.-]*:\/\/[A-Za-z0-9._~/?#@!$&*+=%-]+/g;

/** An address in a text: where it starts, and the address as it's written
    there, without the full stop or comma after it. */
type Address = { start: number; text: string };

// The addresses in a text.
const addressesIn = (text: string): Address[] =>
  [...text.matchAll(ADDRESS)].map((found) => ({ start: found.index, text: found[0].replace(/[.,;:!?]+$/, "") }));

// A word in lower case with a dot inside it: a site's address
// ("example.com"), a file's name ("site.config.ts"). Not "e.g" or "a.m".
const DOTTED_ADDRESS = /^\p{Ll}{2,}(?:\.\p{Ll}{2,})+$/u;

// ---- What the sources name and count ----------------------------------------------------

/** What some texts name and count, to check a reply's names and numbers
    against. */
type Vocabulary = {
  /** Each of their words in Latin letters or digits, in lower case: whole,
      in its parts, and in the other ways it's written (`writtenForms`). */
  words: Set<string>;
  /** Each of their numbers, as it's compared (`numberIn`). */
  numbers: Set<string>;
  /** Each of their addresses (`addressesIn`), in lower case. */
  addresses: Set<string>;
};

/** The shortest word a plural's "s" is taken off: "APIs", not "JS" or "AWS". */
const MIN_PLURAL_LENGTH = 4;

// A plural without its "s": "apis" as "api", "workers" as "worker". Rough,
// and only ever compared with another word's: "kubernetes" is "kubernete"
// on both sides.
const singular = (lowered: string) =>
  lowered.length >= MIN_PLURAL_LENGTH && lowered.endsWith("s") && !lowered.endsWith("ss")
    ? lowered.slice(0, -1)
    : lowered;

// The ways one name is written, in lower case: as it is, without the dots
// and dashes some write in it ("nodejs" for "Node.js", "wifi" for "Wi-Fi"),
// and each of those without a plural's "s".
function writtenForms(word: string): string[] {
  const lowered = word.toLowerCase();
  // A number's dots are part of it: "1.04" isn't "104".
  const withoutDotsAndDashes = hasLetter(lowered) ? lowered.replace(/[.-]/g, "") : lowered;
  return [lowered, withoutDotsAndDashes, singular(lowered), singular(withoutDotsAndDashes)];
}

// The words, numbers and addresses of the texts.
function vocabularyOf(...texts: string[]): Vocabulary {
  const words = new Set<string>();
  const numbers = new Set<string>();
  const addresses = new Set<string>();
  const add = (word: string) => {
    for (const form of writtenForms(word)) words.add(form);
    const number = numberIn(word);
    if (number !== undefined) numbers.add(number);
  };
  for (const text of texts.map(withPlainCharacters)) {
    for (const address of addressesIn(text)) addresses.add(address.text.toLowerCase());
    for (const [found] of text.matchAll(LATIN_WORD)) {
      const word = withoutApostropheEnding(found);
      add(word);
      for (const part of compoundParts(word)) {
        add(part);
        dottedParts(part).forEach(add);
      }
    }
  }
  return { words, numbers, addresses };
}

// Whether the sources have a word, in any of the ways it's written.
const hasWord = ({ words }: Vocabulary, word: string) => writtenForms(word).some((form) => words.has(form));

// Whether the sources have the number a word says: the same number ("2350"
// for "2,350", "10" for "ten"), or the number of one with its unit written
// on ("385" for "385ms").
function hasNumber({ numbers }: Vocabulary, word: string): boolean {
  const number = numberIn(word);
  if (number === undefined) return false;
  const numberBeforeUnit = NUMBER_WITH_UNIT.exec(number)?.[1];
  return numbers.has(number) || (numberBeforeUnit !== undefined && numbers.has(withoutCommasOrPlus(numberBeforeUnit)));
}

// ---- The check --------------------------------------------------------------------------

// Where each sentence of a text starts (quote.ts cuts sentences the same
// way: not after "e.g.", not inside quotes).
function sentenceStarts(text: string): number[] {
  const starts: number[] = [];
  let searchFrom = 0;
  for (const sentence of piecesOf(text)) {
    const start = text.indexOf(sentence.text, searchFrom);
    if (start < 0) continue;
    starts.push(start);
    searchFrom = start + sentence.text.length;
  }
  return starts;
}

// The names and numbers in one word of a reply that the sources don't
// have, as the reply wrote them. A compound is read a part at a time, so
// "US-based" needs only its "US" in the sources.
function unsourcedInWord(word: string, vocabulary: Vocabulary, context: WordContext): string[] {
  if (hasWord(vocabulary, word)) return [];
  return compoundParts(word).filter((part, partIndex) => {
    if (hasWord(vocabulary, part)) return false;
    if (numberIn(part) !== undefined) return !hasNumber(vocabulary, part);
    if (DOTTED_ADDRESS.test(part)) return true;
    // Only the first word of a compound can be the first of a sentence.
    return dottedParts(part).some((name, nameIndex) => {
      const isFirstOfSentence = context.isFirstOfSentence && partIndex === 0 && nameIndex === 0;
      return isName(name, { ...context, isFirstOfSentence }) && !hasWord(vocabulary, name);
    });
  });
}

// The names and numbers in a reply's words that the sources don't have.
// The words of `addresses` are left out: an address is checked whole.
function unsourcedWordsIn(
  reply: string,
  addresses: Address[],
  vocabulary: Vocabulary,
  context: Omit<WordContext, "isFirstOfSentence">,
): string[] {
  const starts = sentenceStarts(reply);
  const isInAnAddress = (index: number) =>
    addresses.some(({ start, text }) => index >= start && index < start + text.length);
  return [...reply.matchAll(LATIN_WORD)]
    .filter((found) => !isInAnAddress(found.index))
    .flatMap((found) => {
      const sentenceStart = starts.findLast((start) => start <= found.index) ?? 0;
      // The first of its sentence: no letter or digit comes before it there.
      const isFirstOfSentence = !/[\p{L}\p{N}]/u.test(reply.slice(sentenceStart, found.index));
      return unsourcedInWord(withoutApostropheEnding(found[0]), vocabulary, { ...context, isFirstOfSentence });
    });
}

/** `written`, as it may be shown: every name and number in it has to be in
    `sources`. `question` is what the visitor typed, which is no source, and
    `lang` the language the reply is in (one of CHECKABLE_LANGUAGES). */
export function checkReply(written: string, sources: Sources, question: string, lang: string): Checked {
  const vocabulary = vocabularyOf(sources.lines, sources.title, sources.q, sources.owner);
  const reply = withPlainCharacters(written);
  // An address is checked whole: "alex@example.org" isn't the sources'
  // "alex@example.com", though each of its words but one is.
  const addresses = addressesIn(reply);
  const unsourcedAddresses = addresses
    .map((address) => address.text)
    .filter((address) => !vocabulary.addresses.has(address.toLowerCase()));
  const unsourcedWords = unsourcedWordsIn(reply, addresses, vocabulary, {
    isEveryLatinWordAName: LANGUAGES_WITHOUT_CAPITALS.includes(lang),
    namedInQuestion: new Set(namedIn(question, sources.owner)),
  });
  const unsourced = [...new Set([...unsourcedAddresses, ...unsourcedWords])];
  return unsourced.length ? { unsourced } : { reply: written };
}
