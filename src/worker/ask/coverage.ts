/* A question that names something specific (a tool, a company, a place) is
   answered only by an answer that names it too: any other would read as a
   "no" the site never said. */
import { isNotNil } from "es-toolkit";
import type { AskAnswer } from "../../contracts/ask.ts";
import { hasCapitalInside, hasDigit, hasLetter, startsWithCapital, withoutDotsAndDashes } from "./text/words.ts";

// Words that start a question, or are capitalised in one, without naming
// anything the answer has to have.
const PLAIN_WORDS = new Set(
  (
    "is are was were am be been do does did doing can could would will should shall may might must has have had " +
    "what what's whats where where's when why how how's who who's whose whom which tell please hi hey hello " +
    "thanks thank so and but or if in on at for with about any anything anyone some something the a an " +
    "i i'm im i'd i've i'll my me we our you your he he's his him she she's her they they're their them it it's " +
    "its this that these those there here yes no ok okay just also really ever still mr ms mrs dr sir let let's lets " +
    "give show list describe explain share name besides other apart outside quick question"
  ).split(" "),
);

// A word as it's written in a question or an answer: letters and digits,
// and the dots, dashes, pluses and hashes inside names ("Node.js", "C#",
// "front-end", "Alex's").
const WORD = /[\p{Script=Latin}\p{N}](?:[\p{Script=Latin}\p{N}+#]|[.'’-](?=[\p{Script=Latin}\p{N}]))*/gu;

const POSSESSIVE = /['’]s$/i;

// "Alex's" is compared as "alex".
const comparable = (word: string) => word.replace(POSSESSIVE, "").toLowerCase();

// A small "s" on the end may make a name more than one: "Workers", "APIs".
// A capital one is the name's own: "CSS" isn't several of "CS", nor "iOS"
// of "io".
const mayBePlural = (word: string) => word.replace(POSSESSIVE, "").endsWith("s");

/** Something a question names: as it's compared, and whether it may be
    more than one of what an answer names. */
type Named = { term: string; mayBePlural: boolean };

// What comes before the first word of a sentence: the text's start, or a
// full stop, question or exclamation mark, then any opening quote or
// bracket. Matches `He said. "` before the Why in `He said. "Why?"`.
const SENTENCE_START = /(?:^|[.!?。？！]\s*)["'“‘(（「]*$/;

const startsSentence = (text: string, index: number) => SENTENCE_START.test(text.slice(0, index));

/** A single letter never names anything. */
const MIN_NAME_LENGTH = 2;

// With a capital inside ("GraphQL"), with letters and digits ("S3"), or
// with a capital first where no sentence starts.
const isWrittenAsAName = (word: string, isFirstOfSentence: boolean): boolean =>
  hasCapitalInside(word) || (hasLetter(word) && hasDigit(word)) || (startsWithCapital(word) && !isFirstOfSentence);

// The specific things a question names: never the owner's name, nor a word
// any question starts with. A word all in lower case is read as a plain one.
function namesIn(question: string, owner: string): Named[] {
  const ownerWords = new Set(
    owner
      .split(/[\s・]+/)
      .filter(Boolean)
      .map(comparable),
  );
  const text = question.normalize("NFKC");
  const named = new Map<string, Named>();
  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    const term = comparable(word);
    if (term.length < MIN_NAME_LENGTH || ownerWords.has(term) || PLAIN_WORDS.has(term)) continue;
    const isAName = isWrittenAsAName(word, startsSentence(text, match.index));
    if (isAName) named.set(term, { term, mayBePlural: mayBePlural(word) });
  }
  return [...named.values()];
}

/** The specific things a question names, each as it's compared. */
export const namedIn = (question: string, owner: string): string[] => namesIn(question, owner).map(({ term }) => term);

type AnswerWords = Pick<AskAnswer, "text" | "title" | "q">;

const everythingSaid = ({ text, title, q }: AnswerWords) => [text, title, q].join("\n").normalize("NFKC");

// Each word, and its parts: "node.js" is also "node" and "js".
function wordsIn(text: string): Set<string> {
  const words = new Set<string>();
  for (const [word] of text.matchAll(WORD)) {
    const whole = comparable(word);
    words.add(whole);
    for (const part of whole.split(/[.-]/)) if (part) words.add(part);
  }
  return words;
}

// An answer's word with one of these on the end of the question's names
// the same thing ("PostgreSQL" for "Postgres"). With any other ending it's
// another thing: "JavaScript" isn't "Java".
const SAME_THING_ENDINGS = ["s", "es", "js", "ql", "sql"];

/** The shortest name a slip of the keyboard is forgiven in. A shorter one
    is too near another thing's: "Vue" and "Vuex", "Nest" and "Next". */
const MIN_MISTYPED_LENGTH = 6;

// One slip inside the name: a letter too many, a letter missing, or two
// neighbours swapped. A wrong first or last letter, or a letter changed for
// another, isn't forgiven: those are how one name differs from another.
function isMistyped(typed: string, name: string): boolean {
  if (name.length < MIN_MISTYPED_LENGTH || typed === name) return false;
  if (typed[0] !== name[0] || typed.at(-1) !== name.at(-1)) return false;
  const [shorter, longer] = typed.length < name.length ? [typed, name] : [name, typed];
  if (longer.length - shorter.length === 1) {
    // One letter more: the same once it's taken out.
    return [...longer].some((_, i) => longer.slice(0, i) + longer.slice(i + 1) === shorter);
  }
  if (typed.length !== name.length) return false;
  // The same but for two neighbours, which are each other's.
  const swapped = [...typed].findIndex((letter, i) => letter !== name[i]);
  return (
    typed[swapped] === name[swapped + 1] &&
    typed[swapped + 1] === name[swapped] &&
    typed.slice(swapped + 2) === name.slice(swapped + 2)
  );
}

// The third way is the name's singular: "worker" for "Workers".
const namesSameThing = ({ term, mayBePlural }: Named, answerWord: string): boolean =>
  answerWord === term ||
  withoutDotsAndDashes(answerWord) === withoutDotsAndDashes(term) ||
  (mayBePlural && term.slice(0, -1) === answerWord) ||
  SAME_THING_ENDINGS.some((ending) => answerWord === `${term}${ending}`) ||
  isMistyped(term, answerWord);

// Two names written one after the other, as the one word they may be.
const joined = (first: Named, second: Named): Named => ({
  term: first.term + second.term,
  mayBePlural: second.mayBePlural,
});

// Short forms a visitor may use for what an answer spells out: a short
// list, to add to when the eval shows a miss.
const SPELLED_OUT: Record<string, string[]> = {
  cs: ["computer science"],
  cv: ["resume", "résumé"],
  js: ["javascript"],
  ts: ["typescript"],
  ml: ["machine learning"],
  ux: ["user experience"],
  ui: ["user interface", "interface"],
  qa: ["quality assurance", "testing"],
  ci: ["continuous integration"],
  cd: ["continuous delivery", "continuous deployment", "deploy"],
  k8s: ["kubernetes"],
  db: ["database"],
  fe: ["frontend", "front-end", "front end"],
};

/** Whether `answer` (its text, question and tab) names everything the
    question does. A name the question writes as two words is the answer's
    one: "Svelte Kit" for "SvelteKit". */
export function covers(answer: AnswerWords, question: string, owner: string): boolean {
  const named = namesIn(question, owner);
  if (!named.length) return true;
  const answerText = everythingSaid(answer);
  const answerWords = [...wordsIn(answerText)];
  const answerTextLowered = answerText.toLowerCase();
  const isNamed = (name: Named) => answerWords.some((answerWord) => namesSameThing(name, answerWord));
  return named.every((name, i) => {
    // The name with the one before it, and with the one after.
    const [before, after] = [named[i - 1], named[i + 1]];
    const asOneWord = [before && joined(before, name), after && joined(name, after)].filter(isNotNil);
    return (
      isNamed(name) ||
      asOneWord.some(isNamed) ||
      (SPELLED_OUT[name.term] ?? []).some((spelledOut) => answerTextLowered.includes(spelledOut))
    );
  });
}
