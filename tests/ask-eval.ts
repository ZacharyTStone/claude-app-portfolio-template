/* How well /ask picks, and what it quotes, against a deployed site or a preview:
     node tests/ask-eval.ts https://<the site or a preview> [questions.json]
   It doesn't fail on misses: what's good enough is your call. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isReplyText, type AskRequest } from "../src/shared/ask.ts";
import { isArrayOf, isRecord, isString } from "../src/shared/guards.ts";

type Question = { q: string; lang: string; expect: string | string[] };
type Verdict = "right" | "wrong" | "saidNone" | "falseAnswer" | "falseBlock" | "missedBlock";

/** What /ask said: the id picked ("none", "blocked"), why there was none,
    and the reply quoted with it; or why the run can't go on. */
export type Said = { id: string; why?: string; reply?: string } | { stop: string };

/** /ask's reply, read as the eval counts it. Past the visitor's limit, or
    the site's (or with the guard down), every later question would get the
    same, so the run stops instead of counting them as "none". */
export function readSaid(data: unknown): Said {
  if (!isRecord(data)) return { id: "none" };
  if (data.blocked === true) return { id: "blocked" };
  if (data.limited === true) return { stop: `this address has asked its ${String(data.limit)} for today` };
  if (data.why === "budget") return { stop: "the site's questions for today are used up, or AskGuard is down" };
  const why = isString(data.why) ? data.why : undefined;
  const reply = isReplyText(data.reply) ? data.reply : undefined;
  return { id: isString(data.id) ? data.id : "none", why, reply };
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

async function main(site: string, file: string): Promise<void> {
  const all = readQuestions(file);
  // The first question that's blocked blocks the address running this for
  // ASK_BLOCK_HOURS, so those go last: run it from a connection you don't
  // need /ask on for a day.
  const questions = [...all.filter((item) => !expectsBlock(item)), ...all.filter(expectsBlock)];
  // The rate limit in wrangler.jsonc allows 10 a minute from one visitor.
  const gap = Number(process.env.ASK_EVAL_GAP_MS ?? 6500);

  const idsFor = await answerIds(site);
  if (!idsFor) console.log(`Couldn't read ${site}/ask.json, so the expected ids aren't checked.\n`);
  else {
    const stale = questions.flatMap((item) =>
      expected(item)
        .filter((id) => id !== "none" && id !== "blocked" && !idsFor(item.lang).has(id))
        .map((id) => `${item.q}  →  ${id} (${item.lang})`),
    );
    if (stale.length)
      console.log(`Expected, but not on the site (tests/ask-questions.json is out of date):\n${stale.join("\n")}\n`);
  }

  const tally: Record<Verdict | "errors" | "picks" | "replies" | "asked", number> = {
    right: 0,
    wrong: 0,
    saidNone: 0,
    falseAnswer: 0,
    falseBlock: 0,
    missedBlock: 0,
    errors: 0,
    picks: 0,
    replies: 0,
    asked: 0,
  };
  let stopped = "";
  console.log(
    `Asking ${site}/ask ${questions.length} questions (about ${Math.ceil((questions.length * gap) / 60000)} minutes).\n`,
  );
  for (const [i, item] of questions.entries()) {
    if (i) await wait(gap);
    const said = await ask(site, item);
    if ("stop" in said) {
      stopped = said.stop;
      break;
    }
    const { id, why, reply } = said;
    tally.asked++;
    if (why === "off" || why === "error" || why === "busy") tally.errors++;
    // Every answer picked, and the sentences quoted with it (or none).
    if (id !== "none" && id !== "blocked") {
      tally.picks++;
      if (reply) tally.replies++;
      console.log(`${id.padEnd(24)} ${item.q}\n${"".padEnd(24)} ${reply ? `→ ${reply}` : "no quote"}`);
    }
    const expects = expected(item);
    const verdict = verdictOf(expects, id);
    tally[verdict]++;
    if (verdict !== "right") {
      const label = LABELS[verdict];
      console.log(
        `${label.padEnd(24)} ${item.q}  →  ${id}${why ? ` (${why})` : ""}  (expected ${expects.join(" or ")})`,
      );
    }
  }
  const pct = (n: number) => `${Math.round((n / Math.max(tally.asked, 1)) * 100)}%`;
  console.log(`
${stopped ? `STOPPED after ${tally.asked} of ${questions.length}: ${stopped}.\n` : ""}Right:                    ${tally.right} (${pct(tally.right)})
Wrong answer:             ${tally.wrong}   the visitor sees an answer to something else
Said none:                ${tally.saidNone}   they get "Something else" though an answer exists
Answered, expected none:  ${tally.falseAnswer}
Blocked a real question:  ${tally.falseBlock}   (and locked this address out, so later ones read "blocked")
Not blocked:              ${tally.missedBlock}   rude or a jailbreak, but answered or none
With a quote:             ${tally.replies} of ${tally.picks} picks   (the rest show the answer on its own)
${tally.errors ? `Off, failed or rate limited: ${tally.errors} (counted as none above)` : ""}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const site = (process.argv[2] ?? "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(site)) {
    console.error("Usage: node tests/ask-eval.ts https://your-site [questions.json]");
    process.exit(2);
  }
  await main(site, process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), "ask-questions.json"));
}
