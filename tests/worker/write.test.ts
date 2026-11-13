/* The reply written for a typed question (src/worker/ask/write.ts): from
   the lines picked, its names and numbers checked against them, asked for
   twice at most, and the lines quoted when none passes. A reply that was
   written is sent with the lines it was written from (`cited`). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateJsonTokens } from "../../src/worker/ask/cost.ts";
import { DEFAULT_MODEL, reasoningOptionsOf } from "../../src/worker/ask/known-models.ts";
import { write, writesIn, type Writing } from "../../src/worker/ask/write.ts";
import { MAX_CITED_LENGTH, MAX_CITED_LINES, isCitedLines, labelled } from "../../src/contracts/ask.ts";
import { MAX_WRITE_TOKENS, MAX_WRITTEN_LENGTH, NONE, MAX_WRITE_TRIES } from "../../src/worker/constants.ts";
import { INDEX, EN, askJson, captureLogs, lines, models, stubs, toolCall, using, writer, wrote } from "./fixtures.ts";

const logs = captureLogs();

const WRITING: Writing = {
  question: "Does Alex know Svelte?",
  lang: "en",
  lines: "frontend: React, Next.js, Svelte / SvelteKit, Tailwind CSS",
  title: "Skills",
  q: "what’s alex’s stack?",
  name: "Alex Example",
  role: "a software engineer",
  owner: "Alex Example",
};

test("a reply written from the lines is the reply: the model has the lines, and the question as the visitor's", async () => {
  const { ai, sent } = writer(wrote("Yes, Alex knows Svelte and SvelteKit.", [300, 12]));
  assert.deepEqual(await write(ai, DEFAULT_MODEL, WRITING), {
    outcome: "sent",
    reply: "Yes, Alex knows Svelte and SvelteKit.",
    tries: 1,
    tokens: { input: 300, output: 12 },
  });
  const [system, user, ...more] = sent[0]?.messages ?? [];
  assert.deepEqual(more, []);
  assert.equal(system?.role, "system");
  for (const told of [WRITING.lines, `"${WRITING.title}"`, WRITING.q, WRITING.name, WRITING.role, "English", NONE]) {
    assert.ok(system?.content.includes(told), `it's told: ${told}`);
  }
  // To answer as it was asked, in a sentence or two, from the lines alone.
  for (const told of ["conversationally", "one or two short sentences", '"Yes" or "No"', "add no fact"]) {
    assert.ok(system?.content.includes(told), `it's told: ${told}`);
  }
  assert.ok(!system?.content.includes(WRITING.question), "the question is no part of its instructions");
  assert.deepEqual(user, { role: "user", content: WRITING.question });
  assert.equal(sent[0]?.temperature, 0);
  assert.equal(sent[0]?.max_completion_tokens, MAX_WRITE_TOKENS);
  assert.deepEqual(sent[0]?.chat_template_kwargs, reasoningOptionsOf(DEFAULT_MODEL).chat_template_kwargs);
});

test("a Japanese page's reply is asked for in Japanese; a language the check can't read, not at all", async () => {
  const { ai, sent } = writer(wrote("はい、Svelteを使っています。"));
  const writing = { ...WRITING, lang: "ja", question: "Svelteは使えますか？" };
  assert.equal((await write(ai, DEFAULT_MODEL, writing)).reply, "はい、Svelteを使っています。");
  assert.ok(sent[0]?.messages[0]?.content.includes("Japanese"));
  assert.ok(sent[0]?.messages[0]?.content.includes("「はい」 or 「いいえ」"));
  // And checked as Japanese is: a word in Latin letters is a name, with a capital or without.
  const unsourced = await write(writer(wrote("はい、svelteとvueを使っています。")).ai, DEFAULT_MODEL, writing);
  assert.deepEqual([unsourced.why, unsourced.unsourced], ["words", ["vue"]]);
  assert.ok(writesIn("en") && writesIn("ja"));
  for (const lang of ["fr", "de", "", "toString"]) assert.ok(!writesIn(lang), lang);
});

test("a reply with a name or a number the lines don't have is asked for again, with what it was; the second is checked the same", async () => {
  const { ai, sent } = writer(
    wrote("Yes, Alex has known Svelte and Vue for 5 years.", [300, 10]),
    wrote("Yes, Alex knows Svelte.", [340, 8]),
  );
  assert.deepEqual(await write(ai, DEFAULT_MODEL, WRITING), {
    outcome: "sent",
    reply: "Yes, Alex knows Svelte.",
    tries: 2,
    tokens: { input: 640, output: 18 },
  });
  const [, , first, again] = sent[1]?.messages ?? [];
  assert.deepEqual(first, { role: "assistant", content: "Yes, Alex has known Svelte and Vue for 5 years." });
  assert.equal(again?.role, "user");
  assert.ok(again?.content.includes("Vue, 5"), again?.content);
});

test("a reply in its own words is the reply: only its names and numbers have to be the lines'", async () => {
  for (const reply of [
    "Yes, Svelte is part of Alex's frontend stack, along with SvelteKit.",
    "Yes! He's comfortable with it. It's on his list right beside React.",
  ]) {
    assert.deepEqual(
      await write(writer(wrote(reply)).ai, DEFAULT_MODEL, WRITING).then(({ reply, tries }) => [reply, tries]),
      [reply, 1],
    );
  }
});

test("one that fails every time isn't a reply: why, and the names and numbers, are kept for the log", async () => {
  const { ai, sent } = writer(wrote("Alex knows Rust."), wrote("Alex has 10 years of Vue."));
  const { reply, why, unsourced, tries } = await write(ai, DEFAULT_MODEL, WRITING);
  assert.deepEqual(
    { reply, why, unsourced, tries },
    { reply: undefined, why: "words", unsourced: ["10", "Vue"], tries: 2 },
  );
  assert.equal(sent.length, MAX_WRITE_TRIES);
});

test("the lines not answering, nothing written, or the model failing is no reply, and isn't asked again", async () => {
  for (const [said, why] of [
    [wrote(NONE), "none"],
    [wrote("None."), "none"],
    [wrote(""), "empty"],
    [wrote("   "), "empty"],
    [{}, "empty"],
    [{ response: 42 }, "empty"],
    [new Error("3040: capacity"), "error"],
  ] as const) {
    const { ai, sent } = writer(said);
    const written = await write(ai, DEFAULT_MODEL, WRITING);
    assert.deepEqual([written.reply, written.why, sent.length], [undefined, why, 1], JSON.stringify(said));
  }
});

test("too long, or on more than one line, is asked for again, shorter", async () => {
  const long = `Alex knows ${"React and ".repeat(MAX_WRITTEN_LENGTH / 10)}Svelte.`;
  const { ai, sent } = writer(wrote(long), wrote("Alex knows Svelte."));
  assert.equal((await write(ai, DEFAULT_MODEL, WRITING)).reply, "Alex knows Svelte.");
  assert.match(sent[1]?.messages.at(-1)?.content ?? "", /too long/);
  const twice = writer(wrote(long));
  assert.deepEqual(await write(twice.ai, DEFAULT_MODEL, WRITING).then(({ why, tries }) => [why, tries]), ["long", 2]);
});

test("one the model ran out of room to finish is cut off, however short: asked for again, shorter", async () => {
  const cutOff = { choices: [{ finish_reason: "length", message: { content: "Yes, Alex knows Svelte and" } }] };
  const whole = { choices: [{ finish_reason: "stop", message: { content: "Yes, Alex knows Svelte." } }] };
  const { ai, sent } = writer(cutOff, whole);
  assert.deepEqual(await write(ai, DEFAULT_MODEL, WRITING).then(({ reply, tries }) => [reply, tries]), [
    "Yes, Alex knows Svelte.",
    2,
  ]);
  assert.match(sent[1]?.messages.at(-1)?.content ?? "", /too long/);
  assert.deepEqual(await write(writer(cutOff).ai, DEFAULT_MODEL, WRITING).then(({ why, tries }) => [why, tries]), [
    "long",
    2,
  ]);
});

test("the quotation marks, line breaks or reasoning a model puts round a reply are taken off", async () => {
  for (const said of [
    { response: '"Alex knows Svelte."' },
    { response: "“Alex knows Svelte.”" },
    { response: "  Alex knows\nSvelte.  " },
    { response: "<think>The lines list Svelte.</think>\nAlex knows Svelte." },
    { choices: [{ message: { content: "Alex knows Svelte." } }] },
  ]) {
    assert.equal(
      (await write(writer(said).ai, DEFAULT_MODEL, WRITING)).reply,
      "Alex knows Svelte.",
      JSON.stringify(said),
    );
  }
});

test("past its time, there's no reply, and the call is counted as if it wrote all it may", async () => {
  const never = new Promise<unknown>(() => {});
  const { ai, sent } = writer(never);
  const written = await write(ai, DEFAULT_MODEL, WRITING, 20);
  assert.deepEqual([written.reply, written.why, written.tries], [undefined, "late", 1]);
  const { messages, temperature } = sent[0] ?? { messages: [] };
  assert.deepEqual(written.tokens, { input: estimateJsonTokens({ messages, temperature }), output: MAX_WRITE_TOKENS });
  // With no time at all it isn't asked.
  const none = writer(wrote("Alex knows Svelte."));
  assert.deepEqual(
    await write(none.ai, DEFAULT_MODEL, WRITING, 0).then(({ why, tries }) => [why, tries, none.sent.length]),
    ["late", 0, 0],
  );
});

// ---- Through /ask ---------------------------------------------------------------------

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

// ---- The lines a written reply cites ---------------------------------------------------

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

test("isCitedLines: what the page takes as the lines under a reply", () => {
  const line = "Alex has been at Acme since 2024.";
  assert.ok(isCitedLines([line]));
  assert.ok(isCitedLines(Array.from({ length: MAX_CITED_LINES }, () => line)));
  assert.ok(isCitedLines(["x".repeat(MAX_CITED_LENGTH)]));
  assert.ok(isCitedLines(["x".repeat(MAX_CITED_LENGTH / 2), "y".repeat(MAX_CITED_LENGTH / 2)]));
  for (const [why, lines] of [
    ["not a list", line],
    ["not a list", { 0: line, length: 1 }],
    ["none", []],
    ["too many", Array.from({ length: MAX_CITED_LINES + 1 }, () => line)],
    ["too long together", ["x".repeat(MAX_CITED_LENGTH / 2), "y".repeat(MAX_CITED_LENGTH / 2 + 1)]],
    ["one isn't text", [line, 7]],
    ["one isn't text", [line, null]],
    ["one is empty", [line, "  "]],
    ["one has a line break", [`${line}\n${line}`]],
    ["one has a hidden character", [`${line}\u200b`]],
    ["one is a label", [line, labelled("picture", "The home page")]],
  ] as const) {
    assert.ok(!isCitedLines(lines), why);
  }
});
