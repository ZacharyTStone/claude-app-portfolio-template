/* What a reply's sources name and count, in every way a reply may write it. */
import { addressesIn } from "../text/addresses.ts";
import { numberBeforeUnit, numberIn } from "../text/numbers.ts";
import {
  compoundParts,
  dottedParts,
  hasLetter,
  latinWordsIn,
  withPlainCharacters,
  withoutDotsAndDashes,
} from "../text/words.ts";

export type Vocabulary = {
  /** Each word of the sources in Latin letters or digits, in lower case:
      whole, in its parts, and in the other ways it's written. */
  words: Set<string>;
  /** Each of their numbers, as it's compared (`numberIn`). */
  numbers: Set<string>;
  /** Each of their emails, handles, links and sites, in lower case. */
  addresses: Set<string>;
};

/** The shortest word a plural's "s" is taken off: "APIs", not "JS" or "AWS". */
const MIN_PLURAL_LENGTH = 4;

// Rough, and only ever compared with another word's: "kubernetes" is
// "kubernete" on both sides.
const singular = (lowered: string): string =>
  lowered.length >= MIN_PLURAL_LENGTH && lowered.endsWith("s") && !lowered.endsWith("ss")
    ? lowered.slice(0, -1)
    : lowered;

// The ways one name is written, in lower case: as it is, without the dots
// and dashes some write in it, and each of those without a plural's "s".
function writtenForms(word: string): string[] {
  const lowered = word.toLowerCase();
  // A number's dots are part of it: "1.04" isn't "104".
  const joined = hasLetter(lowered) ? withoutDotsAndDashes(lowered) : lowered;
  return [lowered, joined, singular(lowered), singular(joined)];
}

// A word of the sources as a reply may take it: whole, a part of a compound
// ("US" of "US-based"), or a part of a dotted name ("Node" of "Node.js").
const readingsOf = (word: string): string[] => [
  word,
  ...compoundParts(word).flatMap((part) => [part, ...dottedParts(part)]),
];

export function vocabularyOf(...sources: string[]): Vocabulary {
  const texts = sources.map(withPlainCharacters);
  const words = texts.flatMap(latinWordsIn).flatMap(({ text }) => readingsOf(text));
  return {
    words: new Set(words.flatMap(writtenForms)),
    numbers: new Set(words.map(numberIn).filter((number) => number !== undefined)),
    addresses: new Set(texts.flatMap(addressesIn).map(({ text }) => text.toLowerCase())),
  };
}

/** Whether the sources have a word, in any of the ways it's written. */
export const hasWord = ({ words }: Vocabulary, word: string): boolean =>
  writtenForms(word).some((form) => words.has(form));

/** Whether the sources have the number a word says: the same number ("2350"
    for "2,350", "10" for "ten"), or the number of one with its unit written
    on ("385" for "385ms"). */
export function hasNumber({ numbers }: Vocabulary, word: string): boolean {
  const number = numberIn(word);
  if (number === undefined) return false;
  const beforeUnit = numberBeforeUnit(number);
  return numbers.has(number) || (beforeUnit !== undefined && numbers.has(beforeUnit));
}

/** Whether the sources have an email, a handle, a link or a site, whole:
    as an address of theirs, or a site as a word of theirs ("example.com"
    of "alex@example.com"; no word has an "@" or a "://"). */
export function hasAddress({ addresses, words }: Vocabulary, address: string): boolean {
  const lowered = address.toLowerCase();
  return addresses.has(lowered) || words.has(lowered);
}
