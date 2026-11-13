/* Whether what a model wrote is the visitor's question and nothing else,
   now said to the owner. The words here are English ones: a question is
   rewritten only on an English page. */
import { isQuestionToOwner } from "../../../contracts/ask.ts";
import { withPlainCharacters } from "../text/words.ts";

/** Why a rewrite may not stand in for the question:
    - long: it's longer than a question may be or on more than one line,
      or the model ran out of room before it had finished;
    - same: it has the question's own words, so there's nothing to send;
    - added: it has a word that isn't the question's, a word for "you", or
      the form a verb of the question's takes with "you";
    - dropped: it's missing a word of the question's that isn't a word for
      the owner;
    - moved: its words aren't in the question's order ("Is Sam better than
      you?" for "Is Alex better than Sam?");
    - about: it's no more said to the owner than the question was, with
      no word for "you" that the question hasn't. */
export type Refused = "long" | "same" | "added" | "dropped" | "moved" | "about";

/** A rewrite as it may be used, or why it may not be. */
export type CheckedRewrite = { toOwner: string; why?: undefined } | { toOwner?: undefined; why: Refused };

const SECOND_PERSON_WORDS: ReadonlySet<string> = new Set(["you", "your", "yours", "yourself"]);

/** What a question about someone says in place of their name. */
const THIRD_PERSON_WORDS: ReadonlySet<string> = new Set(
  "he she they him her them his hers their theirs himself herself themselves".split(" "),
);

/** What a contraction or a possessive writes on to a word ("you're",
    "Alex's"). Each is read as a word of its own, after the word it's on,
    so "What's he built?" may become "What have you built?". */
const ENDINGS: readonly string[] = ["'s", "'re", "'ve", "'d", "'ll"];

/** The verbs whose form with "you" isn't the third-person one less its
    ending: each third-person form, and what "you" may take in its place.
    "'s" is the "is" or the "has" written on to another word ("what's"). */
const IRREGULAR_YOU_FORMS: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries({
    is: ["are", "'re"],
    "isn't": ["aren't"],
    was: ["were"],
    "wasn't": ["weren't"],
    has: ["have", "'ve"],
    "hasn't": ["haven't"],
    does: ["do"],
    "doesn't": ["don't"],
    "'s": ["are", "'re", "have", "'ve"],
  }),
);

// "knows" for "know", "watches" for "watch", "tries" for "try".
const thirdPersonFormsOfRegularVerb = (youForm: string): string[] => [
  `${youForm}s`,
  `${youForm}es`,
  ...(youForm.endsWith("y") ? [`${youForm.slice(0, -1)}ies`] : []),
];

// "do" is the form with "you" of "does", and "know" of "knows". A
// third-person word isn't a verb: "his" has no "hi".
const isYouFormOf = (youForm: string, thirdPerson: string): boolean =>
  IRREGULAR_YOU_FORMS.get(thirdPerson)?.includes(youForm) ??
  (!THIRD_PERSON_WORDS.has(thirdPerson) && thirdPersonFormsOfRegularVerb(youForm).includes(thirdPerson));

// Space, a slash ("he/she"), a long dash, and the dot between the parts of
// a name in katakana.
const BETWEEN_WORDS = /[\s/—–・]+/;

// Quotation marks, brackets, and what ends a clause. The "+" of "C++" and
// the "#" of "C#" are part of the name, and stay.
const PUNCTUATION_ROUND_A_WORD = /^["'“”«»()[\]{}<>,.;:!?…-]+|["'“”«»()[\]{}<>,.;:!?…-]+$/g;

const WITH_ENDING = new RegExp(`^(.+)(${ENDINGS.join("|")})$`);

// "what's" is "what" and "'s".
function withEndingApart(word: string): string[] {
  const [, base, ending] = WITH_ENDING.exec(word) ?? [];
  return base && ending ? [base, ending] : [word];
}

/** The words of a text as they're compared: without capitals or the
    punctuation round them, an ending apart from its word. */
const wordsOf = (text: string): string[] =>
  withPlainCharacters(text)
    .toLowerCase()
    .split(BETWEEN_WORDS)
    .map((word) => word.replace(PUNCTUATION_ROUND_A_WORD, ""))
    .filter(Boolean)
    .flatMap(withEndingApart);

const isEnding = (word: string | undefined): boolean => word !== undefined && ENDINGS.includes(word);

/** Each part of each of the owner's names, as it's compared: "alex" and
    "example". */
type OwnerWords = ReadonlySet<string>;

const isAboutOwner = (word: string | undefined, ownerWords: OwnerWords): boolean =>
  word !== undefined && (ownerWords.has(word) || THIRD_PERSON_WORDS.has(word));

// A word for the owner, or the ending on one (the "'s" of "Alex's").
const mayLeaveOut = (asked: string[], index: number, ownerWords: OwnerWords): boolean =>
  isAboutOwner(asked[index], ownerWords) || (isEnding(asked[index]) && isAboutOwner(asked[index - 1], ownerWords));

const isSecondPerson = (word: string | undefined): boolean => word !== undefined && SECOND_PERSON_WORDS.has(word);

// A word for "you", or the ending on one (the "'re" of "you're").
const mayPutIn = (written: string[], index: number): boolean =>
  isSecondPerson(written[index]) || (isEnding(written[index]) && isSecondPerson(written[index - 1]));

const saysTheSame = (asked: string, written: string): boolean => asked === written || isYouFormOf(written, asked);

const addedWords = (asked: string[], written: string[]): string[] =>
  written.filter(
    (word, index) => !mayPutIn(written, index) && !asked.some((askedWord) => saysTheSame(askedWord, word)),
  );

const droppedWords = (asked: string[], written: string[], ownerWords: OwnerWords): string[] =>
  asked.filter(
    (word, index) =>
      !mayLeaveOut(asked, index, ownerWords) && !written.some((writtenWord) => saysTheSame(word, writtenWord)),
  );

// How far into the rewrite a reading may be: each of `places` (a count of
// its words read so far), and wherever reading on from one through words
// that may be put in gets to.
function withWordsPutIn(places: ReadonlySet<number>, written: string[]): Set<number> {
  const reached = new Set(places);
  for (const place of places) {
    for (let index = place; index < written.length && mayPutIn(written, index); index++) reached.add(index + 1);
  }
  return reached;
}

/** Whether the rewrite is the question read a word at a time, in order:
    each word of the question is said by the next word of the rewrite, or
    left out where it may be, and the rewrite has no other words but those
    it may put in. */
function isInOrder(asked: string[], written: string[], ownerWords: OwnerWords): boolean {
  // Every place in the rewrite the question's words so far may have got to.
  let places = withWordsPutIn(new Set([0]), written);
  for (const [index, askedWord] of asked.entries()) {
    const next = new Set<number>();
    for (const place of places) {
      if (mayLeaveOut(asked, index, ownerWords)) next.add(place);
      const writtenWord = written[place];
      if (writtenWord !== undefined && saysTheSame(askedWord, writtenWord)) next.add(place + 1);
    }
    places = withWordsPutIn(next, written);
  }
  return places.has(written.length);
}

function whyNotInOrder(asked: string[], written: string[], ownerWords: OwnerWords): Refused {
  if (addedWords(asked, written).length) return "added";
  return droppedWords(asked, written, ownerWords).length ? "dropped" : "moved";
}

const countOfYou = (words: string[]): number => words.filter(isSecondPerson).length;

/** `rewrite`, as it may go in the message to the owner in place of
    `question`. `owner` is the owner's names, in every way the page writes
    them. */
export function checkSameQuestion(rewrite: string, question: string, owner: string): CheckedRewrite {
  if (!isQuestionToOwner(rewrite)) return { why: "long" };
  const ownerWords = new Set(wordsOf(owner));
  const [asked, written] = [wordsOf(question), wordsOf(rewrite)];
  if (asked.join(" ") === written.join(" ")) return { why: "same" };
  if (!isInOrder(asked, written, ownerWords)) return { why: whyNotInOrder(asked, written, ownerWords) };
  return countOfYou(written) > countOfYou(asked) ? { toOwner: rewrite } : { why: "about" };
}
