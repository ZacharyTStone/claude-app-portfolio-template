/* The reply /ask sends with a picked answer: written from the lines the
   picker chose, or those lines quoted, or none (src/worker/ask/reply.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { NONE } from "../../src/worker/ask/prompts/wording.ts";
import { MAX_CITED_LENGTH, labelled } from "../../src/contracts/ask.ts";
import { MAX_WRITE_TRIES } from "../../src/worker/ask/write.ts";
import {
  EN,
  INDEX,
  UNADDRESSED,
  UNWRITTEN,
  askJson,
  captureLogs,
  lines,
  models,
  okLeft,
  stubs,
  toolCall,
  using,
  wrote,
} from "./fixtures.ts";

const logs = captureLogs();

test("a pick with sentence numbers comes with their quote", async () => {
  const { env } = stubs({ run: models(toolCall("acme.1", [1])) });
  assert.deepEqual(await askJson(env, "Since when is Alex at Acme?"), {
    id: "acme.1",
    reply: "Alex has been at Acme since 2024.",
  });
  const ja = stubs({ run: models(toolCall("acme.1", [2])) });
  assert.deepEqual(await askJson(ja.env, "何をした？", "ja"), {
    id: "acme.1",
    reply: "Webアプリをサーバーレンダリングに移行し、初回表示までの時間を40%短縮しました。",
  });
});

test("numbers that name no line: the pick without a reply, and the log says why", async () => {
  logs.mock.resetCalls();
  const runs = [
    models(toolCall("acme.1", [1])),
    models(toolCall("acme.1", [4])),
    models(toolCall("acme.1", "1")),
    models(toolCall("acme.1", [])),
    models(toolCall("acme.1")),
    models({ response: "acme.1" }),
    models(toolCall(NONE, [1])),
  ];
  for (const run of runs) await askJson(stubs({ run }).env, "What does Alex do at Acme?");
  assert.deepEqual(lines(logs), [
    JSON.stringify({ ask: "acme.1", ...UNWRITTEN, reply: "sent" }),
    '{"ask":"acme.1","reply":"dropped","check":"range"}',
    '{"ask":"acme.1","reply":"dropped","check":"unreadable"}',
    '{"ask":"acme.1"}',
    '{"ask":"acme.1"}',
    '{"ask":"acme.1"}',
    JSON.stringify({ ask: NONE, ...UNADDRESSED }),
  ]);
});

test("with few questions left, the reply and the count come together", async () => {
  const { env } = stubs({ run: models(toolCall("acme.1", [1])), guardSays: okLeft(3) });
  assert.deepEqual(await askJson(env, "Since when?"), {
    id: "acme.1",
    reply: "Alex has been at Acme since 2024.",
    left: 3,
  });
});

test("a written reply may name the owner as the page's language does, on a site whose main language writes it another way", async () => {
  const work = [{ id: "work.1", title: "Work", q: "what's the stack?", text: "TypeScript, React and Postgres." }];
  const index = {
    name: "山田 太郎",
    names: { en: "Alex Example" },
    role: "an engineer",
    main: "ja",
    answers: { ja: work, en: work },
  };
  const { env } = stubs({ run: models(toolCall("work.1")), writes: [wrote("Yes, Alex works with React.")], index });
  assert.deepEqual(await askJson(env, "React?"), {
    id: "work.1",
    reply: "Yes, Alex works with React.",
    cited: ["TypeScript, React and Postgres."],
  });
});

const LOG_QUESTIONS = { ASK_LOG_QUESTIONS: "true" };

test("a typed question is answered in a sentence written from the lines picked", async () => {
  logs.mock.resetCalls();
  const { env, writeCalls } = stubs({
    run: models(toolCall("acme.1", [1])),
    writes: [wrote("Yes, Alex has been at Acme since 2024.")],
    vars: LOG_QUESTIONS,
  });
  const question = "Is Alex at Acme?";
  assert.deepEqual(await askJson(env, question), {
    id: "acme.1",
    reply: "Yes, Alex has been at Acme since 2024.",
    cited: ["Alex has been at Acme since 2024."],
  });
  // It was written from line 1 alone, not from all the answer says.
  const told = writeCalls[0]?.input.messages[0]?.content ?? "";
  assert.ok(told.includes("Alex has been at Acme since 2024."), told);
  assert.ok(!told.includes("server-rendered"), "the lines not picked aren't among its sources");
  assert.deepEqual(
    lines(logs).map((line) => JSON.parse(line)),
    [
      {
        ask: "acme.1",
        wrote: "sent",
        reply: "sent",
        question,
        chose: "[1]",
        said: "Yes, Alex has been at Acme since 2024.",
      },
    ],
  );
});

test("an answer that says one thing has no lines to pick: the reply is written from all of it", async () => {
  const { env, writeCalls } = stubs({
    run: models(toolCall("skills.1")),
    writes: [wrote("Yes, Alex works with React.")],
  });
  assert.deepEqual(await askJson(env, "Does Alex know React?"), {
    id: "skills.1",
    reply: "Yes, Alex works with React.",
    cited: ["TypeScript, React, Node.js and Postgres."],
  });
  assert.ok(writeCalls[0]?.input.messages[0]?.content.includes(EN.find(({ id }) => id === "skills.1")?.text ?? "?"));
});

test("a reply that fails its check twice isn't shown: the lines are quoted, and the log says what was wrong", async () => {
  logs.mock.resetCalls();
  const { env, writeCalls } = stubs({
    run: models(toolCall("acme.1", [1])),
    writes: [wrote("Alex has led 40 engineers at Globex since 2024."), wrote("Alex joined Acme in 2019.")],
    vars: LOG_QUESTIONS,
  });
  const question = "How long has Alex been there?";
  // The lines quoted are the reply itself, so nothing is cited under them.
  assert.deepEqual(await askJson(env, question), { id: "acme.1", reply: "Alex has been at Acme since 2024." });
  assert.equal(writeCalls.length, MAX_WRITE_TRIES);
  assert.deepEqual(
    lines(logs).map((line) => JSON.parse(line)),
    [
      {
        ask: "acme.1",
        wrote: "dropped",
        unwritten: "words",
        reply: "sent",
        question,
        chose: "[1]",
        unsaid: "2019",
        said: "Alex has been at Acme since 2024.",
      },
    ],
  );
  // Without the questions, the log has what happened and none of the words.
  logs.mock.resetCalls();
  const quiet = stubs({ run: models(toolCall("acme.1", [1])), writes: [wrote("Alex has been at Globex.")] });
  await askJson(quiet.env, question);
  assert.deepEqual(lines(logs), ['{"ask":"acme.1","wrote":"dropped","unwritten":"words","reply":"sent"}']);
});

test("a card's row or a figure is written from, never shown as a reply: with none written, the page shows the answer", async () => {
  logs.mock.resetCalls();
  const figure = stubs({ run: models(toolCall("acme.1", [3])), writes: [wrote("It loads in 200 ms.")] });
  assert.deepEqual(await askJson(figure.env, "How fast does it load?"), { id: "acme.1" });
  assert.deepEqual(lines(logs), [
    '{"ask":"acme.1","wrote":"dropped","unwritten":"words","reply":"dropped","check":"rows"}',
  ]);
  // Written, it's the reply.
  const written = stubs({
    run: models(toolCall("acme.1", [3])),
    writes: [wrote("It loads in 385 ms, after 1.04 s before.")],
  });
  assert.deepEqual(await askJson(written.env, "How fast does it load?"), {
    id: "acme.1",
    reply: "It loads in 385 ms, after 1.04 s before.",
    cited: ["Time to load: Before 1.04 s, After 385 ms"],
  });
  // On a page no reply is written for, the line is quoted, as it always was.
  const french = stubs({
    run: models(toolCall("acme.1", [3])),
    index: { ...INDEX, main: "fr", answers: { fr: EN } },
  });
  assert.deepEqual(await askJson(french.env, "Vite ?", "fr"), {
    id: "acme.1",
    reply: "Time to load: Before 1.04 s, After 385 ms",
  });
});

test("no reply is written when there's nothing to write from, or no one to write for", async () => {
  const cases: [string, Parameters<typeof stubs>[0], string?][] = [
    ["no answer was picked", { run: models(toolCall(NONE)) }],
    ["the question was turned away", { run: models(toolCall("about.1"), { response: "unsafe\nS10" }) }],
    ["the answer doesn't name what was asked", { run: models(toolCall("skills.1")) }, "Does Alex use Vercel?"],
    ["no lines were picked from an answer that has them", { run: models(toolCall("acme.1", [])) }],
    ["the lines picked aren't there", { run: models(toolCall("acme.1", [9])) }],
    ["the page's language isn't one the check reads", { index: { ...INDEX, main: "fr", answers: { fr: EN } } }],
  ];
  for (const [why, options, question = "What does Alex do?"] of cases) {
    const { env, writeCalls } = stubs({ ...options, writes: [wrote("Alex is a senior software engineer.")] });
    await askJson(env, question, options?.index ? "fr" : "en");
    assert.equal(writeCalls.length, 0, why);
  }
});

test("what the writing used is on the question's bill with the rest", async () => {
  const { env, guard } = stubs({
    run: models(using(toolCall("skills.1"), 0, 0), using({ response: "safe" }, 0, 0)),
    writes: [wrote("Alex works with React and Vue.", [1_000_000, 0]), wrote("Alex works with React.", [0, 1_000_000])],
    vars: { ASK_MODEL_PRICE: "3/4" },
  });
  assert.deepEqual(await askJson(env, "React?"), {
    id: "skills.1",
    reply: "Alex works with React.",
    cited: ["TypeScript, React, Node.js and Postgres."],
  });
  const spent = guard.requests.find((url) => url.pathname.endsWith("spend"))?.searchParams.get("neurons");
  assert.equal(Number(spent), 7);
});

// A site with one answer, whose text is `text`.
const siteSaying = (text: string) => ({
  ...INDEX,
  answers: { en: [{ id: "work.1", title: "Work", q: "what does alex do?", text }] },
});

test("a written reply cites the lines it was written from, as the site has them and in its order", async () => {
  const text = [
    "Alex rebuilt the checkout at Acme.",
    "It shipped with no downtime.",
    labelled("picture", "The checkout, before and after"),
    "team: 4 engineers",
    "Alex also runs the on-call rota.",
  ].join("\n");
  const cited = async (lineNumbers: number[]) => {
    const { env } = stubs({
      run: models(toolCall("work.1", lineNumbers)),
      writes: [wrote("Yes, Alex did that.")],
      index: siteSaying(text),
    });
    return ((await askJson(env, "Did Alex do that?")) as { cited?: string[] }).cited;
  };
  // The line picked; two, in the answer's order whatever order they were picked in.
  assert.deepEqual(await cited([1]), ["Alex rebuilt the checkout at Acme."]);
  assert.deepEqual(await cited([3, 1]), ["Alex rebuilt the checkout at Acme.", "team: 4 engineers"]);
  // One that can't be read without the sentence before it comes with it, once.
  assert.deepEqual(await cited([2]), ["Alex rebuilt the checkout at Acme.", "It shipped with no downtime."]);
  assert.deepEqual(await cited([2, 1]), ["Alex rebuilt the checkout at Acme.", "It shipped with no downtime."]);
  // A label has no number to be picked by, so it's never one of them.
  assert.deepEqual(await cited([4]), ["Alex also runs the on-call rota."]);
});

test("a reply that only repeats its lines cites nothing: they'd be shown twice", async () => {
  const { env } = stubs({
    run: models(toolCall("acme.1", [1])),
    writes: [wrote("Alex has been  at Acme since 2024.")],
  });
  assert.deepEqual(await askJson(env, "Since when?"), { id: "acme.1", reply: "Alex has been at Acme since 2024." });
});

test("lines too long to show under a reply aren't cited at all, never cut: the reply goes without", async () => {
  const long = `Alex works with ${"React and ".repeat(MAX_CITED_LENGTH / 10)}Svelte`;
  assert.ok(long.length > MAX_CITED_LENGTH);
  const { env } = stubs({
    run: models(toolCall("work.1")),
    writes: [wrote("Yes, Alex works with React and Svelte.")],
    index: siteSaying(long),
  });
  assert.deepEqual(await askJson(env, "Does Alex know React?"), {
    id: "work.1",
    reply: "Yes, Alex works with React and Svelte.",
  });
});
