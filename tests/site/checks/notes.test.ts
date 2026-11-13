/* The checks' advice (src/site/checks/notes.ts): each wording, and that
   it's advice, not a problem. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { findingsIn, inEveryLanguage, sampleAfter, type Change } from "./problems.ts";

test("more topics than a card reads well with is advice, not a problem", () => {
  const withFiveTopics = inEveryLanguage((language) => {
    language.questions.topics = ["One", "Two", "Three", "Four", "Five"].map((label) => ({ label, tab: "about" }));
  });
  assert.deepEqual(findingsIn(sampleAfter(withFiveTopics)), {
    problems: [],
    notes: [
      `the question card has 5 topics. 4 or fewer read better, on a phone above all: group the rest under one topic with "ask" and "choices"`,
    ],
  });
});

/** A change that adds a thread to every language, and no way to it. */
const withAThreadNothingOpens = inEveryLanguage((language) => {
  language.threads.push({ id: "skills", title: "Skills", messages: [{ q: "what can sam do?", a: ["Plenty."] }] });
});

test("a thread nothing on the page opens is advice, in each language that has it so", () => {
  assert.deepEqual(findingsIn(sampleAfter(withAThreadNothingOpens)), {
    problems: [],
    notes: ["en", "fr"].map(
      (code) =>
        `${code}: nothing opens the thread "skills": no sidebar row, panel step, topic or link in the text points at #skills, so a visitor finds it only by its address`,
    ),
  });
});

const WAYS_TO_OPEN_A_THREAD: Array<[way: string, open: Change]> = [
  [
    "a row at the top of the sidebar",
    (_, english) => english.sidebar.nav.push({ tab: "skills", icon: "about", label: "Skills" }),
  ],
  [
    "a row in a sidebar group",
    (_, english) => english.sidebar.groups[0]?.tabs.push({ tab: "skills", title: "Skills", subtitle: "" }),
  ],
  [
    "a step of the panel's checklist",
    (_, english) => english.panel.progress?.steps.push({ tab: "skills", title: "Skills", when: "2021" }),
  ],
  [
    "a topic of the question card",
    inEveryLanguage((language) => language.questions.topics.push({ label: "Skills", tab: "skills" })),
  ],
  [
    "a topic's choice",
    inEveryLanguage((language) =>
      language.questions.topics.push({ label: "More", ask: "Which?", choices: [{ tab: "skills" }] }),
    ),
  ],
  ["the account menu's upgrade row", (_, english) => (english.account.upgrade.tab = "skills")],
  ["a link in the text", (_, english) => (english.home.intro = "See [what Sam can do](#skills).")],
];

for (const [way, open] of WAYS_TO_OPEN_A_THREAD) {
  test(`a thread that ${way} opens gets no advice in that language`, () => {
    const { problems, notes } = findingsIn(
      sampleAfter((sample, english) => {
        withAThreadNothingOpens(sample, english);
        open(sample, english);
      }),
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(
      notes.filter((note) => note.startsWith("en: nothing opens")),
      [],
    );
  });
}
