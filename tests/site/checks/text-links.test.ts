/* The checks of the links in one language's text (src/site/checks/text-links.ts):
   each problem's wording, and what's allowed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { hrefsIn } from "../../../src/config/markdown.ts";
import { isSafeHref } from "../../../src/site/checks/formats.ts";
import { inBothLanguages, inEveryLanguage, problemsAfter, testEachProblem, type Change } from "./problems.ts";

const NOT_A_SAFE_LINK = "which should be a web, mailto, #thread or relative address";

testEachProblem([
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
    wrong: "a link in the text with no scheme that a browser reads as another site",
    change: (_, english) => (english.home.intro = "[hi](//example.org/x)"),
    problems: [`en: a link in "[hi](//example.org/x)" links to "//example.org/x", ${NOT_A_SAFE_LINK}`],
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

test("a link in the text can open the home screen or a personal answer's tab", () => {
  const withLinksToTabs: Change = (_, english) => {
    english.home.intro = "Back to [the start](#top), or [what Sam does for fun](#personal-fun).";
  };
  assert.deepEqual(problemsAfter(withLinksToTabs), []);
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
