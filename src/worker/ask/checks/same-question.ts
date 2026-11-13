/* Whether a rewrite of the visitor's question is the same question, give
   or take who it's about:

   - Nothing added. Every word of the rewrite is a word of the question, a
     word for "you" ("your", "yourself"), or the form a verb takes with
     "you" where the question has its third-person form ("do" for "does",
     "are" for "is", "know" for "knows").
   - Nothing dropped. Every word of the question is still there, or is one
     of the owner's names, a third-person word ("he", "her", "their"), or
     the third-person form of a verb whose form with "you" is there.
   - Nothing moved. Those words apart, the two have the same words in the
     same order: "Is Sam better than you?" isn't "Is Alex better than Sam?".
   - Said to them. The rewrite has a word for "you" that the question
     hasn't: "Does know testing?" leaves the owner out, and says it to no
     one.

   Words are compared without capitals or the punctuation round them. A
   contraction is its word and its ending, each read on its own: "what's"
   is "what" and "'s", so "What's he built?" may become "What have you
   built?", and the ending on a word for the owner or for "you" goes or
   comes with it ("Alex's" for "your", "he's" for "you're").

   The check reads English, and its words are English ones. */
import { isQuestionToOwner } from "../../../contracts/ask.ts";

/** Why a rewrite may not be used:
    - long: it's longer than a question may be or on more than one line,
      or the model ran out of room before it had finished;
    - same: it has the question's own words, so there's nothing to send;
    - added: it has a word the question doesn't;
    - dropped: it's missing a word of the question's;
    - moved: its words aren't in the question's order;
    - about: it's no more said to the owner than the question was, with
      no word for "you" that the question hasn't. */
export type Refused = "long" | "same" | "added" | "dropped" | "moved" | "about";

/** A rewrite as it may be used, or why it may not be. */
export type CheckedRewrite = { toOwner: string; why?: undefined } | { toOwner?: undefined; why: Refused };

// ---- Words -----------------------------------------------------------------------------

/** The words that say "you": a rewrite may put these in. */
const SECOND_PERSON_WORDS: ReadonlySet<string> = new Set(["you", "your", "yours", "yourself"]);

/** The words a question about someone says in place of their name: a
    rewrite may leave these out. */
const THIRD_PERSON_WORDS: ReadonlySet<string> = new Set(
  "he she they him her them his hers their theirs himself herself themselves".split(" "),
);

/** The endings written on to a word in a contraction or a possessive:
    "you're", "you've", "you'd", "you'll", "he's", "Alex's". Each is read
    as a word of its own, after the word it's on. */
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

// The third-person forms a regular verb has, given its form with "you":
// "knows" for "know", "watches" for "watch", "tries" for "try".
const thirdPersonFormsOf = (youForm: string): string[] => [
  `${youForm}s`,
  `${youForm}es`,
  ...(youForm.endsWith("y") ? [`${youForm.slice(0, -1)}ies`] : []),
];

// Whether `youForm` is the form with "you" of the verb `thirdPerson` is the
// third-person form of: "do" of "does", "know" of "knows". A third-person
// word isn't a verb ("his" has no "hi").
const isYouFormOf = (youForm: string, thirdPerson: string): boolean =>
  IRREGULAR_YOU_FORMS.get(thirdPerson)?.includes(youForm) ??
  (!THIRD_PERSON_WORDS.has(thirdPerson) && thirdPersonFormsOf(youForm).includes(thirdPerson));

// Text as its words are compared: one form of each character (ｆｕｌｌ width
// to plain), one kind of apostrophe, and no capitals.
const comparable = (text: string): string => text.normalize("NFKC").replace(/[’‘]/g, "'").toLowerCase();

// What's between two words: space, a slash ("he/she"), a long dash, and
// the dot between the parts of a name in katakana.
const BETWEEN_WORDS = /[\s/—–・]+/;

// The punctuation round a word that isn't part of it: quotation marks,
// brackets, and what ends a clause. The "+" of "C++" and the "#" of "C#"
// are part of the name, and stay.
const ROUND_A_WORD = /^["'“”«»()[\]{}<>,.;:!?…-]+|["'“”«»()[\]{}<>,.;:!?…-]+$/g;

// A word with an ending written on to it: the word, then the ending.
const WITH_ENDING = new RegExp(`^(.+)(${ENDINGS.join("|")})$`);

// A word as it's compared, and the ending written on to it if it has one:
// "what's" is "what" and "'s".
function withEndingApart(word: string): string[] {
  const [, base, ending] = WITH_ENDING.exec(word) ?? [];
  return base && ending ? [base, ending] : [word];
}

// The words of a text, as they're compared.
const wordsOf = (text: string): string[] =>
  comparable(text)
    .split(BETWEEN_WORDS)
    .map((word) => word.replace(ROUND_A_WORD, ""))
    .filter(Boolean)
    .flatMap(withEndingApart);

const isEnding = (word: string | undefined): boolean => word !== undefined && ENDINGS.includes(word);

// ---- The check --------------------------------------------------------------------------

/** The owner's names as a question may write them: each part of each, as
    it's compared ("alex" and "example"). */
type OwnerWords = ReadonlySet<string>;

// A word that stands for the owner in a question about them: one of their
// names, or a third-person word.
const isAboutOwner = (word: string | undefined, ownerWords: OwnerWords): boolean =>
  word !== undefined && (ownerWords.has(word) || THIRD_PERSON_WORDS.has(word));

// Whether a rewrite may leave out the question's word at `index`: a word
// for the owner, or the ending on one (the "'s" of "Alex's").
const mayLeaveOut = (asked: string[], index: number, ownerWords: OwnerWords): boolean =>
  isAboutOwner(asked[index], ownerWords) || (isEnding(asked[index]) && isAboutOwner(asked[index - 1], ownerWords));

const isSecondPerson = (word: string | undefined): boolean => word !== undefined && SECOND_PERSON_WORDS.has(word);

// Whether a rewrite may put in its word at `index`: a word for "you", or
// the ending on one (the "'re" of "you're").
const mayPutIn = (written: string[], index: number): boolean =>
  isSecondPerson(written[index]) || (isEnding(written[index]) && isSecondPerson(written[index - 1]));

// Whether a word of the rewrite says what a word of the question does: the
// same word, or its verb in the form that goes with "you".
const saysTheSame = (asked: string, written: string): boolean => asked === written || isYouFormOf(written, asked);

// The rewrite's words that the question has no word for.
const addedWords = (asked: string[], written: string[]): string[] =>
  written.filter(
    (word, index) => !mayPutIn(written, index) && !asked.some((askedWord) => saysTheSame(askedWord, word)),
  );

// The question's words that the rewrite has no word for.
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

// Whether the rewrite is the question read a word at a time, in order: each
// word of the question is said by the next word of the rewrite, or left
// out where it may be, and the rewrite has no other words but those it may
// put in.
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

// Why a rewrite that isn't the question in order isn't: it added a word,
// or dropped one, or, with neither, moved one.
function whyNotTheSame(asked: string[], written: string[], ownerWords: OwnerWords): Refused {
  if (addedWords(asked, written).length) return "added";
  return droppedWords(asked, written, ownerWords).length ? "dropped" : "moved";
}

// How many of some words say "you".
const countOfYou = (words: string[]): number => words.filter(isSecondPerson).length;

/** `rewrite`, as it may go in the message to the owner in place of
    `question`: text the page takes (`isQuestionToOwner`), and the same
    question, give or take who it's about, now said to them. `owner` is the
    owner's names. */
export function checkSameQuestion(rewrite: string, question: string, owner: string): CheckedRewrite {
  if (!isQuestionToOwner(rewrite)) return { why: "long" };
  const ownerWords = new Set(wordsOf(owner));
  const [asked, written] = [wordsOf(question), wordsOf(rewrite)];
  if (asked.join(" ") === written.join(" ")) return { why: "same" };
  if (!isInOrder(asked, written, ownerWords)) return { why: whyNotTheSame(asked, written, ownerWords) };
  return countOfYou(written) > countOfYou(asked) ? { toOwner: rewrite } : { why: "about" };
}
