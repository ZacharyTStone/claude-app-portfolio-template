/* The lines of an answer the picker may choose by number, and what a line
   needs to be read on its own. Each table is a rule. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_REPLY_LENGTH, labelled } from "../../src/contracts/ask.ts";
import { neededFor, numbered, pointsBack, withNumbers } from "../../src/worker/ask/lines.ts";
import { EN } from "./fixtures.ts";
import { eachRow } from "./rows.ts";

test("all an answer says is numbered: sentences, a list's items, a card's rows, figures", () => {
  const text = [
    "role: Sr. Engineer",
    "He joined in 2024. He has two degrees:",
    "BS in Music, 2016",
    "The stack:",
    "How it ships: Draft → Review → Publish",
    "Email is best: alex@example.com",
  ].join("\n");
  assert.deepEqual(
    numbered(text).map(({ text, n }) => [n, text]),
    [
      [1, "role: Sr. Engineer"],
      [2, "He joined in 2024."],
      [undefined, "He has two degrees:"],
      [3, "BS in Music, 2016"],
      [undefined, "The stack:"],
      [4, "How it ships: Draft → Review → Publish"],
      [5, "Email is best: alex@example.com"],
    ],
  );
});

test("a line that leads into the next has no number, whichever colon it ends with", () => {
  assert.deepEqual(
    numbered("学歴：\n音楽学士、2016年\n東京在住です。").map(({ n }) => n),
    [undefined, 1, 2],
  );
  assert.deepEqual(
    numbered("Degrees:\nBS in Music, 2016\nHe lives in Tokyo.").map(({ n }) => n),
    [undefined, 1, 2],
  );
});

test("nor has a label, a line too long for a reply, or an answer that says one thing", () => {
  const long = `Long${" word".repeat(MAX_REPLY_LENGTH / 5)}.`;
  const text = `${labelled("picture", "The app.")}\nHe built it:\n${long} The app works.\n${labelled("link", "Resume")}`;
  assert.deepEqual(
    numbered(text).map(({ n }) => n),
    [undefined, undefined, undefined, 1, undefined],
  );
  assert.deepEqual(numbered("Ramen."), [{ text: "Ramen.", sentence: true }]);
  assert.equal(withNumbers("Ramen."), "Ramen.");
  // One sentence and a picture is still one thing said.
  assert.equal(withNumbers(`Ramen.\n${labelled("picture", "A bowl")}`), "Ramen. (picture: A bowl)");
  // Two things said are two lines to choose from.
  assert.equal(withNumbers("Ramen. Sushi."), "[1] Ramen. [2] Sushi.");
});

test("the model reads each numbered line after its number", () => {
  const acme = EN.find((answer) => answer.id === "acme.1");
  assert.ok(acme);
  assert.equal(
    withNumbers(acme.text),
    "[1] Alex has been at Acme since 2024. [2] Alex moved the web app to server-rendered pages, which cut the time to first load by 40%. [3] Time to load: Before 1.04 s, After 385 ms",
  );
});

const pointBack = (says: string, openings: readonly string[]) =>
  eachRow(
    says,
    openings,
    (text) => text,
    (text) => assert.ok(pointsBack({ text, sentence: true })),
  );

const standAlone = (says: string, openings: readonly string[]) =>
  eachRow(
    says,
    openings,
    (text) => text,
    (text) => assert.ok(!pointsBack({ text, sentence: true })),
  );

pointBack("a sentence that opens with it or a demonstrative points back at the one before it", [
  "It’s a full-stack role.",
  "It shipped with no downtime.",
  "it shipped with no downtime.",
  "Its tests run on every pull request.",
  "This cut the load time in half.",
  "That workflow saved a week.",
  "These run every night.",
  "Those include a notes app.",
  "This pager works.",
  "These daysies bloom.",
  "Those whose work it is say so.",
]);

standAlone("but not the owner, a word all in capitals, the site itself, these days, or those who", [
  "He works remotely.",
  "She works remotely.",
  "They work remotely.",
  "Their stack is TypeScript.",
  "Alex works remotely.",
  "Italy is where Alex studied.",
  "Itself a tool, it works.",
  "IT support was Alex’s first job.",
  "ITS tests run.",
  "This site is built with Astro.",
  "This page lists them.",
  "This portfolio is his.",
  "These days Alex is in New York.",
  "Those who work with Alex say so.",
  "The widget became a core feature.",
]);

/** The prepositions a sentence may open with before it points back. */
const PREPOSITIONS =
  "about across after alongside among at before besides beyond by despite during for from in into like of on " +
  "onto over since through to under unlike until with within without";

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

pointBack(
  "so does one that opens with a preposition and what it points at, with a capital or without",
  PREPOSITIONS.split(" ").flatMap((preposition) => [
    `${capitalised(preposition)} that, Alex moved on.`,
    `${preposition} that, Alex moved on.`,
  ]),
);

pointBack("whatever it points at: this, that, these, those, it, them, then, there", [
  "With this, Alex shipped weekly.",
  "With that workflow, Alex shipped weekly.",
  "With these, Alex shipped weekly.",
  "With those, Alex shipped weekly.",
  "With it, Alex shipped weekly.",
  "With them, Alex shipped weekly.",
  "Since then Alex has worked remotely.",
  "From there, Alex moved on.",
  "After that, Alex moved to Kobe.",
]);

standAlone("but not a preposition before anything else, or all in capitals, or before the site itself", [
  "In IT, Alex started on a help desk.",
  "In 2024 Alex joined Acme.",
  "For one team, Alex replayed seven weeks of history.",
  "With Alex, it shipped.",
  "IN that case, yes.",
  "On this site, every answer is Alex’s own.",
  "On this page, more.",
  "In this portfolio, more.",
]);

pointBack("and one that opens with a word or a phrase that carries on", [
  "And it worked.",
  "But it worked.",
  "Also, Alex wrote the docs.",
  "Then Acme hired Alex directly.",
  "Instead, Alex rewrote it.",
  "Both are live.",
  "However, it shipped.",
  "Meanwhile, Alex wrote the docs.",
  "Otherwise it fails.",
  "So it shipped.",
  "So farther it went.",
  "For example, the notes app.",
  "For instance, the notes app.",
  "In addition, Alex wrote the docs.",
  "As a result, it shipped.",
]);

standAlone("but not a word that only starts like one, or so far", [
  "Butter is good.",
  "Andy built it.",
  "Thenceforth it ran.",
  "So far Alex has shipped three apps.",
  "As a rule, it works.",
  "Sony was a client.",
]);

pointBack("in Japanese: これ, それ, この, その and the words that carry on", [
  "これにより表示が速くなりました。",
  "これで完成です。",
  "それ以外の言語にも対応しています。",
  "それで作りました。",
  "このウィジェットは中核機能になりました。",
  "その後、同社に直接雇用されました。",
  "そのサイトは速いです。",
  "こうして公開しました。",
  "こうした機能があります。",
  "そこで作りました。",
  "また、ドキュメントも書きました。",
  "さらに改善しました。",
  "そして公開しました。",
  "しかし問題がありました。",
  "ただし例外があります。",
  "なお、対応済みです。",
  "同時に進めました。",
  "同様に進めました。",
  "同じく進めました。",
  "同社で働きました。",
  "加えて改善しました。",
  "あわせて公開しました。",
  "たとえば、メモアプリです。",
  "例えば、メモアプリです。",
  "つまり速いです。",
]);

standAlone("but not これまで, それぞれ, the site itself, or また and なお without their comma", [
  "これまでに3つのアプリを公開しました。",
  "それぞれの言語にページがあります。",
  "このサイトはAstroで作られています。",
  "このページは速いです。",
  "このポートフォリオは速いです。",
  "東京に住んでいます。",
  "また弾き始めたいと思っています。",
  "なお続けています。",
]);

pointBack("what comes before a sentence's first word doesn't hide it: an emoji, a dash, a bullet", [
  "🚀 It shipped in May.",
  "— It shipped.",
  "* It shipped.",
]);

standAlone("but a quote mark, a bracket or a number does: someone's words quoted are theirs, as they are", [
  "“It works great.” (A coworker)",
  '"It works."',
  "'It works.'",
  "‘It works.’",
  "「これは動く。」",
  "『これは動く。』",
  "(It works.)",
  "（これは動く。）",
  "[It works.]",
  "1. It shipped.",
]);

test("one that points back at no sentence has no number: at a heading, a list, a card, or its own question", () => {
  const unnumbered = (text: string, line: string) =>
    assert.equal(numbered(text).find((piece) => piece.text === line)?.n, undefined, `${line} in ${text}`);
  unnumbered("It’s a notes app. Alex built it in 2024.", "It’s a notes app.");
  unnumbered("The migration:\nIt shipped with no downtime.\nAlex led it.", "It shipped with no downtime.");
  unnumbered("role: Engineer\nIt’s a full-stack role.\nAlex is on call.", "It’s a full-stack role.");
  unnumbered("Alex has two:\nBS in Music, 2016\nThat was in Boston.", "That was in Boston.");
  // Nor one that needs it in turn; the next that doesn't is numbered as ever.
  assert.deepEqual(
    numbered("It’s a notes app. It works offline. Alex built it in 2024. Alex still runs it.").map(({ n }) => n),
    [undefined, undefined, 1, 2],
  );
  assert.equal(
    withNumbers("It’s a notes app. Alex built it in 2024. Alex still runs it."),
    "It’s a notes app. [1] Alex built it in 2024. [2] Alex still runs it.",
  );
});

test("nor one too long for a reply with the sentence it needs", () => {
  const long = `Long${" word".repeat(Math.ceil(MAX_REPLY_LENGTH / 5) - 5)}.`;
  assert.ok(long.length <= MAX_REPLY_LENGTH, "the sentence before it fits a reply on its own");
  assert.deepEqual(
    numbered(`${long} It shipped with no downtime. Alex led it.`).map(({ n }) => n),
    [1, undefined, 2],
  );
});

test("what a line needs is itself and, while one points back, the sentence before: a label between them aside", () => {
  const pieces = numbered(
    `Alex built ten tools.\n${labelled("picture", "The tools.")}\nThose include a notes app. It works offline.\nAlex is in New York.`,
  );
  assert.deepEqual(neededFor(pieces, 0), [0]);
  assert.deepEqual(neededFor(pieces, 2), [0, 2]);
  assert.deepEqual(neededFor(pieces, 3), [0, 2, 3]);
  assert.deepEqual(neededFor(pieces, 4), [4]);
  // A row is no sentence to point back at.
  assert.equal(neededFor(numbered("role: Engineer\nIt’s a full-stack role."), 1), null);
});
