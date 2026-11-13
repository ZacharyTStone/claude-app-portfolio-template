/* The config's checks and what's built from it as text (llms.txt, Ask's
   answers, the host's headers), on a sample site defined here so they hold
   in any repo, and the checks on this repo's own config. */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import ownConfig from "../site.config.ts";
import { ASK_PATH, isLabel, labelled } from "../src/contracts/ask.ts";
import type { AskAnswer, AskIndex } from "../src/contracts/ask.ts";
import { HOSTS } from "../src/config/site-config.ts";
import { PAGE_STRINGS, SCRIPT_STRINGS } from "../src/config/strings.ts";
import type { Language } from "../src/config/language.ts";
import type { SiteConfig } from "../src/config/site-config.ts";
import type { Strings } from "../src/config/strings.ts";
import type { Block, Card } from "../src/config/blocks.ts";
import { hrefsIn, plainText, spans } from "../src/config/markdown.ts";
import { contentSecurityPolicy, frameOrigins, securityHeaders } from "../src/site/security-headers.ts";
import { askIndexJson, plainAnswers } from "../src/site/answers.ts";
import { neededFor, numbered, pointsBack, quote } from "../src/worker/ask/quote.ts";
import { barLength } from "../src/site/bars.ts";
import { cardRows } from "../src/site/card.ts";
import { ROOT } from "../src/site/constants.ts";
import { headersFile, pagePolicy } from "../src/site/hosts.ts";
import { llmsTxt } from "../src/site/llms.ts";
import { scriptJson } from "../src/site/script-json.ts";
import { makePage, makeSite } from "../src/site/site.ts";
import { iconsIn, readStylesheet, STYLES_FOLDER } from "../src/site/stylesheet.ts";
import { structuredData } from "../src/site/structured-data.ts";
import { isSafeHref, validate } from "../src/site/validate.ts";

/** The stylesheet's source, as one text. */
const stylesheet = readStylesheet(join(ROOT, STYLES_FOLDER));
/** The icons a config can name: the stylesheet's .i-* classes. */
const stylesheetIcons = iconsIn(stylesheet);

// ---- A sample site ---------------------------------------------------------------------

/** One language of the sample: two threads ("about" and "work"), a file
    card, a figure of each kind, a question to start with on the home
    screen, and links to a file on the site from the text, a link card and
    the panel. */
function sampleLanguage(label: string, locale: string): Language {
  // Every string says its own key, but for the one that needs a placeholder.
  const everyKey = [...PAGE_STRINGS, ...SCRIPT_STRINGS];
  const strings = { ...Object.fromEntries(everyKey.map((key) => [key, key])), status: "Read {file}" } as Strings;
  const image = "/assets/og.png";
  return {
    label,
    name: label,
    locale,
    meta: { title: "Sam Sample", description: "A sample", imageAlt: "A card", preload: ["/assets/fonts/inter.woff2"] },
    person: { name: "Sam Sample", jobTitle: "Engineer" },
    home: {
      greeting: { default: "Hi", morning: "Morning", afternoon: "Afternoon", evening: "Evening", late: "Late" },
      intro: `Sam builds things. Here's [the card](${image}).`,
      prompts: [{ q: "What does Sam do?", answer: "work.1" }],
    },
    sidebar: {
      newTab: "New tab",
      nav: [{ tab: "about", icon: "about", label: "About" }],
      groups: [{ id: "work", label: "Work", tabs: [{ tab: "work", title: "Work", subtitle: "2020 – now" }] }],
    },
    threads: [
      { id: "about", title: "About", messages: [{ q: "who is sam?", a: ["Sam is **an engineer**."] }] },
      {
        id: "work",
        title: "Work",
        messages: [
          {
            q: "what does sam do?",
            read: { file: "work.md", card: { file: "role.yaml", lines: [["role", "Engineer"]] } },
            a: [
              { link: { name: "The card", kind: "Image", href: image, icon: "file" } },
              {
                bars: {
                  title: "Time to load",
                  note: "63% faster",
                  rows: [
                    { label: "Before", value: "1.04 s", amount: 1040 },
                    { label: "After", value: "385 ms", amount: 385, accent: true },
                  ],
                },
              },
              { flow: { title: "The pipeline", steps: [{ name: "Draft", note: "by a model" }, { name: "Publish" }] } },
              { image: { src: image, alt: "The card", width: 1200, height: 630, caption: "The card, as shared." } },
              { quote: { text: "Sam got it done.", by: "A coworker" } },
              { heading: { label: "Project", title: "The card" } },
              { images: [{ src: image, alt: "The card", width: 1200, height: 630, caption: "Once more." }] },
            ],
          },
        ],
      },
    ],
    asked: { title: "Else", q: "a question", answer: "Ask Sam.", mail: "Email it", subject: "Hi", email: "{question}" },
    panel: { outputs: { title: "Outputs", rows: [{ label: "The card", meta: "Image", icon: "file", href: image }] } },
    account: {
      initial: "S",
      name: "Sam",
      sub: "Remote",
      label: "Account",
      clock: {
        me: "Sam",
        zone: "UTC",
        you: "You",
        ahead: "{n}h ahead",
        behind: "{n}h behind",
        same: "Same time",
        moods: { morning: "Up", day: "Busy", evening: "Done", late: "Asleep" },
      },
      language: "Language",
      upgrade: { label: "Upgrade", hire: "Hire", tab: "about" },
      logout: { label: "Log out", title: "Bye", text: "Bye.", back: "Back" },
    },
    questions: {
      ask: "What would you like to know?",
      topics: [
        { label: "About", tab: "about" },
        { label: "Work", tab: "work" },
      ],
      personal: [{ id: "fun", q: "for fun?", a: ["Reading."] }],
      ui: { else: "Else", elseLabel: "Else", send: "Send", back: "Back", step: "{n} of {total}", followUp: "More" },
    },
    notFound: { title: "Not found.", text: "Nothing here.", back: "Back" },
    strings,
  };
}

/** The sample's config, in English ("en", the main language) and French,
    with `overrides` in place of its own settings. */
function sampleConfig(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    url: "https://example.com",
    name: "Sam Sample",
    timezone: "UTC",
    links: { email: "sam@example.com", github: "https://github.com/example" },
    social: { image: "/assets/og.png", width: 1200, height: 630 },
    themeColor: "#191919",
    llms: { summary: "A sample.", about: "Sam is a sample." },
    languages: { en: sampleLanguage("EN", "en_US"), fr: sampleLanguage("FR", "fr_FR") },
    ...overrides,
  };
}

/** The sample with Ask on, on the one host that runs it. */
const sampleConfigWithAsk = (): SiteConfig => sampleConfig({ host: "cloudflare", ask: { role: "an engineer" } });

/** The problems the config's checks find in a config. */
const problemsIn = (config: SiteConfig): string[] => validate(makeSite(config), stylesheetIcons).problems;

/** The problems the checks find once `change` is made to the sample: to the
    config as a whole, or to its English alone (so the languages may no
    longer match). */
function problemsAfter(change: (sample: SiteConfig, english: Language) => void): string[] {
  const sample = sampleConfig();
  const english = sample.languages.en;
  assert.ok(english);
  change(sample, english);
  return problemsIn(sample);
}

/** The problems the checks find once `change` is made to every language of
    the sample, so they still match. */
const problemsAfterInEveryLanguage = (change: (language: Language) => void): string[] =>
  problemsAfter((sample) => Object.values(sample.languages).forEach(change));

/** The blocks of the answer in a language's "work" thread. */
function workAnswer(language: Language): Block[] {
  const blocks = language.threads.find((thread) => thread.id === "work")?.messages[0]?.a;
  assert.ok(blocks);
  return blocks;
}

/** The problems the checks find once `block` is added to the answer in the
    sample's "work" thread, in English alone. */
const problemsWithBlock = (block: Block): string[] => problemsAfter((_, english) => workAnswer(english).push(block));

/** A sample's English answers as /ask.json has them, read back from the
    file's text. */
function englishAnswersInAskJson(config: SiteConfig): AskAnswer[] {
  const index = JSON.parse(askIndexJson(makeSite(config))) as AskIndex;
  const answers = index.answers.en;
  assert.ok(answers);
  return answers;
}

// ---- The config's Markdown -------------------------------------------------------------

test("Markdown is read into words, code, bold, italic and links, nested but for code", () => {
  assert.deepEqual(spans("<b>Hi</b> **bold [a *link*](#about)** and `*code*`"), [
    "<b>Hi</b> ",
    {
      type: "strong",
      spans: ["bold ", { type: "link", href: "#about", spans: ["a ", { type: "em", spans: ["link"] }] }],
    },
    " and ",
    { type: "code", text: "*code*" },
  ]);
  assert.equal(plainText("**Bold**, *italic*, `code` and [a link](#about)"), "Bold, italic, code and a link");
  // A code span is the words as they are, asterisks and all.
  assert.equal(plainText("`tests/**/*.test.ts` and `a*b*c`"), "tests/**/*.test.ts and a*b*c");
});

// ---- The checks: configs with nothing wrong --------------------------------------------

test("This site's config has no problems", () => {
  assert.deepEqual(problemsIn(ownConfig), []);
});

test("The sample has no problems, on every host", () => {
  for (const host of HOSTS) {
    assert.deepEqual(validate(makeSite(sampleConfig({ host })), stylesheetIcons), { problems: [], notes: [] });
  }
});

test("A config that leaves out everything it can still validates", () => {
  const withoutProfiles = { links: { email: "sam@example.com" } };
  const { en: english } = sampleConfig(withoutProfiles).languages;
  assert.ok(english);
  const { home, account } = english;
  const bareEnglish: Language = {
    ...english,
    home: { greeting: home.greeting, intro: home.intro },
    panel: {},
    account: { ...account, language: undefined },
  };
  assert.deepEqual(problemsIn(sampleConfig({ ...withoutProfiles, languages: { en: bareEnglish } })), []);
});

// ---- The checks: the site as a whole ---------------------------------------------------

test("Validation finds languages that don't match: threads, questions, topics, personal answers", () => {
  const mismatch = [
    `fr: its threads, questions and home prompts don't match en's (same ids, as many questions, same order)`,
  ];
  const problemsAfterInFrench = (change: (french: Language) => void) =>
    problemsAfter((sample) => {
      const { fr: french } = sample.languages;
      assert.ok(french);
      change(french);
    });
  assert.deepEqual(
    problemsAfterInFrench((french) => french.threads.reverse()),
    mismatch,
  );
  assert.deepEqual(
    problemsAfterInFrench((french) => french.threads[1]?.messages.push({ q: "and?", a: ["More."] })),
    mismatch,
  );
  assert.deepEqual(
    problemsAfterInFrench((french) => french.questions.topics.pop()),
    mismatch,
  );
  assert.deepEqual(
    problemsAfterInFrench((french) => french.questions.personal.push({ id: "food", q: "food?", a: ["Bread."] })),
    mismatch,
  );
});

test("Validation refuses values that would break out of where they go", () => {
  const evil = `x" onclick="alert(1)`;
  assert.deepEqual(
    problemsAfter((sample) => (sample.themeColor = evil)),
    [`themeColor should be a colour, like "#191919"`],
  );
  for (const url of ["javascript:alert(1)", "https://example.com/?q=1", "https://example.com/#top"]) {
    assert.deepEqual(
      problemsAfter((sample) => (sample.url = url)),
      [`url should be the site's address, like "https://example.com"`],
      url,
    );
  }
  assert.deepEqual(
    problemsAfter((_, english) => (english.locale = evil)),
    [`en: locale should look like "en_US"`],
  );
  assert.deepEqual(
    problemsAfter((_, english) => {
      const group = english.sidebar.groups[0];
      assert.ok(group);
      group.id = evil;
    }),
    [`en: the sidebar's group id "${evil}" should be lowercase letters, digits and dashes`],
  );
  // A language's code is its page's folder too.
  assert.deepEqual(
    problemsAfter((sample, english) => (sample.languages["../elsewhere"] = structuredClone(english))),
    [`"../elsewhere" should be a language code like "en" or "pt-BR" (it's also the name of its page's folder)`],
  );
});

test("Validation reports an address that isn't the site's, rather than failing on it", () => {
  for (const url of ["example.com", "", "https://example.com//", "https://example.com/portfolio//x/"]) {
    assert.deepEqual(
      problemsAfter((sample) => (sample.url = url)),
      [`url should be the site's address, like "https://example.com"`],
      url,
    );
  }
  for (const url of ["https://example.com/", "https://example.github.io/portfolio", "https://x.io/a/b/"]) {
    assert.deepEqual(
      problemsAfter((sample) => (sample.url = url)),
      [],
      url,
    );
  }
});

test("Validation refuses a time zone the browser's clock doesn't know", () => {
  assert.deepEqual(
    problemsAfter((sample) => (sample.timezone = "Tokyo")),
    [`timezone should be a time zone, like "Asia/Tokyo" or "UTC"`],
  );
  assert.deepEqual(
    problemsAfter((sample) => (sample.timezone = "Asia/Tokyo")),
    [],
  );
});

test("Validation knows that Ask needs Cloudflare", () => {
  const ask = { role: "an engineer" };
  assert.deepEqual(problemsIn(sampleConfig({ ask })), []);
  for (const host of HOSTS.filter((other) => other !== "cloudflare")) {
    assert.deepEqual(problemsIn(sampleConfig({ ask, host })), [
      `ask needs Cloudflare Workers, where its Worker (src/worker) runs, but host is "${host}": remove ask, or set host to "cloudflare"`,
    ]);
  }
});

test("A site with a picture that moves needs the words for a played picture's button", () => {
  const withAMovingPicture = (wording: Record<string, string>) =>
    problemsAfter((sample, english) => {
      english.threads[0]?.messages[0]?.a.push({
        image: { src: "/favicon.svg", still: "/favicon.png", alt: "A picture that moves", width: 16, height: 16 },
      });
      for (const language of Object.values(sample.languages)) {
        delete language.strings.play;
        delete language.strings.pause;
        Object.assign(language.strings, wording);
      }
    });
  assert.deepEqual(withAMovingPicture({ play: "Play", pause: "Pause" }), []);
  // Only the language that has the picture is asked for them.
  assert.deepEqual(withAMovingPicture({}), [
    "en: strings.play is missing (a picture with a still needs it)",
    "en: strings.pause is missing (a picture with a still needs it)",
  ]);
});

test("The viewer opens links the site has, at https addresses on another site, and needs its buttons' words", () => {
  const link = "https://docs.example.com/d/1/edit";
  const shown = "https://docs.example.com/d/1/preview";
  const viewerWording = { viewerOpen: "Open in a new tab", viewerClose: "Close" };
  const problemsWithViewer = (viewer: Record<string, string>, wording: Record<string, string> = viewerWording) =>
    problemsAfter((sample, english) => {
      sample.viewer = viewer;
      english.threads[0]?.messages[0]?.a.push({ link: { name: "A doc", kind: "Document", href: link, icon: "file" } });
      for (const language of Object.values(sample.languages)) Object.assign(language.strings, wording);
    });
  assert.deepEqual(problemsWithViewer({ [link]: shown }), []);
  assert.deepEqual(problemsWithViewer({ [link]: shown }, {}), [
    "en: strings.viewerOpen is missing (viewer needs it)",
    "en: strings.viewerClose is missing (viewer needs it)",
    "fr: strings.viewerOpen is missing (viewer needs it)",
    "fr: strings.viewerClose is missing (viewer needs it)",
  ]);
  assert.match(
    problemsWithViewer({ "https://docs.example.com/d/2/edit": shown }).join("\n"),
    /no link card, picture or panel row links there/,
  );
  for (const address of ["http://docs.example.com/d/1/preview", "/assets/doc.pdf", "javascript:alert(1)"]) {
    assert.match(problemsWithViewer({ [link]: address }).join("\n"), /which should be an https:\/\/ address/, address);
  }
  // This site's own pages refuse to be framed (X-Frame-Options, frame-ancestors).
  assert.match(
    problemsWithViewer({ [link]: "https://example.com/assets/doc.pdf" }).join("\n"),
    /a page of this site, and this site's pages refuse to be shown in a frame/,
  );
});

// ---- The checks: ids, and what points at a thread or an answer -------------------------

test("Validation catches a row that points at a thread that doesn't exist", () => {
  assert.deepEqual(
    problemsAfter((_, english) => {
      const row = english.sidebar.nav[0];
      assert.ok(row);
      row.tab = "nowhere";
    }),
    [`en: the sidebar's "About" points at #nowhere, which isn't a thread`],
  );
});

test("Validation catches a question to start with that names no answer", () => {
  const problems = problemsAfter((_, english) => {
    english.home.prompts = [{ q: "What does Sam do?", answer: "work.2" }];
  });
  assert.equal(problems.length, 2, "its own problem, and the languages no longer match");
  assert.match(
    problems.join("\n"),
    /en: the home prompt "What does Sam do\?" gets the answer "work\.2", which isn't one/,
  );
  assert.match(problems.join("\n"), /fr: its threads, questions and home prompts don't match en's/);
  // A personal answer can be one too.
  assert.deepEqual(
    problemsAfterInEveryLanguage((language) => (language.home.prompts = [{ q: "For fun?", answer: "personal-fun.1" }])),
    [],
  );
});

test("Validation checks personal answer ids as it does thread ids, and for twins", () => {
  const problemsWithPersonalIds = (...ids: string[]) =>
    problemsAfterInEveryLanguage((language) => {
      language.questions.personal = ids.map((id) => ({ id, q: "Why?", a: ["Because."] }));
    });
  assert.deepEqual(problemsWithPersonalIds("My.Food"), [
    `en: the personal answer id "My.Food" should be lowercase letters, digits and dashes`,
    `fr: the personal answer id "My.Food" should be lowercase letters, digits and dashes`,
  ]);
  assert.deepEqual(problemsWithPersonalIds("food", "food"), [
    "en: two personal answers have the same id",
    "fr: two personal answers have the same id",
  ]);
});

test("Validation refuses a thread id the page would also give a tab's title", () => {
  const problems = problemsAfterInEveryLanguage((language) => {
    language.threads.push({ id: "about-title", title: "Twin", messages: [{ q: "a?", a: ["b."] }] });
  });
  assert.deepEqual(problems, [
    `en: "about-title" is used by the page itself; pick another thread id`,
    `fr: "about-title" is used by the page itself; pick another thread id`,
  ]);
});

test("Validation needs the words the page fills in, and the language row on a site with two", () => {
  assert.deepEqual(
    problemsAfter((_, english) => {
      english.strings.status = "Read";
      english.asked.email = "Hello";
    }),
    [
      "en: asked.email should have {question} in it, where the question goes",
      `en: strings.status should have {file} in it, where the file goes ("Read {file}")`,
    ],
  );
  assert.deepEqual(
    problemsAfterInEveryLanguage((language) => delete language.account.language),
    ["en", "fr"].map(
      (code) => `${code}: account.language is missing: the account menu's row that opens the other language`,
    ),
  );
  assert.deepEqual(
    problemsAfter((sample) => {
      delete sample.languages.fr;
      delete sample.languages.en?.account.language;
    }),
    [],
  );
});

// ---- The checks: an answer's blocks ----------------------------------------------------

test("Validation catches bars that aren't a figure", () => {
  assert.match(
    problemsWithBlock({ bars: { title: "One", rows: [{ label: "Only", value: "1", amount: 1 }] } }).join("\n"),
    /has 1 bars in "One": it takes 2 to 6/,
  );
  const rows = [
    { label: "Before", value: "none", amount: 0 },
    { label: "After", value: "?", amount: Number.NaN },
  ];
  const amountProblems = problemsWithBlock({ bars: { title: "Two", rows } });
  assert.equal(amountProblems.length, 2);
  assert.match(amountProblems.join("\n"), /the bar "Before" with the amount 0: it should be a number above zero/);
});

test("Validation catches a flow that isn't a figure", () => {
  assert.match(
    problemsWithBlock({ flow: { title: "Short", steps: [{ name: "Only" }] } }).join("\n"),
    /has 1 steps in "Short": it takes 2 to 5/,
  );
});

test("Validation needs a picture to be a file on the site, with words for it, its size, and a safe link", () => {
  const picture = { src: "https://example.com/a.png", alt: "", width: 0, height: 630, href: "javascript:alert(1)" };
  for (const block of [{ image: picture }, { images: [picture] }]) {
    const problems = problemsWithBlock(block).join("\n");
    assert.match(problems, /should be a path on this site/);
    assert.match(problems, /without an alt/);
    assert.match(problems, /without its width and height/);
    assert.match(problems, /the picture "https:\/\/example\.com\/a\.png" links to "javascript:alert\(1\)"/);
  }
});

test("Validation needs a moving picture's still to be another file on the site", () => {
  const moving = { src: "/assets/how.svg", alt: "How it works", width: 1600, height: 800 };
  // With the words a picture that moves needs for its button.
  const problemsWithMoving = (still: string) =>
    problemsAfter((_, english) => {
      Object.assign(english.strings, { play: "Play", pause: "Pause" });
      workAnswer(english).push({ image: { ...moving, still } });
    });
  assert.deepEqual(problemsWithMoving("/assets/how-still.svg"), []);
  for (const still of ["https://example.com/how-still.svg", moving.src, ""]) {
    assert.match(
      problemsWithMoving(still).join("\n"),
      /with the still ".*", which should be another file on this site/,
      still,
    );
  }
});

test("Validation needs a quote's words and who said them, and a heading's title", () => {
  assert.match(
    problemsWithBlock({ quote: { text: "Good.", by: "" } }).join("\n"),
    /a quote without its text or who said it/,
  );
  assert.match(problemsWithBlock({ heading: { title: "" } }).join("\n"), /a heading without a title/);
});

// ---- The checks: links ------------------------------------------------------------------

test("Validation refuses Markdown exactly when a link in it would be unsafe, however it's written", () => {
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
    const unsafeHrefs = hrefsIn(text).filter((href) => !isSafeHref(href));
    const problems = problemsAfter((_, english) => (english.home.intro = text));
    assert.equal(problems.length > 0, unsafeHrefs.length > 0, `${text}: ${problems.join("; ")}`);
  }
});

test("Validation refuses a link the script would show as words, in the text it shows", () => {
  assert.deepEqual(
    problemsAfterInEveryLanguage((language) => {
      const personalAnswer = language.questions.personal[0];
      assert.ok(personalAnswer);
      personalAnswer.a = ["My [resume](/resume.pdf)."];
    }),
    ["en", "fr"].map(
      (code) =>
        `${code}: a link in "My [resume](/resume.pdf)." goes to "/resume.pdf", but the script shows this text, and only follows #tab, web and mailto links`,
    ),
  );
});

test("Validation checks a #thread link wherever there's Markdown", () => {
  assert.deepEqual(
    problemsAfter((_, english) => {
      english.home.intro = "See [this](#nowhere).";
      english.asked.answer = "Or [that](#elsewhere).";
    }),
    [
      "en: a link in the text points at #nowhere, which isn't a thread",
      "en: a link in the text points at #elsewhere, which isn't a thread",
    ],
  );
});

test("Validation refuses links that would run code", () => {
  assert.deepEqual(
    problemsAfter((_, english) => (english.home.intro = "[hi](javascript:run)")),
    [
      `en: a link in "[hi](javascript:run)" links to "javascript:run", which should be a web, mailto, #thread or relative address`,
    ],
  );
  const href = "java\nscript:alert(1)";
  assert.deepEqual(
    problemsAfter((_, english) =>
      english.threads[0]?.messages[0]?.a.push({ link: { name: "x", kind: "y", href, icon: "file" } }),
    ),
    [`en: the link card "x" links to "${href}", which should be a web, mailto, #thread or relative address`],
  );
});

test("A safe link is a web, mailto, #thread or relative address, whatever its letters' case", () => {
  for (const safe of ["https://example.com", "mailto:you@example.com", "#about", "/resume.pdf", "resume.pdf"]) {
    assert.ok(isSafeHref(safe), safe);
  }
  for (const unsafe of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,x",
    "java\tscript:x",
    " https://x",
  ]) {
    assert.ok(!isSafeHref(unsafe), unsafe);
  }
});

// ---- What's built from it --------------------------------------------------------------

test("A card's comments line up, unless a value has wide characters", () => {
  // The card's lines as they show, tags aside.
  const linesAsDrawn = (lines: Card["lines"]) =>
    cardRows({ file: "role.yaml", lines }).map(
      (row) =>
        `${row.key ? `${row.key}:` : ""}${row.indent}${row.value}${row.comment ? `${row.beforeComment}# ${row.comment}` : ""}`,
    );
  assert.deepEqual(
    linesAsDrawn([
      ["company", "Acme", "a comment"],
      ["role", "Engineer", "another"],
    ]),
    ["company: Acme      # a comment", "role:    Engineer  # another"],
  );
  assert.deepEqual(
    linesAsDrawn([
      ["company", "アクメ", "a comment"],
      ["role", "Engineer", "another"],
    ]),
    ["company: アクメ  # a comment", "role:    Engineer  # another"],
  );
  // A list's other lines sit under its first, and an uncommented value can be any length.
  assert.deepEqual(
    linesAsDrawn([
      ["stack", ["TypeScript,", "Workers"], "daily"],
      ["a", "a value longer than any with a comment"],
    ]),
    ["stack: TypeScript,  # daily", "       Workers", "a:     a value longer than any with a comment"],
  );
});

test("A bar is as long as its amount, the longest leaving room for its value", () => {
  assert.equal(barLength(1040, 1040), 70);
  assert.equal(barLength(385, 1040), 25.91);
});

test("JSON in a <script> can't end it, and reads back as it was", () => {
  const value = { text: "</script><script>alert(1)</script> & <!--" };
  const json = scriptJson(value);
  assert.doesNotMatch(json, /</);
  assert.deepEqual(JSON.parse(json), value);
  const site = makeSite(sampleConfig({ name: "</script>Sam" }));
  const person = structuredData(makePage(site, "en"));
  assert.doesNotMatch(person, /</);
  assert.equal((JSON.parse(person) as { alternateName: string }).alternateName, "</script>Sam");
});

test("llms.txt has every answer in the main language, in Ask's words, and the panel's links", () => {
  const site = makeSite(sampleConfigWithAsk());
  const llmsText = llmsTxt(site);
  const answers = plainAnswers(site, "en");
  assert.ok(answers.length > 2);
  for (const { title, q, text: answerText } of answers) {
    assert.ok(llmsText.includes(`### ${title}\n`), `the tab "${title}"`);
    // Each block of the answer (a line in Ask's index) is a paragraph.
    assert.ok(llmsText.includes(`**${q}**\n\n${answerText.split("\n").join("\n\n")}\n`), `"${q}" over its answer`);
  }
  // A thread's name heads its answers once, however many it has.
  assert.equal(llmsText.split("### About\n").length, 2);
  // The panel's link, as a full address; the contact links only under Contact.
  assert.ok(llmsText.includes("## Links\n\n- [The card](https://example.com/assets/og.png): Image\n"));
  assert.equal(llmsText.split("https://github.com/example").length, 2);
  // Ask being on or off changes nothing in it.
  assert.equal(llmsTxt(makeSite(sampleConfig({ host: "static" }))), llmsText);
});

test("llms.txt links into a site under a path, and leaves the Links section out when there are none", () => {
  const siteUnderPath = makeSite(sampleConfig({ url: "https://example.github.io/portfolio/" }));
  assert.ok(llmsTxt(siteUnderPath).includes("](https://example.github.io/portfolio/assets/og.png): Image"));
  const withoutPanel = sampleConfig();
  for (const language of Object.values(withoutPanel.languages)) language.panel = {};
  assert.ok(!llmsTxt(makeSite(withoutPanel)).includes("## Links"));
});

test("Ask's answers have a figure's words, each block on a line of its own", () => {
  const answers = englishAnswersInAskJson(sampleConfigWithAsk());
  const workText = answers.find((answer) => answer.id === "work.1")?.text ?? "";
  for (const line of [
    "Time to load: Before 1.04 s, After 385 ms (63% faster)",
    "The pipeline: Draft (by a model) → Publish",
    "“Sam got it done.” (A coworker)",
    "The card:",
  ]) {
    assert.ok(workText.split("\n").includes(line), `"${line}" is a line of ${workText}`);
  }
});

test("a picture's caption and a link's name are labels in Ask's answers, which Ask reads but doesn't quote", () => {
  const site = makeSite(sampleConfigWithAsk());
  const workText = plainAnswers(site, "en").find((answer) => answer.id === "work.1")?.text ?? "";
  const labels = workText.split("\n").filter(isLabel);
  assert.ok(labels.includes(labelled("picture", "The card, as shared.")), workText);
  assert.ok(labels.includes(labelled("picture", "Once more.")), workText);
  assert.ok(labels.includes(labelled("link", "The card")), workText);
  for (const label of labels) {
    const piece = numbered(workText).find(({ text }) => text === label);
    assert.ok(piece && piece.n === undefined, `"${label}" has no number to quote it by`);
  }
});

test("a card's rows are each a line of Ask's answers, which Ask can quote", () => {
  const site = makeSite(sampleConfigWithAsk());
  // Never two rows on one line: "company: Acme; role: Engineer".
  const twoRowsOnALine = /^\w+: [^\n]*; \w+: /m;
  for (const { text } of plainAnswers(site, "en")) assert.ok(!twoRowsOnALine.test(text), text);
});

test("no reply Ask can quote from this site opens by pointing back at a line it left out", () => {
  const site = makeSite(ownConfig);
  for (const code of site.codes) {
    for (const { id, text } of plainAnswers(site, code)) {
      const pieces = numbered(text);
      for (const [pieceIndex, piece] of pieces.entries()) {
        if (piece.n === undefined) continue;
        const reply = quote(text, [piece.n])?.reply;
        const firstNeeded = pieces[neededFor(pieces, pieceIndex)?.[0] ?? -1];
        assert.ok(
          firstNeeded && !pointsBack(firstNeeded),
          `${code} ${id}: "${piece.text}" would start at "${firstNeeded?.text}"`,
        );
        if (reply !== undefined) assert.ok(reply.startsWith(firstNeeded.text), `${code} ${id}: ${reply}`);
      }
    }
  }
});

// ---- Hosts and addresses ---------------------------------------------------------------

test("The policy lets frames come from the viewer's sites, each once, and from nowhere without a viewer", () => {
  const viewer = {
    "https://docs.example.com/d/1/edit": "https://docs.example.com/d/1/preview",
    "https://docs.example.com/d/2/edit": "https://docs.example.com/d/2/preview",
    "https://a.example.org/x": "https://a.example.org/embed/x",
  };
  assert.deepEqual(frameOrigins(viewer), ["https://a.example.org", "https://docs.example.com"]);
  assert.deepEqual(frameOrigins(), []);
  const frameDirective = "frame-src https://a.example.org https://docs.example.com";
  assert.ok(
    contentSecurityPolicy({ ask: false, frames: frameOrigins(viewer) })
      .split("; ")
      .includes(frameDirective),
  );
  assert.doesNotMatch(contentSecurityPolicy({ ask: true }), /frame-src/);
  // The host's _headers file, and a page that carries its own policy, both get it.
  assert.ok(headersFile(makeSite(sampleConfig({ viewer })))?.includes(frameDirective));
  assert.ok(pagePolicy(makeSite(sampleConfig({ viewer, host: "static" })))?.includes(frameDirective));
  // Everything else stays shut: no other source gains the viewer's sites.
  for (const directive of contentSecurityPolicy({ ask: true, frames: frameOrigins(viewer) }).split("; ")) {
    if (!directive.startsWith("frame-src")) assert.doesNotMatch(directive, /example\.(com|org)/, directive);
  }
});

test("HSTS adds includeSubDomains and preload only when a site asks, and preload needs both", () => {
  const strictTransportSecurityFor = (hsts?: SiteConfig["hsts"]) =>
    Object.fromEntries(securityHeaders({ ask: false, hsts }))["Strict-Transport-Security"];
  assert.equal(strictTransportSecurityFor(), "max-age=63072000");
  assert.equal(strictTransportSecurityFor({ includeSubDomains: true }), "max-age=63072000; includeSubDomains");
  assert.equal(
    strictTransportSecurityFor({ includeSubDomains: true, preload: true }),
    "max-age=63072000; includeSubDomains; preload",
  );
  assert.deepEqual(problemsIn(sampleConfig({ hsts: { preload: true } })), [
    "hsts.preload needs hsts.includeSubDomains too (browsers only preload a whole domain)",
  ]);
});

test("A host that reads _headers gets exactly the security headers there, and the others carry the policy in the page", () => {
  for (const host of HOSTS) {
    const site = makeSite(sampleConfig({ host }));
    const file = headersFile(site);
    const policy = pagePolicy(site);
    if (host === "cloudflare" || host === "netlify") {
      const lines = securityHeaders({ ask: false }).map(([name, value]) => `  ${name}: ${value}`);
      assert.equal(file, `/*\n${lines.join("\n")}\n`, host);
      assert.equal(policy, null, host);
    } else {
      assert.equal(file, null, host);
      assert.equal(policy, contentSecurityPolicy({ ask: false, meta: true }), host);
      // frame-ancestors only works as a header.
      assert.doesNotMatch(policy ?? "", /frame-ancestors/);
    }
  }
});

test("A site under a path links to everything under it, and one at the root from the root", () => {
  const siteUnderPath = makeSite(sampleConfig({ url: "https://example.github.io/portfolio" }));
  assert.equal(siteUnderPath.link("/assets/og.png"), "/portfolio/assets/og.png");
  assert.equal(siteUnderPath.link("#about"), "#about");
  assert.equal(siteUnderPath.link("https://example.com/"), "https://example.com/");
  assert.equal(siteUnderPath.address("/assets/og.png"), "https://example.github.io/portfolio/assets/og.png");
  assert.equal(siteUnderPath.path("en"), "/portfolio/");
  assert.equal(siteUnderPath.path("fr"), "/portfolio/fr/");
  assert.equal(siteUnderPath.url("fr"), "https://example.github.io/portfolio/fr/");
  const siteAtRoot = makeSite(sampleConfig());
  assert.equal(siteAtRoot.link("/assets/og.png"), "/assets/og.png");
  assert.equal(siteAtRoot.path("fr"), "/fr/");
  assert.equal(siteAtRoot.url("en"), "https://example.com/");
});

test("Ask's questions go where wrangler.jsonc runs the Worker first", () => {
  assert.match(
    readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"),
    new RegExp(`"run_worker_first": \\[[^\\]]*"${ASK_PATH}"`),
  );
});

test("The stylesheet's addresses start at the site's root, and name files that exist", () => {
  /** A url(…) in the stylesheet, quoted or not; its second group is the address. */
  const cssUrl = /url\((["']?)([^"')]+)\1\)/g;
  const paths = [...stylesheet.matchAll(cssUrl)].map(([, , path = ""]) => path);
  assert.ok(paths.length > 0);
  for (const path of paths) {
    assert.match(path, /^\/(?!\/)/, path);
    assert.ok(existsSync(join(ROOT, "public", path)), `${path} isn't in public/`);
  }
});
