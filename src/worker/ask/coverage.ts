/* Whether the answer the model picked covers what was asked: a question
   that names something specific (a tool, a company, a place: "Vercel",
   "AWS", "Google") is answered only by an answer that names it too. */

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
// and the dots, dashes, pluses and hashes inside names ("Node.js", "C#").
const WORD = /[\p{Script=Latin}\p{N}](?:[\p{Script=Latin}\p{N}+#]|[.'’-](?=[\p{Script=Latin}\p{N}]))*/gu;

const lower = (word: string) => word.toLowerCase().replace(/['’]s$/, "");

// The first word of a sentence: at the start, or after a full stop,
// question or exclamation mark (and any opening quote or bracket).
const startsSentence = (text: string, index: number) => /(?:^|[.!?。？！]\s*)["'“‘(（「]*$/.test(text.slice(0, index));

/** The specific things a question names: a word with a capital after its
    first letter ("AWS", "GraphQL", "iOS"), a word with letters and digits
    ("S3", "ES6"), or a capitalised word that doesn't just start a sentence
    ("Vercel" in "Does he use Vercel?"), but not the owner's name or words
    any question starts with. Lower case is read as plain words. */
export function namedIn(question: string, owner: string): string[] {
  const own = new Set(
    owner
      .split(/[\s・]+/)
      .filter(Boolean)
      .map(lower),
  );
  const named = new Set<string>();
  for (const match of question.normalize("NFKC").matchAll(WORD)) {
    const word = match[0];
    const key = lower(word);
    if (key.length < 2 || own.has(key) || PLAIN_WORDS.has(key)) continue;
    const capitalInside = /\p{Lu}/u.test(word.slice(1));
    const lettersAndDigits = /\p{L}/u.test(word) && /\p{N}/u.test(word);
    const capitalised = /^\p{Lu}/u.test(word) && !startsSentence(question.normalize("NFKC"), match.index);
    if (capitalInside || lettersAndDigits || capitalised) named.add(key);
  }
  return [...named];
}

type Answer = Pick<AskAnswer, "text" | "title" | "q">;

// All an answer says of itself: its text, its tab's name and its question.
const textOf = ({ text, title, q }: Answer) => [text, title, q].join("\n").normalize("NFKC");

// The words an answer has, in lower case, and their parts ("node.js" also
// as "node" and "js").
function wordsOf(text: string): Set<string> {
  const words = new Set<string>();
  for (const [word] of text.matchAll(WORD)) {
    const key = lower(word);
    words.add(key);
    for (const part of key.split(/[.-]/)) if (part) words.add(part);
  }
  return words;
}

// The endings an answer's word may have that the question's doesn't, and
// still name the same thing: "Workers" for "Worker", "PostgreSQL" for
// "Postgres", "NextJS" for "Next". Any other ending is another thing: "Java"
// isn't "JavaScript", nor "Excel" "excellent".
const SAME_THING_ENDINGS = ["s", "es", "js", "ql", "sql"];

// Whether the answer's word names what the question's term does.
const same = (term: string, word: string): boolean =>
  word === term || term.replace(/s$/, "") === word || SAME_THING_ENDINGS.some((ending) => word === `${term}${ending}`);

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
};

/** Whether `answer` (its text, question and tab) names everything the
    question does. A question that names nothing is covered by any answer. */
export function covers(answer: Answer, question: string, owner: string): boolean {
  const named = namedIn(question, owner);
  if (!named.length) return true;
  const text = textOf(answer);
  const words = [...wordsOf(text)];
  const lowered = text.toLowerCase();
  return named.every(
    (term) =>
      words.some((word) => same(term, word)) || (SPELLED_OUT[term] ?? []).some((long) => lowered.includes(long)),
  );
}
