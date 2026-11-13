/* The checks of one language's wording (src/site/checks/wording.ts): each
   problem's wording, and what's allowed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Language } from "../../../src/config/language.ts";
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

testEachProblem([
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
]);

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
