/* The check of the tabs' pages' paths (src/site/checks/page-paths.ts): each
   problem's wording, and what's allowed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { languageOf } from "../sample.ts";
import { inEveryLanguage, problemsIn, sampleAfter, testEachProblem, type Change } from "./problems.ts";

/** A change that gives every language a thread of one question with this id. */
const withThread = (id: string): Change =>
  inEveryLanguage((language) => language.threads.push({ id, title: "Another", messages: [{ q: "a?", a: ["b."] }] }));

const pickAnother = "pick another thread id";

testEachProblem([
  {
    wrong: "a thread id that's a language's code",
    change: withThread("fr"),
    problems: [`the thread "fr" would have its page at /fr/, where the fr language's own page is: ${pickAnother}`],
  },
  {
    wrong: "a thread id that's a language's code in other letters",
    change: (sample, english) => {
      sample.languages = { en: english, "pt-BR": languageOf(sample, "fr") };
      withThread("pt-br")(sample, english);
    },
    problems: [
      `the thread "pt-br" would have its page at /pt-br/, where the pt-BR language's own page is: ${pickAnother}`,
    ],
  },
  {
    wrong: "a thread id that's the folder of the site's pictures",
    change: withThread("assets"),
    problems: [
      `the thread "assets" would have its page at /assets/, where the site's pictures, icons and fonts are: ${pickAnother}`,
    ],
  },
  {
    wrong: "a thread id that's where Ask's Worker answers",
    change: withThread("ask"),
    problems: [`the thread "ask" would have its page at /ask/, where Ask's Worker answers: ${pickAnother}`],
  },
  {
    wrong: "a thread id kept for a blog",
    change: withThread("blog"),
    problems: [`the thread "blog" would have its page at /blog/, which is kept for a blog: ${pickAnother}`],
  },
]);

test("a thread id that's a page in public/, or a folder there, is taken by it", () => {
  const sample = sampleAfter((config, english) => {
    withThread("cv")(config, english);
    withThread("docs")(config, english);
  });
  assert.deepEqual(problemsIn(sample, ["assets", "cv.html", "docs"]), [
    `the thread "cv" would have its page at /cv/, where public/cv.html is served: ${pickAnother}`,
    `the thread "docs" would have its page at /docs/, where public/docs is served: ${pickAnother}`,
  ]);
});

test("a personal answer's page can't take a path in public/ either", () => {
  const sample = sampleAfter(
    inEveryLanguage((language) => language.questions.personal.push({ id: "pets", q: "pets?", a: ["A cat."] })),
  );
  assert.deepEqual(problemsIn(sample, ["assets", "personal-pets"]), [
    `the personal answer "pets" would have its page at /personal-pets/, where public/personal-pets is served: pick another personal answer id`,
  ]);
});

test("a thread id can be a file's name in public/ with another ending: a page and a PDF don't share a path", () => {
  assert.deepEqual(problemsIn(sampleAfter(withThread("resume")), ["assets", "resume.pdf", "_redirects"]), []);
});
