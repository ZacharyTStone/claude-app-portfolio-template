/* The reply written for a typed question (src/worker/ask/write.ts): from
   the lines picked, its names and numbers checked against them, and asked
   for twice at most. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateJsonTokens } from "../../src/worker/ask/cost.ts";
import { DEFAULT_MODEL, reasoningOptionsOf } from "../../src/worker/ask/known-models.ts";
import { NONE } from "../../src/worker/ask/prompts/wording.ts";
import { MAX_WRITE_TOKENS, MAX_WRITE_TRIES, MAX_WRITTEN_LENGTH, write, writesIn } from "../../src/worker/ask/write.ts";
import type { Writing } from "../../src/worker/ask/prompts/reply.ts";
import { MAX_CITED_LENGTH, MAX_CITED_LINES, isCitedLines, labelled } from "../../src/contracts/ask.ts";
import { writer, wrote } from "./support/models.ts";
import { eachRow } from "./rows.ts";

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
  const [call] = sent;
  assert.ok(call, "the model was called");
  const [system, user, ...more] = call.messages;
  assert.ok(system, "it has instructions");
  assert.deepEqual(more, []);
  assert.equal(system.role, "system");
  for (const told of [WRITING.lines, `"${WRITING.title}"`, WRITING.q, WRITING.name, WRITING.role, "English", NONE]) {
    assert.ok(system.content.includes(told), `it's told: ${told}`);
  }
  // To answer as it was asked, in a sentence or two, from the lines alone.
  for (const told of ["conversationally", "one or two short sentences", '"Yes" or "No"', "add no fact"]) {
    assert.ok(system.content.includes(told), `it's told: ${told}`);
  }
  assert.ok(!system.content.includes(WRITING.question), "the question is no part of its instructions");
  assert.deepEqual(user, { role: "user", content: WRITING.question });
  assert.equal(call.temperature, 0);
  assert.equal(call.max_completion_tokens, MAX_WRITE_TOKENS);
  assert.deepEqual(call.chat_template_kwargs, reasoningOptionsOf(DEFAULT_MODEL).chat_template_kwargs);
});

test("a Japanese page's reply is asked for in Japanese; a language the check can't read, not at all", async () => {
  const { ai, sent } = writer(wrote("はい、Svelteを使っています。"));
  const writing: Writing = { ...WRITING, lang: "ja", question: "Svelteは使えますか？" };
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

eachRow(
  "the quotation marks a model puts round a reply are taken off, of each kind and however many",
  [
    '"Alex knows Svelte."',
    "“Alex knows Svelte.”",
    "「Alex knows Svelte.」",
    "『Alex knows Svelte.』",
    '""Alex knows Svelte.""',
    '"Alex knows Svelte.',
    "Alex knows Svelte.”",
  ],
  (said) => said,
  async (said) =>
    assert.equal((await write(writer(wrote(said)).ai, DEFAULT_MODEL, WRITING)).reply, "Alex knows Svelte."),
);

test("marks inside a reply are the reply's own", async () => {
  const said = 'Alex knows "Svelte" well.';
  assert.equal((await write(writer(wrote(said)).ai, DEFAULT_MODEL, WRITING)).reply, said);
});

eachRow(
  "the word for no answer, alone, is no reply: in any case, with a full stop of either kind or an exclamation mark",
  ["none", "None", "NONE", "none.", "none。", "none!", "“none.”"],
  (said) => said,
  async (said) => assert.equal((await write(writer(wrote(said)).ai, DEFAULT_MODEL, WRITING)).why, "none"),
);

eachRow(
  "with anything more, it's a reply like any other",
  ["None of them.", "none?", "none, sorry"],
  (said) => said,
  async (said) => assert.equal((await write(writer(wrote(said)).ai, DEFAULT_MODEL, WRITING)).reply, said),
);

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
