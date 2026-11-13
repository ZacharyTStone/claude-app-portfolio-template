/* The checks of the site as a whole (src/site/checks/whole-site.ts): each
   problem's wording, and what's allowed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOSTS } from "../../../src/config/site-config.ts";
import { sampleConfig } from "../sample.ts";
import {
  findingsIn,
  inEveryLanguage,
  inFrench,
  problemsAfter,
  problemsIn,
  sampleAfter,
  testEachProblem,
} from "./problems.ts";

const LANGUAGES_DO_NOT_MATCH = `fr: its threads, questions and home prompts don't match en's (same ids, as many questions, same order)`;
const NOT_THE_SITES_ADDRESS = `url should be the site's address, like "https://example.com"`;

/** Something that would end the attribute it's written into, and start another. */
const BREAKS_OUT_OF_AN_ATTRIBUTE = `x" onclick="alert(1)`;

/** What the sample's viewer opens, and where it shows it. */
const VIEWER_LINK = "https://docs.example.com/d/notes/edit";

testEachProblem([
  {
    wrong: "one language has its threads in another order",
    change: inFrench((french) => french.threads.reverse()),
    problems: [LANGUAGES_DO_NOT_MATCH],
  },
  {
    wrong: "one language's thread answers one more question",
    change: inFrench((french) => french.threads[1]?.messages.push({ q: "and?", a: ["More."] })),
    problems: [LANGUAGES_DO_NOT_MATCH],
  },
  {
    wrong: "one language has a topic fewer",
    change: inFrench((french) => french.questions.topics.pop()),
    problems: [LANGUAGES_DO_NOT_MATCH],
  },
  {
    wrong: "one language has a personal answer more",
    change: inFrench((french) => french.questions.personal.push({ id: "food", q: "food?", a: ["Bread."] })),
    problems: [LANGUAGES_DO_NOT_MATCH],
  },
  {
    wrong: "one language has no questions to start with",
    change: inFrench((french) => (french.home.prompts = [])),
    problems: [LANGUAGES_DO_NOT_MATCH],
  },
  {
    wrong: "a language's code is a path",
    change: (sample, english) => (sample.languages["../elsewhere"] = structuredClone(english)),
    problems: [
      `"../elsewhere" should be a language code like "en" or "pt-BR" (it's also the name of its page's folder)`,
    ],
  },
  {
    wrong: "the time zone is a city's name",
    change: (sample) => (sample.timezone = "Tokyo"),
    problems: [`timezone should be a time zone, like "Asia/Tokyo" or "UTC"`],
  },
  {
    wrong: "hsts.preload without includeSubDomains",
    change: (sample) => (sample.hsts = { preload: true }),
    problems: ["hsts.preload needs hsts.includeSubDomains too (browsers only preload a whole domain)"],
  },
  {
    wrong: "nameLang is a language's name",
    change: (sample) => (sample.nameLang = "English"),
    problems: [`nameLang should be a language code like "en"`],
  },
  {
    wrong: "links.email has mailto: in it",
    change: (sample) => (sample.links.email = "mailto: sam@example.com"),
    problems: ["links.email should be an email address"],
  },
  {
    wrong: "links.github has no https://",
    change: (sample) => (sample.links.github = "github.com/example"),
    problems: [`links.github should be a web address, like "https://…"`],
  },
  {
    wrong: "links.linkedin has no https://",
    change: (sample) => (sample.links.linkedin = "linkedin.com/in/example"),
    problems: [`links.linkedin should be a web address, like "https://…"`],
  },
  {
    wrong: "themeColor would break out of its attribute",
    change: (sample) => (sample.themeColor = BREAKS_OUT_OF_AN_ATTRIBUTE),
    problems: [`themeColor should be a colour, like "#191919"`],
  },
  {
    wrong: "the social card is on another site",
    change: (sample) => (sample.social.image = "https://example.com/og.png"),
    problems: [`social.image should be a path on this site, like "/assets/og.png"`],
  },
  {
    wrong: "the social card has no width",
    change: (sample) => (sample.social.width = 0),
    problems: ["social.width should be a whole number of pixels"],
  },
  {
    wrong: "the social card's height is a fraction",
    change: (sample) => (sample.social.height = 630.5),
    problems: ["social.height should be a whole number of pixels"],
  },
  {
    wrong: "the owner's portrait is a path from the page's own folder",
    change: (sample) => (sample.person = { image: "portrait.webp" }),
    problems: [`person.image should be a path on this site, like "/assets/portrait.webp"`],
  },
  {
    wrong: "the viewer lists a link the site doesn't have",
    change: (sample) => (sample.viewer = { "https://docs.example.com/d/other/edit": "https://docs.example.com/p" }),
    problems: [
      `viewer has "https://docs.example.com/d/other/edit", but no link card, picture or panel row links there: it should be a link's href, exactly as the config has it`,
    ],
  },
  {
    wrong: "the viewer shows a page of this site",
    change: (sample) => (sample.viewer = { [VIEWER_LINK]: "https://example.com/portfolio/notes.pdf" }),
    problems: [
      `viewer shows "${VIEWER_LINK}" at "https://example.com/portfolio/notes.pdf", a page of this site, and this site's pages refuse to be shown in a frame`,
    ],
  },
]);

for (const url of [
  "javascript:alert(1)",
  "https://example.com/?q=1",
  "https://example.com/#top",
  "example.com",
  "",
  "https://example.com//",
  "https://example.com/portfolio//x/",
]) {
  test(`"${url}" isn't the site's address, and the checks say so rather than failing on it`, () => {
    assert.deepEqual(
      problemsAfter((sample) => (sample.url = url)),
      [NOT_THE_SITES_ADDRESS],
    );
  });
}

for (const url of ["https://example.com/", "https://example.github.io/portfolio", "https://x.io/a/b/"]) {
  test(`"${url}" is a site's address, with or without a path`, () => {
    assert.deepEqual(
      problemsAfter((sample) => (sample.url = url)),
      [],
    );
  });
}

test("a time zone the browser's clock knows is fine", () => {
  assert.deepEqual(
    problemsAfter((sample) => (sample.timezone = "Asia/Tokyo")),
    [],
  );
});

for (const frameAddress of ["http://docs.example.com/d/notes/preview", "/assets/notes.pdf", "javascript:alert(1)"]) {
  test(`the viewer can't show "${frameAddress}", which isn't an https:// address`, () => {
    assert.deepEqual(
      problemsAfter((sample) => (sample.viewer = { [VIEWER_LINK]: frameAddress })),
      [`viewer shows "${VIEWER_LINK}" at "${frameAddress}", which should be an https:// address`],
    );
  });
}

test("Ask runs where the host is Cloudflare, named or left out", () => {
  const ask = { role: "an engineer" };
  assert.deepEqual(problemsIn(sampleConfig({ ask, host: undefined })), []);
  assert.deepEqual(problemsIn(sampleConfig({ ask, host: "cloudflare" })), []);
});

for (const host of HOSTS.filter((other) => other !== "cloudflare")) {
  test(`Ask doesn't run on the host "${host}"`, () => {
    assert.deepEqual(problemsIn(sampleConfig({ ask: { role: "an engineer" }, host })), [
      `ask needs Cloudflare Workers, where its Worker (src/worker) runs, but host is "${host}": remove ask, or set host to "cloudflare"`,
    ]);
  });
}

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
