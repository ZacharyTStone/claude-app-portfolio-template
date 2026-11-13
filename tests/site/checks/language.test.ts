/* The checks of one language (src/site/checks/language.ts): each problem's
   wording, and what's allowed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Language } from "../../../src/config/language.ts";
import { hrefsIn } from "../../../src/config/markdown.ts";
import type { Topic } from "../../../src/config/question-card.ts";
import { isSafeHref } from "../../../src/site/checks/formats.ts";
import { sampleConfig, sampleInEnglishOnly } from "../sample.ts";
import {
  inBothLanguages,
  inEveryLanguage,
  problemsAfter,
  problemsIn,
  testEachProblem,
  workAnswer,
  type Change,
} from "./problems.ts";

/** Something that would end the attribute it's written into, and start another. */
const BREAKS_OUT_OF_AN_ATTRIBUTE = `x" onclick="alert(1)`;

const NOT_A_THREAD = "points at #nowhere, which isn't a thread";
const NOT_AN_ID = "should be lowercase letters, digits and dashes";
const NOT_A_SAFE_LINK = "which should be a web, mailto, #thread or relative address";

/** A thread of one question, as a config has it. */
const threadWithId = (id: string) => ({ id, title: "Another", messages: [{ q: "a?", a: ["b."] }] });

/** A change that adds a topic to every language's question card, right or not. */
const withTopic = (topic: object): Change =>
  inEveryLanguage((language) => language.questions.topics.push(topic as Topic));

/** A change that gives every language these personal answers, by their ids. */
const withPersonalIds = (...ids: string[]): Change =>
  inEveryLanguage((language) => {
    language.questions.personal = ids.map((id) => ({ id, q: "Why?", a: ["Because."] }));
  });

testEachProblem([
  {
    wrong: "a locale written with a dash",
    change: (_, english) => (english.locale = "en-US"),
    problems: [`en: locale should look like "en_US"`],
  },
  {
    wrong: "a locale that would break out of its attribute",
    change: (_, english) => (english.locale = BREAKS_OUT_OF_AN_ATTRIBUTE),
    problems: [`en: locale should look like "en_US"`],
  },
  {
    wrong: "a font to load up front from another site",
    change: (_, english) => (english.meta.preload = ["https://fonts.example.com/inter.woff2"]),
    problems: [`en: meta.preload has "https://fonts.example.com/inter.woff2", which should be a path on this site`],
  },
  {
    wrong: "a question to start with that names no answer",
    change: inEveryLanguage((language) => (language.home.prompts = [{ q: "What does Sam do?", answer: "work.2" }])),
    problems: inBothLanguages(
      `the home prompt "What does Sam do?" gets the answer "work.2", which isn't one: a thread's nth answer is "<thread>.<n>", and a personal answer "personal-<id>.1"`,
    ),
  },
  {
    wrong: "two threads with one id",
    change: inEveryLanguage((language) => language.threads.push(threadWithId("about"))),
    problems: inBothLanguages("two threads have the same id"),
  },
  {
    wrong: "a thread id with a capital and a space",
    change: inEveryLanguage((language) => language.threads.push(threadWithId("My Work"))),
    problems: inBothLanguages(`the thread id "My Work" ${NOT_AN_ID}`),
  },
  {
    wrong: "a thread id the page would also give a tab's title",
    change: inEveryLanguage((language) => language.threads.push(threadWithId("about-title"))),
    problems: inBothLanguages(`"about-title" is used by the page itself; pick another thread id`),
  },
  {
    wrong: "a thread id one of the page's own parts has",
    change: inEveryLanguage((language) => language.threads.push(threadWithId("main"))),
    problems: inBothLanguages(`"main" is used by the page itself; pick another thread id`),
  },
  {
    wrong: "a thread id that starts as a chat's does",
    change: inEveryLanguage((language) => language.threads.push(threadWithId("chat-1"))),
    problems: inBothLanguages(`"chat-1" is used by the page itself; pick another thread id`),
  },
  {
    wrong: "a thread with no messages",
    change: inEveryLanguage((language) => language.threads.push({ id: "empty", title: "Empty", messages: [] })),
    problems: inBothLanguages(`the thread "empty" has no messages`),
  },
  {
    wrong: "a row at the top of the sidebar that opens no thread",
    change: (_, english) => (english.sidebar.nav = [{ tab: "nowhere", icon: "about", label: "About" }]),
    problems: [`en: the sidebar's "About" ${NOT_A_THREAD}`],
  },
  {
    wrong: "a sidebar row with an icon the stylesheet doesn't have",
    change: (_, english) => (english.sidebar.nav = [{ tab: "about", icon: "nope", label: "About" }]),
    problems: [`en: the sidebar's "About" has the icon "nope", but src/styles has no .i-nope`],
  },
  {
    wrong: "a sidebar row with a logo, which is only drawn on a link card or a panel row",
    change: (_, english) => (english.sidebar.nav = [{ tab: "about", icon: "github", label: "About" }]),
    problems: [`en: the sidebar's "About" has the icon "github", but src/styles has no .i-github`],
  },
  {
    wrong: "two sidebar groups with one id",
    change: (_, english) => english.sidebar.groups.push({ id: "work", label: "Again", tabs: [] }),
    problems: [`en: the sidebar's group ids should be different from each other and from "chats"`],
  },
  {
    wrong: "a sidebar group with the id of the visitor's chats",
    change: (_, english) => english.sidebar.groups.push({ id: "chats", label: "Chats", tabs: [] }),
    problems: [`en: the sidebar's group ids should be different from each other and from "chats"`],
  },
  {
    wrong: "a sidebar group's id that would break out of its attribute",
    change: (_, english) => english.sidebar.groups.push({ id: BREAKS_OUT_OF_AN_ATTRIBUTE, label: "More", tabs: [] }),
    problems: [`en: the sidebar's group id "${BREAKS_OUT_OF_AN_ATTRIBUTE}" ${NOT_AN_ID}`],
  },
  {
    wrong: "a row in a sidebar group that opens no thread",
    change: (_, english) =>
      english.sidebar.groups.push({
        id: "more",
        label: "More",
        tabs: [{ tab: "nowhere", title: "Lost", subtitle: "" }],
      }),
    problems: [`en: the sidebar's "Lost" ${NOT_A_THREAD}`],
  },
  {
    wrong: "a step of the panel's checklist that opens no thread",
    change: (_, english) =>
      (english.panel.progress = { title: "Career", steps: [{ tab: "nowhere", title: "Lost", when: "2020" }] }),
    problems: [`en: the panel's "Lost" ${NOT_A_THREAD}`],
  },
  {
    wrong: "a panel row with an icon the stylesheet doesn't have",
    change: (_, english) =>
      (english.panel.outputs = { title: "Files", rows: [{ label: "A file", meta: "PDF", icon: "nope" }] }),
    problems: [`en: the panel's "A file" has the icon "nope", but src/styles has no .i-nope`],
  },
  {
    wrong: "a panel row with a link that would run code",
    change: (_, english) =>
      (english.panel.outputs = {
        title: "Files",
        rows: [{ label: "A file", meta: "PDF", icon: "file", href: "javascript:alert(1)" }],
      }),
    problems: [`en: the panel's "A file" links to "javascript:alert(1)", ${NOT_A_SAFE_LINK}`],
  },
  {
    wrong: "a topic that opens no thread",
    change: withTopic({ label: "Lost", tab: "nowhere" }),
    problems: inBothLanguages(`the question card's "Lost" ${NOT_A_THREAD}`),
  },
  {
    wrong: "a topic's choice that opens no thread",
    change: withTopic({ label: "Lost", ask: "Which?", choices: [{ tab: "nowhere" }] }),
    problems: inBothLanguages(`the question card's "Lost" ${NOT_A_THREAD}`),
  },
  {
    wrong: "a topic with a second question and nothing to pick from",
    change: withTopic({ label: "Empty", ask: "Which?" }),
    problems: inBothLanguages(`the question card's "Empty" opens nothing`),
  },
  {
    wrong: "a topic with choices and no second question over them",
    change: withTopic({ label: "Jobs", choices: [{ tab: "about" }] }),
    problems: inBothLanguages(`the question card's "Jobs" needs an "ask" for its second question`),
  },
  {
    wrong: "a personal answer's id with a capital and a dot",
    change: withPersonalIds("My.Food"),
    problems: inBothLanguages(`the personal answer id "My.Food" ${NOT_AN_ID}`),
  },
  {
    wrong: "two personal answers with one id",
    change: withPersonalIds("food", "food"),
    problems: inBothLanguages("two personal answers have the same id"),
  },
  {
    wrong: "the email's wording without {question}",
    change: (_, english) => (english.asked.email = "Hello"),
    problems: ["en: asked.email should have {question} in it, where the question goes"],
  },
  {
    wrong: `the "Read …" line's wording without {file}`,
    change: (_, english) => (english.strings.status = "Read"),
    problems: [`en: strings.status should have {file} in it, where the file goes ("Read {file}")`],
  },
  {
    wrong: "a site in two languages without the account menu's language row",
    change: inEveryLanguage((language) => delete language.account.language),
    problems: inBothLanguages("account.language is missing: the account menu's row that opens the other language"),
  },
  {
    wrong: "a LinkedIn profile without the label of its link",
    change: (_, english) => delete english.asked.linkedin,
    problems: ["en: asked.linkedin is missing (links.linkedin needs it)"],
  },
  {
    wrong: "a LinkedIn profile without the message to send there",
    change: (_, english) => delete english.asked.message,
    problems: ["en: asked.message is missing (links.linkedin needs it)"],
  },
  {
    wrong: "an upgrade row that opens no thread",
    change: (_, english) => (english.account.upgrade.tab = "nowhere"),
    problems: [`en: the account menu's upgrade row ${NOT_A_THREAD}`],
  },
  {
    wrong: "a viewer without the words for its buttons",
    change: inEveryLanguage((language) => {
      delete language.strings.viewerOpen;
      delete language.strings.viewerClose;
    }),
    problems: [
      "en: strings.viewerOpen is missing (viewer needs it)",
      "en: strings.viewerClose is missing (viewer needs it)",
      "fr: strings.viewerOpen is missing (viewer needs it)",
      "fr: strings.viewerClose is missing (viewer needs it)",
    ],
  },
  {
    wrong: "a link in the text that would run code",
    change: (_, english) => (english.home.intro = "[hi](javascript:run)"),
    problems: [`en: a link in "[hi](javascript:run)" links to "javascript:run", ${NOT_A_SAFE_LINK}`],
  },
  {
    wrong: "an unsafe link in a long text, which is named by its start",
    change: (_, english) =>
      (english.home.intro = "Sam has built a good many things, and [one](javascript:run) is here."),
    problems: [
      `en: a link in "Sam has built a good many things, and [o…" links to "javascript:run", ${NOT_A_SAFE_LINK}`,
    ],
  },
  {
    wrong: "links in the text to tabs that aren't there",
    change: (_, english) => {
      english.home.intro = "See [this](#nowhere).";
      english.asked.answer = "Or [that](#elsewhere).";
    },
    problems: [
      "en: a link in the text points at #nowhere, which isn't a thread",
      "en: a link in the text points at #elsewhere, which isn't a thread",
    ],
  },
  {
    wrong: "a link to a file on the site in text the script shows, which only follows #tab, web and mailto links",
    change: inEveryLanguage(
      (language) => (language.questions.personal = [{ id: "fun", q: "for fun?", a: ["My [resume](/resume.pdf)."] }]),
    ),
    problems: inBothLanguages(
      `a link in "My [resume](/resume.pdf)." goes to "/resume.pdf", but the script shows this text, and only follows #tab, web and mailto links`,
    ),
  },
]);

test("a question to start with can get a personal answer", () => {
  const withAPersonalPrompt = inEveryLanguage((language) => {
    language.home.prompts = [{ q: "For fun?", answer: "personal-fun.1" }];
  });
  assert.deepEqual(problemsAfter(withAPersonalPrompt), []);
});

test("a link in the text can open the home screen or a personal answer's tab", () => {
  const withLinksToTabs: Change = (_, english) => {
    english.home.intro = "Back to [the start](#top), or [what Sam does for fun](#personal-fun).";
  };
  assert.deepEqual(problemsAfter(withLinksToTabs), []);
});

test("a site in one language needs no language row", () => {
  const inEnglishOnly = sampleInEnglishOnly();
  delete inEnglishOnly.languages.en?.account.language;
  assert.deepEqual(problemsIn(inEnglishOnly), []);
});

test("a site without a LinkedIn profile needs no words for one", () => {
  const withoutLinkedIn = sampleConfig({ links: { email: "sam@example.com" } });
  for (const language of Object.values(withoutLinkedIn.languages)) {
    delete language.asked.linkedin;
    delete language.asked.message;
  }
  assert.deepEqual(problemsIn(withoutLinkedIn), []);
});

/** A change that leaves a picture that moves in English alone, and gives every language `wording` for its button. */
const withAMovingPictureInEnglishOnly =
  (wording: Partial<Language["strings"]>): Change =>
  (sample, english) => {
    for (const language of Object.values(sample.languages)) {
      const answer = workAnswer(language);
      answer.splice(0, answer.length, ...answer.filter((block) => !(typeof block === "object" && "image" in block)));
      delete language.strings.play;
      delete language.strings.pause;
      Object.assign(language.strings, wording);
    }
    workAnswer(english).push({
      image: { src: "/favicon.svg", still: "/favicon.png", alt: "A picture that moves", width: 16, height: 16 },
    });
  };

test("a picture that moves is fine with the words for its button", () => {
  assert.deepEqual(problemsAfter(withAMovingPictureInEnglishOnly({ play: "Play", pause: "Pause" })), []);
});

test("a picture that moves needs the words for its button, in the language that has it and no other", () => {
  assert.deepEqual(problemsAfter(withAMovingPictureInEnglishOnly({})), [
    "en: strings.play is missing (a picture with a still needs it)",
    "en: strings.pause is missing (a picture with a still needs it)",
  ]);
});

for (const text of [
  "`[a](b`[c](javascript:alert(1))",
  "*[a](b*[c](javascript:alert(1))",
  "**[a](#about) [b](javascript:x)**",
  "[a [b](javascript:x)](#about)",
  "[a](JavaScript:x)",
  "[a](java\tscript:x)",
  "`[a](javascript:x)`",
  "**[a](#about)** and [b](https://example.com/x?y=(1))",
]) {
  test(`the text ${JSON.stringify(text)} is refused exactly when a link in it is unsafe, however it's written`, () => {
    const hasAnUnsafeLink = hrefsIn(text).some((href) => !isSafeHref(href));
    const problems = problemsAfter((_, english) => (english.home.intro = text));
    assert.equal(problems.length > 0, hasAnUnsafeLink, problems.join("; "));
  });
}
