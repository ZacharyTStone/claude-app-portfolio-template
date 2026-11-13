/* How well /ask picks, and what it replies, against a deployed site or a preview:
     node tests/ask-eval.ts https://<the site or a preview> [questions.json]
   It doesn't fail on misses: what's good enough is your call. A reply the
   model wrote is printed with the lines it was written from, to read one
   against the other: the Worker checks its names and numbers, not whether
   its other words say what the lines do. A question with no answer is
   printed as /ask said it to the owner, when it did. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isCitedLines, isQuestionToOwner, isReplyText, type AskRequest } from "../src/contracts/ask.ts";
import { isArrayOf, isRecord, isString } from "../src/contracts/guards.ts";

type Question = { q: string; lang: string; expect: string | string[] };
type Verdict = "right" | "wrong" | "saidNone" | "falseAnswer" | "falseBlock" | "missedBlock";

/** What /ask said: the id picked ("none", "blocked"), why there was none,
    the reply sent with it and, when that reply was written (not quoted),
    the lines it was written from; with no pick, the question as it's said
    to the owner, if /ask sent that; or why the run can't go on. */
export type Said = { id: string; why?: string; reply?: string; cited?: string[]; toOwner?: string } | { stop: string };

type Answered = Exclude<Said, { stop: string }>;

// Past the visitor's limit, or the site's (or with the guard down), every
// later question would get the same.
function whyTheRunStops(data: Record<string, unknown>): string | undefined {
  if (data.limited === true) return `this address has asked its ${String(data.limit)} for today`;
  if (data.why === "budget") return "the site's questions for today are used up, or AskGuard is down";
  return undefined;
}

function pickSaid(data: Record<string, unknown>): Answered {
  const id = isString(data.id) ? data.id : undefined;
  const reply = isReplyText(data.reply) ? data.reply : undefined;
  return {
    id: id ?? "none",
    why: isString(data.why) ? data.why : undefined,
    reply,
    // As the page reads it: the lines a reply cites only ever come with one.
    cited: reply !== undefined && isCitedLines(data.cited) ? data.cited : undefined,
    // And the question as it's said to the owner only ever without an answer.
    toOwner: id === undefined && isQuestionToOwner(data.toOwner) ? data.toOwner : undefined,
  };
}

/** /ask's reply, read as the eval counts it. Where every later question
    would get the same reply, the run stops instead of counting them as
    "none". */
export function readSaid(data: unknown): Said {
  if (!isRecord(data)) return { id: "none" };
  if (data.blocked === true) return { id: "blocked" };
  const stop = whyTheRunStops(data);
  return stop === undefined ? pickSaid(data) : { stop };
}

const expected = (item: Question) => [item.expect].flat();
const expectsBlock = (item: Question) => expected(item).includes("blocked");
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

// The site's question list: [{ q, lang, expect }], where expect is an
// answer id, a list of ids any of which is right, "none" or "blocked".
function readQuestions(file: string): Question[] {
  const list: unknown = JSON.parse(readFileSync(file, "utf8"));
  const isQuestion = (item: unknown): item is Question =>
    isRecord(item) &&
    isString(item.q) &&
    isString(item.lang) &&
    (isString(item.expect) || isArrayOf(item.expect, isString));
  if (!Array.isArray(list) || !list.every(isQuestion))
    throw new Error(`${String(file)}: not a list of { q, lang, expect }`);
  return list;
}

// The ids of the answers /ask offers for a language: its own, or the
// site's main language's (as the Worker does), from the site's ask.json.
async function answerIds(site: string): Promise<((lang: string) => Set<unknown>) | undefined> {
  const index: unknown = await fetch(`${site}/ask.json`)
    .then((response) => response.json())
    .catch(() => undefined);
  if (!isRecord(index) || !isRecord(index.answers) || typeof index.main !== "string") return undefined;
  const { answers, main } = index;
  return (lang) => {
    const list = Object.hasOwn(answers, lang) ? answers[lang] : answers[main];
    return new Set(
      Array.isArray(list) ? list.map((answer: unknown) => (isRecord(answer) ? answer.id : undefined)) : [],
    );
  };
}

async function ask(site: string, { q, lang }: Question): Promise<Said> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${site}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, lang } satisfies AskRequest),
    });
    // Over the minute's limit: wait it out, once.
    if (response.status === 429) {
      await wait(60000);
      continue;
    }
    return readSaid(await response.json().catch(() => ({})));
  }
  return { id: "none", why: "busy" };
}

const verdictOf = (expects: string[], id: string): Verdict => {
  if (expects.includes(id)) return "right";
  if (id === "blocked") return "falseBlock";
  if (expects.includes("blocked")) return "missedBlock";
  if (id === "none") return "saidNone";
  return expects.includes("none") ? "falseAnswer" : "wrong";
};

const LABELS: Record<Exclude<Verdict, "right">, string> = {
  wrong: "WRONG ANSWER",
  falseBlock: "BLOCKED A REAL QUESTION",
  missedBlock: "not blocked",
  saidNone: "said none",
  falseAnswer: "answered, expected none",
};

type Tally = Record<Verdict | "errors" | "picks" | "replies" | "written" | "toOwner" | "asked", number>;

const emptyTally = (): Tally => ({
  right: 0,
  wrong: 0,
  saidNone: 0,
  falseAnswer: 0,
  falseBlock: 0,
  missedBlock: 0,
  errors: 0,
  picks: 0,
  replies: 0,
  written: 0,
  toOwner: 0,
  asked: 0,
});

const COLUMN = 24;
const INDENT = "".padEnd(COLUMN);

// The expected ids that aren't on the site: tests/ask-questions.json is out
// of date.
async function printStaleExpectations(site: string, questions: Question[]): Promise<void> {
  const idsFor = await answerIds(site);
  if (!idsFor) return console.log(`Couldn't read ${site}/ask.json, so the expected ids aren't checked.\n`);
  const stale = questions.flatMap((item) =>
    expected(item)
      .filter((id) => id !== "none" && id !== "blocked" && !idsFor(item.lang).has(id))
      .map((id) => `${item.q}  →  ${id} (${item.lang})`),
  );
  if (stale.length)
    console.log(`Expected, but not on the site (tests/ask-questions.json is out of date):\n${stale.join("\n")}\n`);
}

// An answer picked, and the reply sent with it (or none): one the model
// wrote, with the lines it was written from under it to read it against,
// or the lines themselves, quoted.
function countPick(tally: Tally, item: Question, { id, reply, cited }: Answered): void {
  tally.picks++;
  if (reply) tally.replies++;
  if (cited) tally.written++;
  const replied = reply ? `→ ${reply}${cited ? "" : "  (quoted)"}` : "no reply";
  const from = (cited ?? []).map((line) => `\n${INDENT}   from: ${line}`).join("");
  console.log(`${id.padEnd(COLUMN)} ${item.q}\n${INDENT} ${replied}${from}`);
}

// With no answer, the question as the page's email and message have it:
// said to the owner, to read against what was asked.
function countToOwner(tally: Tally, item: Question, toOwner: string): void {
  tally.toOwner++;
  console.log(`${"to the owner".padEnd(COLUMN)} ${item.q}\n${INDENT} → ${toOwner}`);
}

function countVerdict(tally: Tally, item: Question, { id, why }: Answered): void {
  const expects = expected(item);
  const verdict = verdictOf(expects, id);
  tally[verdict]++;
  if (verdict === "right") return;
  const whyNot = why ? ` (${why})` : "";
  console.log(`${LABELS[verdict].padEnd(COLUMN)} ${item.q}  →  ${id}${whyNot}  (expected ${expects.join(" or ")})`);
}

function count(tally: Tally, item: Question, said: Answered): void {
  const { id, why, toOwner } = said;
  tally.asked++;
  if (why === "off" || why === "error" || why === "busy") tally.errors++;
  if (id !== "none" && id !== "blocked") countPick(tally, item, said);
  if (toOwner) countToOwner(tally, item, toOwner);
  countVerdict(tally, item, said);
}

function printTally(tally: Tally, total: number, stopped: string): void {
  const pct = (n: number) => `${Math.round((n / Math.max(tally.asked, 1)) * 100)}%`;
  console.log(`
${stopped ? `STOPPED after ${tally.asked} of ${total}: ${stopped}.\n` : ""}Right:                    ${tally.right} (${pct(tally.right)})
Wrong answer:             ${tally.wrong}   the visitor sees an answer to something else
Said none:                ${tally.saidNone}   they get "Something else" though an answer exists
Answered, expected none:  ${tally.falseAnswer}
Blocked a real question:  ${tally.falseBlock}   (and locked this address out, so later ones read "blocked")
Not blocked:              ${tally.missedBlock}   rude or a jailbreak, but answered or none
With a reply:             ${tally.replies} of ${tally.picks} picks   (${tally.written} written, ${tally.replies - tally.written} quoted; the rest show the answer on its own)
Said to the owner:        ${tally.toOwner}   with no answer, the question in the message as "Do you…?"; the rest go in as typed
${tally.errors ? `Off, failed or rate limited: ${tally.errors} (counted as none above)` : ""}`);
}

async function main(site: string, file: string): Promise<void> {
  const all = readQuestions(file);
  // The first question that's blocked blocks the address running this for
  // ASK_BLOCK_HOURS, so those go last: run it from a connection you don't
  // need /ask on for a day.
  const questions = [...all.filter((item) => !expectsBlock(item)), ...all.filter(expectsBlock)];
  // The rate limit in wrangler.jsonc allows 10 a minute from one visitor.
  const gap = Number(process.env.ASK_EVAL_GAP_MS ?? 6500);
  await printStaleExpectations(site, questions);

  const tally = emptyTally();
  let stopped = "";
  const minutes = Math.ceil((questions.length * gap) / 60000);
  console.log(`Asking ${site}/ask ${questions.length} questions (about ${minutes} minutes).\n`);
  for (const [i, item] of questions.entries()) {
    if (i) await wait(gap);
    const said = await ask(site, item);
    if ("stop" in said) {
      stopped = said.stop;
      break;
    }
    count(tally, item, said);
  }
  printTally(tally, questions.length, stopped);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const site = (process.argv[2] ?? "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(site)) {
    console.error("Usage: node tests/ask-eval.ts https://your-site [questions.json]");
    process.exit(2);
  }
  await main(site, process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), "ask-questions.json"));
}
