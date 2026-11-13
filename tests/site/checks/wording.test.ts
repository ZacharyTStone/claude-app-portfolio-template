/* The checks of one language's wording (src/site/checks/wording.ts): each
   problem's wording, and what's allowed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { PAGE_STRING_NAMES, REQUIRED_SCRIPT_STRING_NAMES, type Strings } from "../../../src/config/strings.ts";
import { languageOf, sampleConfig, sampleInEnglishOnly, statedStrings } from "../sample.ts";
import {
  inBothLanguages,
  inEveryLanguage,
  inFrench,
  problemsAfter,
  problemsIn,
  testEachProblem,
  workAnswer,
  type Change,
} from "./problems.ts";

const ONLY_ENGLISH_HAS_ITS_OWN = "only a page in English has wording to fall back on";

testEachProblem([
  {
    wrong: "the email's wording without {question}",
    change: (_, english) => (english.asked.email = "Hello"),
    problems: ["en: asked.email should have {question} in it, where the question goes"],
  },
  {
    wrong: `the "Read …" line's wording without {file}`,
    change: (_, english) => (statedStrings(english).status = "Read"),
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
    wrong: "a viewer without the words for its buttons, which only English has of its own",
    change: inEveryLanguage((language) => {
      delete statedStrings(language).viewerOpen;
      delete statedStrings(language).viewerClose;
    }),
    problems: [
      "fr: strings.viewerOpen is missing (viewer needs it)",
      "fr: strings.viewerClose is missing (viewer needs it)",
    ],
  },
  {
    wrong: "a string left out of a language other than English",
    change: inFrench((french) => delete statedStrings(french).skip),
    problems: [`fr: strings.skip is missing: ${ONLY_ENGLISH_HAS_ITS_OWN}`],
  },
  {
    wrong: "a string that's empty in a language other than English",
    change: inFrench((french) => (statedStrings(french).credit = "")),
    problems: [`fr: strings.credit is missing: ${ONLY_ENGLISH_HAS_ITS_OWN}`],
  },
  {
    wrong: "a language other than English with no strings at all, on a site with a viewer and a picture that moves",
    change: inFrench((french) => delete french.strings),
    problems: [
      ...[...PAGE_STRING_NAMES, ...REQUIRED_SCRIPT_STRING_NAMES].map(
        (name) => `fr: strings.${name} is missing: ${ONLY_ENGLISH_HAS_ITS_OWN}`,
      ),
      "fr: strings.viewerOpen is missing (viewer needs it)",
      "fr: strings.viewerClose is missing (viewer needs it)",
      "fr: strings.play is missing (a picture with a still needs it)",
      "fr: strings.pause is missing (a picture with a still needs it)",
    ],
  },
]);

test("a language in English needs no strings: it has English's own, for the viewer and a picture that moves too", () => {
  assert.deepEqual(
    problemsAfter((_, english) => delete english.strings),
    [],
  );
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

/** A change that leaves a picture that moves in French alone, and gives every language `wording` for its button. */
const withAMovingPictureInFrenchOnly =
  (wording: Partial<Strings>): Change =>
  (sample) => {
    for (const language of Object.values(sample.languages)) {
      const answer = workAnswer(language);
      answer.splice(0, answer.length, ...answer.filter((block) => !(typeof block === "object" && "image" in block)));
      delete statedStrings(language).play;
      delete statedStrings(language).pause;
      Object.assign(statedStrings(language), wording);
    }
    workAnswer(languageOf(sample, "fr")).push({
      image: { src: "/favicon.svg", still: "/favicon.png", alt: "A picture that moves", width: 16, height: 16 },
    });
  };

test("a picture that moves is fine with the words for its button", () => {
  assert.deepEqual(problemsAfter(withAMovingPictureInFrenchOnly({ play: "Play", pause: "Pause" })), []);
});

test("a picture that moves needs the words for its button, in the language that has it and no other", () => {
  assert.deepEqual(problemsAfter(withAMovingPictureInFrenchOnly({})), [
    "fr: strings.play is missing (a picture with a still needs it)",
    "fr: strings.pause is missing (a picture with a still needs it)",
  ]);
});
