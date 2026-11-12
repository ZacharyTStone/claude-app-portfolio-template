/* Whether the answer the model picked covers what was asked: a question
   that names something specific (a tool, a company, a place: "Vercel",
   "AWS", "Google") is answered only by an answer that names it too. One
   that doesn't is not shown (handler.ts): it would read as a "no" the site
   never said. */

import type { AskAnswer } from "../../shared/ask.ts";

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

// A word as it's compared: in lower case, and without a possessive ending
// ("Alex's" as "alex").
const comparable = (word: string) => word.toLowerCase().replace(/['’]s$/, "");

// What comes before the first word of a sentence: the text's start, or a
// full stop, question or exclamation mark, then any opening quote or
// bracket. Matches `He said. "` before the Why in `He said. "Why?"`.
const SENTENCE_START = /(?:^|[.!?。？！]\s*)["'“‘(（「]*$/;

// Whether the word at `index` is the first of a sentence.
const startsSentence = (text: string, index: number) => SENTENCE_START.test(text.slice(0, index));

/** The shortest word that can name something: a single letter never does. */
const MIN_NAME_LENGTH = 2;

/** The specific things a question names: a word with a capital after its
    first letter ("AWS", "GraphQL", "iOS"), a word with letters and digits
    ("S3", "ES6"), or a capitalised word that doesn't just start a sentence
    ("Vercel" in "Does he use Vercel?"), but not the owner's name or words
    any question starts with. Lower case is read as plain words. Each comes
    back as it's compared (`comparable`). */
export function namedIn(question: string, owner: string): string[] {
  const ownerWords = new Set(
    owner
      .split(/[\s・]+/)
      .filter(Boolean)
      .map(comparable),
  );
  const text = question.normalize("NFKC");
  const named = new Set<string>();
  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    const term = comparable(word);
    if (term.length < MIN_NAME_LENGTH || ownerWords.has(term) || PLAIN_WORDS.has(term)) continue;
    const hasCapitalInside = /\p{Lu}/u.test(word.slice(1));
    const hasLettersAndDigits = /\p{L}/u.test(word) && /\p{N}/u.test(word);
    const isCapitalisedMidSentence = /^\p{Lu}/u.test(word) && !startsSentence(text, match.index);
    if (hasCapitalInside || hasLettersAndDigits || isCapitalisedMidSentence) named.add(term);
  }
  return [...named];
}

/** What of an answer may name what a question does: its text, its tab's
    name and its own question. */
type AnswerWords = Pick<AskAnswer, "text" | "title" | "q">;

// All an answer says of itself, as one text.
const everythingSaid = ({ text, title, q }: AnswerWords) => [text, title, q].join("\n").normalize("NFKC");

// The words a text has, as they're compared, and their parts ("node.js"
// also as "node" and "js").
function wordsIn(text: string): Set<string> {
  const words = new Set<string>();
  for (const [word] of text.matchAll(WORD)) {
    const whole = comparable(word);
    words.add(whole);
    for (const part of whole.split(/[.-]/)) if (part) words.add(part);
  }
  return words;
}

// The endings an answer's word may have that the question's doesn't, and
// still name the same thing: "Workers" for "Worker", "PostgreSQL" for
// "Postgres", "NextJS" for "Next". Any other ending is another thing: "Java"
// isn't "JavaScript", nor "Excel" "excellent".
const SAME_THING_ENDINGS = ["s", "es", "js", "ql", "sql"];

// A name without the dots and dashes some write in it: "nodejs" for
// "Node.js", "frontend" for "front-end".
const withoutDotsAndDashes = (word: string) => word.replace(/[.-]/g, "");

// Whether a word of the answer's names what the question's term does: the
// same word, the same without its dots and dashes, the term's singular
// ("worker" for "workers"), or the term with one of SAME_THING_ENDINGS.
const namesSameThing = (term: string, answerWord: string): boolean =>
  answerWord === term ||
  withoutDotsAndDashes(answerWord) === withoutDotsAndDashes(term) ||
  term.replace(/s$/, "") === answerWord ||
  SAME_THING_ENDINGS.some((ending) => answerWord === `${term}${ending}`);

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
    question does. A question that names nothing is covered by any answer. */
export function covers(answer: AnswerWords, question: string, owner: string): boolean {
  const namedTerms = namedIn(question, owner);
  if (!namedTerms.length) return true;
  const answerText = everythingSaid(answer);
  const answerWords = [...wordsIn(answerText)];
  const answerTextLowered = answerText.toLowerCase();
  return namedTerms.every(
    (term) =>
      answerWords.some((answerWord) => namesSameThing(term, answerWord)) ||
      (SPELLED_OUT[term] ?? []).some((spelledOut) => answerTextLowered.includes(spelledOut)),
  );
}
