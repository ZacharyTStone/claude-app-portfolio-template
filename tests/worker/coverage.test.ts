/* A pick has to name what the question names (src/worker/ask/coverage.ts):
   a question about something the answers don't mention gets no pick, so
   the visitor is told to ask the owner instead of reading a "no". */
import assert from "node:assert/strict";
import { test } from "node:test";
import { covers, namedIn } from "../../src/worker/ask/coverage.ts";

const OWNER = "Alex Example アレックス・イグザンプル";
const SKILLS = {
  title: "Skills",
  q: "what does alex work with?",
  text: "TypeScript, React, Node.js and PostgreSQL (Prisma), GraphQL, REST APIs.",
};

test("a question names tools, companies and places, not its own words or the owner", () => {
  assert.deepEqual(namedIn("Does Alex have expeirnce with Vercel?", OWNER), ["vercel"]);
  assert.deepEqual(namedIn("Has he used AWS or S3?", OWNER), ["aws", "s3"]);
  assert.deepEqual(namedIn("Can Alex do GraphQL?", OWNER), ["graphql"]);
  assert.deepEqual(namedIn("アレックスはVercelを使ったことがある？", OWNER), ["vercel"]);
  assert.deepEqual(namedIn("What's Alex Example's stack? Is he any good?", OWNER), []);
  assert.deepEqual(namedIn("does alex know vercel?", OWNER), [], "lower case is read as plain words");
});

test("an answer covers a name it has, in another form too", () => {
  for (const question of [
    "Does Alex know React?",
    "Does Alex know Postgres?",
    "Is he good with Node?",
    "Has he built REST API work?",
    "Can Alex do GraphQL?",
    "Does he write TS?",
  ]) {
    assert.ok(covers(SKILLS, question, OWNER), question);
  }
  assert.ok(covers({ title: "Resume", q: "can I see his resume?", text: "Here it is." }, "Can I see his CV?", OWNER));
});

test("an answer doesn't cover a name it doesn't have", () => {
  for (const question of [
    "Does Alex have experience with Vercel?",
    "Has he used AWS?",
    "Does he know Rust?",
    "Did Alex work at Google?",
  ]) {
    assert.ok(!covers(SKILLS, question, OWNER), question);
  }
});

test("a longer word isn't the same thing, but for a plural or a -JS or -QL", () => {
  const answer = (text: string) => ({ title: "Skills", q: "what does alex work with?", text });
  const different: Array<[question: string, text: string]> = [
    ["Does he know Java?", "JavaScript and TypeScript."],
    ["Did Alex work at OpenAI?", "Open to contract work."],
    ["Does he use Excel?", "An excellent communicator."],
    ["Does he know Scala?", "Scalable systems."],
    ["Has he used Salesforce?", "Sales tools."],
  ];
  for (const [question, text] of different) assert.ok(!covers(answer(text), question, OWNER), question);
  const same: Array<[question: string, text: string]> = [
    ["Does he use Cloudflare Worker?", "Cloudflare Workers."],
    ["Does he know Postgres?", "PostgreSQL."],
    ["Does he know Next?", "NextJS."],
  ];
  for (const [question, text] of same) assert.ok(covers(answer(text), question, OWNER), question);
});

test("a small s on the end may be a plural's; a capital one is the name's own", () => {
  const answer = (text: string) => ({ title: "Skills", q: "what does alex work with?", text });
  const different: Array<[question: string, text: string]> = [
    ["Does he know CSS?", "He studied CS at university."],
    ["Has he built for iOS?", "Real-time updates with Socket.io."],
    ["Does Alex's team use CSS?", "He studied CS at university."],
  ];
  for (const [question, text] of different) assert.ok(!covers(answer(text), question, OWNER), question);
  const same: Array<[question: string, text: string]> = [
    ["Has he built APIs?", "A REST API for payments."],
    ["Does he review PRs?", "Every PR gets a review."],
    ["Does he use Cloudflare Workers?", "A Cloudflare Worker."],
    ["Has he written Svelte Kits?", "SvelteKit."],
    ["Does he know CSS?", "HTML and CSS."],
    ["Has he built for iOS?", "An iOS app."],
  ];
  for (const [question, text] of same) assert.ok(covers(answer(text), question, OWNER), question);
});

test("a name is the same with or without its dots and dashes, and a short form covers what's spelled out", () => {
  const answer = (text: string) => ({ title: "Skills", q: "what does alex work with?", text });
  const covered: Array<[question: string, text: string]> = [
    ["Does he know NodeJS?", "Node.js and React."],
    ["Is he a Front-End engineer?", "A frontend engineer."],
    ["Has he used SvelteKit?", "Svelte-Kit."],
    ["Can Alex do CI/CD?", "He put strict mode behind a CI gate and co-owns the nightly deploys."],
    ["Can Alex do CI/CD?", "Continuous integration and continuous delivery, on GitHub Actions."],
    ["Has he run K8s?", "Kubernetes, on AWS."],
  ];
  for (const [question, text] of covered) assert.ok(covers(answer(text), question, OWNER), `${question} ${text}`);
  const not: Array<[question: string, text: string]> = [
    ["Can Alex do CI/CD?", "He put strict mode behind a CI gate."],
    ["Can Alex do CI/CD?", "TypeScript and React."],
    ["Does he know NodeJS?", "Nodes in a graph."],
  ];
  for (const [question, text] of not) assert.ok(!covers(answer(text), question, OWNER), `${question} ${text}`);
});

test("a name with one slip of the keyboard inside it, or written as two words, is still the answer's", () => {
  const answer = (text: string) => ({ title: "Skills", q: "what does alex work with?", text });
  const covered: Array<[question: string, text: string]> = [
    ["Does he know Svelete?", "Svelte / SvelteKit."],
    ["Does he know Svlte?", "Svelte / SvelteKit."],
    ["Does he know Sevlte?", "Svelte / SvelteKit."],
    ["Has he used Svelte Kit?", "Svelte / SvelteKit."],
    ["Has he used Svelete Kit?", "Svelte / SvelteKit."],
    ["Does he write Typscript?", "TypeScript."],
    ["Does he write Type Script?", "TypeScript."],
    ["Does he know Pyhton?", "Python."],
  ];
  for (const [question, text] of covered) assert.ok(covers(answer(text), question, OWNER), `${question} ${text}`);
  // A letter changed, a different first or last letter, or a short name:
  // that's another thing's name, not a slip.
  const not: Array<[question: string, text: string]> = [
    ["Does he know NestJS?", "Next.js."],
    ["Does he use Preact?", "React."],
    ["Does he use Prism?", "Prisma."],
    ["Has he used Vuex?", "Vue."],
    ["Has he used Rest?", "Rust."],
    ["Does he know Svelte Native?", "Svelte / SvelteKit."],
  ];
  for (const [question, text] of not) assert.ok(!covers(answer(text), question, OWNER), `${question} ${text}`);
});
