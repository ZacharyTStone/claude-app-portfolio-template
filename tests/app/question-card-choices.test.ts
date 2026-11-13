/* src/app/question-card/choices.ts: the question card's choices, from the
   card's data and what the page has for each tab. */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { QuestionCard, Topic } from "../../src/config/question-card.ts";
import { cardChoices, holdsTab, type TabOnPage } from "../../src/app/question-card/choices.ts";

const WORDING = { else: "", elseLabel: "", send: "", back: "", step: "", followUp: "" };

const TABS: Record<string, TabOnPage> = {
  about: { name: "About", rowHint: "Who Sam is", firstQuestion: "who is sam?" },
  acme: { name: "Acme", rowHint: "2021 to now", firstQuestion: "what does sam do at acme?" },
  initech: { name: "Initech", rowHint: undefined, firstQuestion: "what did sam do at initech?" },
  "personal-food": { name: "favorite food?", rowHint: undefined, firstQuestion: "favorite food?" },
  "personal-music": { name: "Music", rowHint: undefined, firstQuestion: "what music?" },
};

const tabOnPage = (tabId: string): TabOnPage | null => TABS[tabId] ?? null;

const cardWith = (topics: Topic[], personal: QuestionCard["personal"] = []): QuestionCard => ({
  ask: "What would you like to know?",
  topics,
  personal,
  ui: WORDING,
});

const choicesFor = (topic: Topic, personal: QuestionCard["personal"] = []) =>
  cardChoices(cardWith([topic], personal), tabOnPage);

test("a topic with a tab opens it, under the topic's own name, with the tab's first question as its hint", () => {
  assert.deepEqual(choicesFor({ label: "About me", tab: "about" }), [
    { kind: "tab", tabId: "about", label: "About me", hint: "who is sam?" },
  ]);
});

test("a topic's own hint is the one shown", () => {
  assert.deepEqual(choicesFor({ label: "About me", hint: "In short", tab: "about" }), [
    { kind: "tab", tabId: "about", label: "About me", hint: "In short" },
  ]);
});

test("a topic with several tabs asks which: each named by its row, the topic hinting at them all", () => {
  const topic: Topic = { label: "My work", ask: "Which job?", choices: [{ tab: "acme" }, { tab: "initech" }] };
  assert.deepEqual(choicesFor(topic), [
    {
      kind: "group",
      label: "My work",
      hint: "Acme, Initech",
      question: "Which job?",
      tabChoices: [
        { kind: "tab", tabId: "acme", label: "Acme", hint: "2021 to now" },
        { kind: "tab", tabId: "initech", label: "Initech", hint: "what did sam do at initech?" },
      ],
    },
  ]);
});

test("a choice's own label and hint are the ones shown", () => {
  const topic: Topic = {
    label: "My work",
    hint: "Two jobs",
    ask: "Which job?",
    choices: [{ tab: "acme", label: "The current one", hint: "Since 2021" }, { tab: "initech" }],
  };
  const [group] = choicesFor(topic);
  assert.deepEqual(group?.kind === "group" && [group.hint, group.tabChoices[0]], [
    "Two jobs",
    { kind: "tab", tabId: "acme", label: "The current one", hint: "Since 2021" },
  ]);
});

const PERSONAL: QuestionCard["personal"] = [
  { id: "food", q: "favorite food?", a: ["Ramen."] },
  { id: "music", q: "what music?", a: ["Jazz."], hint: "On repeat" },
  { id: "secret", q: "a hidden one?", a: ["Yes."], hidden: true },
];

test("the personal topic lists the personal answers that aren't hidden, each by its question", () => {
  const topic: Topic = { label: "Something personal", ask: "Such as?", personal: true };
  const [group] = choicesFor(topic, PERSONAL);
  assert.deepEqual(group?.kind === "group" && group.tabChoices, [
    { kind: "tab", tabId: "personal-food", label: "favorite food?", hint: "favorite food?" },
    { kind: "tab", tabId: "personal-music", label: "what music?", hint: "On repeat" },
  ]);
});

test("a topic left with one tab opens it, under the topic's own name", () => {
  const topic: Topic = { label: "My work", ask: "Which job?", choices: [{ tab: "acme" }, { tab: "gone" }] };
  assert.deepEqual(choicesFor(topic), [{ kind: "tab", tabId: "acme", label: "My work", hint: "2021 to now" }]);
});

const TOPICS_WITH_NOTHING_TO_OPEN: Record<string, Topic> = {
  "a tab the page hasn't": { label: "Gone", tab: "gone" },
  "only tabs the page hasn't": { label: "Gone", ask: "Which?", choices: [{ tab: "gone" }] },
  "no personal answers to list": { label: "Something personal", ask: "Such as?", personal: true },
};

for (const [what, topic] of Object.entries(TOPICS_WITH_NOTHING_TO_OPEN)) {
  test(`a topic with ${what} isn't in the card`, () => {
    assert.deepEqual(choicesFor(topic), []);
  });
}

test("the card's choices are in the topics' order", () => {
  const card = cardWith([
    { label: "My work", ask: "Which job?", choices: [{ tab: "acme" }, { tab: "initech" }] },
    { label: "About me", tab: "about" },
  ]);
  assert.deepEqual(
    cardChoices(card, tabOnPage).map((choice) => choice.label),
    ["My work", "About me"],
  );
});

const [aboutChoice, workChoice] = cardChoices(
  cardWith([
    { label: "About me", tab: "about" },
    { label: "My work", ask: "Which job?", choices: [{ tab: "acme" }, { tab: "initech" }] },
  ]),
  tabOnPage,
);

const HOLDS: Array<[string, typeof aboutChoice, string, boolean]> = [
  ["a choice holds the tab it opens", aboutChoice, "about", true],
  ["a choice doesn't hold another tab", aboutChoice, "acme", false],
  ["a topic holds each tab it lists", workChoice, "initech", true],
  ["a topic doesn't hold a tab it doesn't list", workChoice, "about", false],
];

for (const [what, choice, tabId, holds] of HOLDS) {
  test(what, () => {
    assert.equal(choice && holdsTab(choice, tabId), holds);
  });
}
