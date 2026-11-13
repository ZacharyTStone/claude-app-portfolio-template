/* Every word a model is sent, held whole: for a few questions, each call
   the Worker makes (the picker's, Llama Guard's, the writer's with what it's
   told when a reply fails, and the one that says a question to the owner)
   is compared with a file in prompts/. A prompt is what Ask may say, so a
   change to one shows there as a diff to read.

   To change a prompt on purpose: change it, run
   `UPDATE_PROMPTS=1 node --test tests/worker/prompts.test.ts`, and commit
   the files with it. */
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { AskIndex } from "../../src/contracts/ask.ts";
import { SAMPLE_ANSWERS } from "../sample/ask-answers.ts";
import { LLAMA_GUARD_MODEL } from "../../src/worker/ask/known-models.ts";
import { NONE } from "../../src/worker/constants.ts";
import type { Env } from "../../src/worker/env.ts";
import { INDEX, askJson, captureLogs, models, stubs, toolCall, wrote, type Call } from "./fixtures.ts";

captureLogs();

type Scenario = {
  /** The file in prompts/ that holds what the models are sent. */
  file: string;
  /** What is being asked, and what the stand-in models say back, in words. */
  story: string;
  question: string;
  lang: string;
  /** The site's answers, if not the Worker tests' own. */
  index?: AskIndex;
  /** What the picker says. */
  picks: unknown;
  /** What the writer says, each time it's asked. */
  writes?: unknown[];
  /** What the call that says the question to the owner writes. */
  addresses?: unknown[];
};

/** The made-up site of tests/sample, which has one of every kind of block
    an answer can have. */
const SAMPLE_SITE: AskIndex = { name: "Sam Sample", role: "an engineer", main: "en", answers: { en: SAMPLE_ANSWERS } };

const TOO_LONG = `Yes, Alex has been at Acme since 2024, ${"and at Acme since 2024, ".repeat(12)}and still is.`;

const SCENARIOS: Scenario[] = [
  {
    file: "reply-en.txt",
    story:
      "An English page. The picker chooses a line; the writer's first reply has names and a number the line doesn't.",
    question: "How long has Alex been at Acme?",
    lang: "en",
    picks: toolCall("acme.1", [1]),
    writes: [wrote("Alex has led 40 engineers at Globex since 2024."), wrote("Alex has been at Acme since 2024.")],
  },
  {
    file: "reply-too-long-en.txt",
    story: "An English page. The writer's first reply is too long.",
    question: "Is Alex at Acme?",
    lang: "en",
    picks: toolCall("acme.1", [1]),
    writes: [wrote(TOO_LONG), wrote("Yes, since 2024.")],
  },
  {
    file: "reply-ja.txt",
    story: "A Japanese page. The picker chooses a line; the writer's first reply has a name the line doesn't.",
    question: "Acmeでは何をしましたか？",
    lang: "ja",
    picks: toolCall("acme.1", [2]),
    writes: [wrote("はい、Vueで初回表示を40%短縮しました。"), wrote("はい、初回表示までの時間を40%短縮しました。")],
  },
  {
    file: "to-owner-en.txt",
    story: "An English page. The picker finds no answer, so the question is said to the owner.",
    question: "Has Alex worked with Vue?",
    lang: "en",
    picks: toolCall(NONE),
    addresses: [wrote("Have you worked with Vue?")],
  },
  {
    file: "pick-every-block.txt",
    story:
      "The site of tests/sample, which has every kind of block: how each reaches the picker, and which lines get a number.",
    question: "What does Sam do?",
    lang: "en",
    index: SAMPLE_SITE,
    picks: toolCall("work.1", []),
  },
];

type Sent = { model: string; input: Call["input"] };

// Keeps each call to Workers AI as it was when it was made: the writer goes
// on adding to its messages, so a look afterwards would show the last call's.
function recordingCalls(env: Env): Sent[] {
  const sent: Sent[] = [];
  const ai = env.AI as unknown as { run: (model: string, input: Call["input"]) => Promise<unknown> };
  const run = ai.run;
  ai.run = (model, input) => {
    sent.push({ model, input: structuredClone(input) });
    return run(model, input);
  };
  return sent;
}

// One call as text: the model, each option it was called with (by name, in
// the alphabet's order), each message, and the tools it may call.
function callAsText(title: string, { model, input }: Sent): string {
  const { messages, tools, ...options } = input;
  const optionLines = Object.keys(options)
    .sort()
    .map((name) => `${name}: ${JSON.stringify(options[name])}`);
  return [
    `==== ${title}: ${model}`,
    ...optionLines,
    ...messages.flatMap(({ role, content }) => [`---- ${role}`, content]),
    ...(tools ? ["---- tools", JSON.stringify(tools, null, 2)] : []),
  ].join("\n");
}

// Everything the models are sent for one question: the picker (the call
// with a tool), Llama Guard, then each call for a line of text in the
// order it was made.
async function sentFor({ story, question, lang, index = INDEX, picks, writes, addresses }: Scenario): Promise<string> {
  const { env } = stubs({ run: models(picks), writes, addresses, index });
  const sent = recordingCalls(env);
  await askJson(env, question, lang);
  const isLlamaGuard = ({ model }: Sent) => model === LLAMA_GUARD_MODEL;
  const isPicker = (call: Sent) => !isLlamaGuard(call) && call.input.tools !== undefined;
  const textCalls = sent.filter((call) => !isLlamaGuard(call) && !isPicker(call));
  const forText = addresses ? "the question, said to the owner" : "the writer";
  const calls = [
    ...sent.filter(isPicker).map((call) => callAsText("the picker", call)),
    ...sent.filter(isLlamaGuard).map((call) => callAsText("Llama Guard", call)),
    ...textCalls.map((call, i) => callAsText(`${forText}, call ${i + 1}`, call)),
  ];
  return `${story}\n\n${calls.join("\n\n")}\n`;
}

const isUpdating = process.env.UPDATE_PROMPTS === "1";

for (const scenario of SCENARIOS) {
  test(`what the models are sent is what prompts/${scenario.file} says`, async () => {
    const path = join(import.meta.dirname, "prompts", scenario.file);
    const sent = await sentFor(scenario);
    if (isUpdating) writeFileSync(path, sent);
    assert.ok(existsSync(path), `${path} is missing: run with UPDATE_PROMPTS=1`);
    assert.equal(sent, readFileSync(path, "utf8"));
  });
}
