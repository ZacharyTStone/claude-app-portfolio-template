/* What a reply says that a check can tell from its ordinary words: an
   address, a number, a name. Each is a claim its sources have to have. */
import { addressesIn, isDottedAddress } from "../text/addresses.ts";
import { numberIn } from "../text/numbers.ts";
import { pieceStartsIn } from "../text/sentences.ts";
import {
  compoundParts,
  dottedParts,
  hasCapitalInside,
  hasLetter,
  latinWordsIn,
  startsWithCapital,
  type Found,
} from "../text/words.ts";

/** One thing a reply says that has to be its sources', as the reply wrote
    it (`text`):
    - address: an email, a handle or a link, whole;
    - number: in digits ("2,350", the 2 of "N2") or written out ("ten");
    - site: a word in lower case with a dot inside it ("example.com");
    - name: a word that names something, or several joined by a dot
      (`names` has each: "Node" of "Node.js").
    All but an address are a part of `word`, the word of the reply they're
    in ("US" of "US-based"). */
export type Claim =
  | { kind: "address"; text: string }
  | { kind: "number"; text: string; word: string }
  | { kind: "site"; text: string; word: string }
  | { kind: "name"; text: string; word: string; names: string[] };

/** How a reply's words are read for names. */
export type Reading = {
  /** The reply is in a language without capitals (Japanese): a name can't
      be told by its capital there, so every word in Latin letters is one. */
  isEveryLatinWordAName: boolean;
  /** What the visitor's question names, in lower case. */
  namedInQuestion: ReadonlySet<string>;
};

type WordReading = Reading & {
  /** The word is the first of its sentence, where any word has a capital. */
  isFirstOfSentence: boolean;
};

/** Words that may have a capital in the middle of a sentence and name
    nothing: after a colon or a dash ("No: He has…"), or as "I" always does.
    "May" isn't here (a capitalised one is the month), and "US" never reaches
    this list: a word all in capitals is a name. */
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

const isGrammar = (lowered: string): boolean => GRAMMAR.has(lowered) || lowered.endsWith("n't");

function isName(word: string, { isFirstOfSentence, isEveryLatinWordAName, namedInQuestion }: WordReading): boolean {
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

/** What one part of a word claims, if anything. */
type PartRule = (part: string, word: string, reading: WordReading) => Claim | undefined;

const aNumber: PartRule = (part, word) =>
  numberIn(part) === undefined ? undefined : { kind: "number", text: part, word };

const aSite: PartRule = (part, word) => (isDottedAddress(part) ? { kind: "site", text: part, word } : undefined);

const itsNames: PartRule = (part, word, reading) => {
  // Only the first name of a dotted word can be the first of a sentence.
  const names = dottedParts(part).filter((name, nameIndex) =>
    isName(name, { ...reading, isFirstOfSentence: reading.isFirstOfSentence && nameIndex === 0 }),
  );
  return names.length ? { kind: "name", text: part, word, names } : undefined;
};

/** The first of these to find a claim in a part of a word decides what the
    part claims. */
const PART_RULES: readonly PartRule[] = [aNumber, aSite, itsNames];

// A compound is read a part at a time, and only its first part can be the
// first of a sentence.
const claimsOfWord = (word: string, reading: WordReading): Claim[] =>
  compoundParts(word).flatMap((part, partIndex) => {
    const partReading = { ...reading, isFirstOfSentence: reading.isFirstOfSentence && partIndex === 0 };
    return PART_RULES.map((rule) => rule(part, word, partReading)).find((claim) => claim !== undefined) ?? [];
  });

const isWithin = ({ start, text }: Found, index: number): boolean => index >= start && index < start + text.length;

// The first of its sentence: no letter or digit comes before it there.
function isFirstOfItsSentence(text: string, sentenceStarts: number[], wordStart: number): boolean {
  const sentenceStart = sentenceStarts.findLast((start) => start <= wordStart) ?? 0;
  return !/[\p{L}\p{N}]/u.test(text.slice(sentenceStart, wordStart));
}

/** What a reply claims, in its order: its addresses, then what its words
    claim. An address is one claim, whole ("alex@example.org" isn't the
    sources' "alex@example.com", though each of its words but one is), so
    the words inside one claim nothing more. */
export function claimsIn(reply: string, reading: Reading): Claim[] {
  const addresses = addressesIn(reply);
  const sentenceStarts = pieceStartsIn(reply);
  const wordClaims = latinWordsIn(reply)
    .filter((word) => !addresses.some((address) => isWithin(address, word.start)))
    .flatMap((word) => {
      const isFirstOfSentence = isFirstOfItsSentence(reply, sentenceStarts, word.start);
      return claimsOfWord(word.text, { ...reading, isFirstOfSentence });
    });
  return [...addresses.map(({ text }): Claim => ({ kind: "address", text })), ...wordClaims];
}
