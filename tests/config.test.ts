/* The config's checks and what's built from it as text (llms.txt, Ask's
   answers, the host's headers), on a sample site defined here so they hold
   in any repo, and the checks on this repo's own config. */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import config from "../site.config.ts";
import { ASK_PATH, isLabel, labelled } from "../src/shared/ask.ts";
import { HOSTS, PAGE_STRINGS } from "../src/shared/config.ts";
import type { Language, SiteConfig, Strings } from "../src/shared/config.ts";
import type { Block, Card } from "../src/shared/content.ts";
import { hrefsIn, plainText, spans } from "../src/shared/markdown.ts";
import { contentSecurityPolicy, securityHeaders } from "../src/shared/headers.ts";
import { SCRIPT_STRINGS } from "../src/shared/page-data.ts";
import { askIndex, plainAnswers } from "../src/site/answers.ts";
import { numbered } from "../src/worker/ask/quote.ts";
import { barLength } from "../src/site/bars.ts";
import { cardRows } from "../src/site/card.ts";
import { ROOT } from "../src/site/constants.ts";
import { headersFile, pagePolicy } from "../src/site/hosts.ts";
import { llms } from "../src/site/llms.ts";
import { scriptJson } from "../src/site/script-json.ts";
import { makePage, makeSite } from "../src/site/site.ts";
import { structuredData } from "../src/site/structured-data.ts";
import { iconsIn, isSafeHref, validate } from "../src/site/validate.ts";

// The stylesheet's parts, as one text: the icons a config can name are its .i-* classes.
const STYLES = join(ROOT, "src", "styles");
const css = readdirSync(STYLES)
  .map((file) => readFileSync(join(STYLES, file), "utf8"))
  .join("\n");
const icons = iconsIn(css);

// ---- A sample site ---------------------------------------------------------------------

/** One language of the sample: two threads, a file card, a figure of each
    kind, a question to start with on the home screen, and links to a file
    on the site from the text, a link card and the panel. */
function sampleLanguage(label: string, locale: string): Language {
  const keys = [...PAGE_STRINGS, ...SCRIPT_STRINGS];
  const strings = { ...Object.fromEntries(keys.map((key) => [key, key])), status: "Read {file}" } as Strings;
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

/** The sample, with `change` made to it. */
function sample(change: Partial<SiteConfig> = {}): SiteConfig {
  return {
    url: "https://example.com",
    name: "Sam Sample",
    timezone: "UTC",
    links: { email: "sam@example.com", github: "https://github.com/example" },
    social: { image: "/assets/og.png", width: 1200, height: 630 },
    themeColor: "#191919",
    llms: { summary: "A sample.", about: "Sam is a sample." },
    languages: { en: sampleLanguage("EN", "en_US"), fr: sampleLanguage("FR", "fr_FR") },
    ...change,
  };
}

/** The problems validation finds once `change` is made to the sample. */
function problemsAfter(change: (site: SiteConfig, lang: Language) => void): string[] {
  const site = sample();
  const lang = site.languages.en;
  assert.ok(lang);
  change(site, lang);
  return validate(makeSite(site), icons).problems;
}

/** The problems validation finds once `change` is made to every language
    of the sample, so they still match. */
const problemsInEvery = (change: (lang: Language) => void): string[] =>
  problemsAfter((site) => Object.values(site.languages).forEach(change));

/** The problems validation finds once `block` is added to the answer in
    the sample's "work" thread, in one language. */
function problemsInWork(block: Block): string[] {
  return problemsAfter((_, lang) => {
    const answer = lang.threads.find((t) => t.id === "work")?.messages[0]?.a;
    assert.ok(answer);
    answer.push(block);
  });
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
    const unsafe = hrefsIn(text).filter((href) => !isSafeHref(href));
    const problems = problemsAfter((_, lang) => (lang.home.intro = text));
    assert.equal(problems.length > 0, unsafe.length > 0, `${text}: ${problems.join("; ")}`);
  }
});

test("Validation refuses a link the script would show as words, in the text it shows", () => {
  assert.deepEqual(
    problemsAfter((site) => {
      for (const lang of Object.values(site.languages)) {
        const fun = lang.questions.personal[0];
        assert.ok(fun);
        fun.a = ["My [resume](/resume.pdf)."];
      }
    }),
    ["en", "fr"].map(
      (code) =>
        `${code}: a link in "My [resume](/resume.pdf)." goes to "/resume.pdf", but the script shows this text, and only follows #tab, web and mailto links`,
    ),
  );
});

// ---- Validation ------------------------------------------------------------------------

test("This site's config has no problems", () => {
  assert.deepEqual(validate(makeSite(config), icons).problems, []);
});

test("The sample has no problems, on every host", () => {
  for (const host of HOSTS) assert.deepEqual(validate(makeSite(sample({ host })), icons), { problems: [], notes: [] });
});

test("A config that leaves out everything it can still validates", () => {
  const { en } = sample({ links: { email: "sam@example.com" } }).languages;
  assert.ok(en);
  const { home, account } = en;
  const bare: Language = {
    ...en,
    home: { greeting: home.greeting, intro: home.intro },
    panel: {},
    account: { ...account, language: undefined },
  };
  const site = sample({ links: { email: "sam@example.com" }, languages: { en: bare } });
  assert.deepEqual(validate(makeSite(site), icons).problems, []);
});

test("Validation catches a row that points at a thread that doesn't exist", () => {
  assert.deepEqual(
    problemsAfter((_, lang) => {
      const row = lang.sidebar.nav[0];
      assert.ok(row);
      row.tab = "nowhere";
    }),
    [`en: the sidebar's "About" points at #nowhere, which isn't a thread`],
  );
});

test("Validation catches a question to start with that names no answer", () => {
  const problems = problemsAfter((_, lang) => {
    lang.home.prompts = [{ q: "What does Sam do?", answer: "work.2" }];
  });
  assert.equal(problems.length, 2, "its own problem, and the languages no longer match");
  assert.match(
    problems.join("\n"),
    /en: the home prompt "What does Sam do\?" gets the answer "work\.2", which isn't one/,
  );
  assert.match(problems.join("\n"), /fr: its threads, questions and home prompts don't match en's/);
  // A personal answer can be one too.
  assert.deepEqual(
    problemsInEvery((lang) => (lang.home.prompts = [{ q: "For fun?", answer: "personal-fun.1" }])),
    [],
  );
});

test("Validation finds languages that don't match: threads, questions, topics, personal answers", () => {
  const mismatch = [
    `fr: its threads, questions and home prompts don't match en's (same ids, as many questions, same order)`,
  ];
  const inFrench = (change: (fr: Language) => void) =>
    problemsAfter((site) => {
      const { fr } = site.languages;
      assert.ok(fr);
      change(fr);
    });
  assert.deepEqual(
    inFrench((fr) => fr.threads.reverse()),
    mismatch,
  );
  assert.deepEqual(
    inFrench((fr) => fr.threads[1]?.messages.push({ q: "and?", a: ["More."] })),
    mismatch,
  );
  assert.deepEqual(
    inFrench((fr) => fr.questions.topics.pop()),
    mismatch,
  );
  assert.deepEqual(
    inFrench((fr) => fr.questions.personal.push({ id: "food", q: "food?", a: ["Bread."] })),
    mismatch,
  );
});

test("Validation catches bars that aren't a figure", () => {
  assert.match(
    problemsInWork({ bars: { title: "One", rows: [{ label: "Only", value: "1", amount: 1 }] } }).join("\n"),
    /has 1 bars in "One": it takes 2 to 6/,
  );
  const rows = [
    { label: "Before", value: "none", amount: 0 },
    { label: "After", value: "?", amount: Number.NaN },
  ];
  const amounts = problemsInWork({ bars: { title: "Two", rows } });
  assert.equal(amounts.length, 2);
  assert.match(amounts.join("\n"), /the bar "Before" with the amount 0: it should be a number above zero/);
});

test("Validation catches a flow that isn't a figure", () => {
  assert.match(
    problemsInWork({ flow: { title: "Short", steps: [{ name: "Only" }] } }).join("\n"),
    /has 1 steps in "Short": it takes 2 to 5/,
  );
});

test("Validation needs a picture to be a file on the site, with words for it, its size, and a safe link", () => {
  const shot = { src: "https://example.com/a.png", alt: "", width: 0, height: 630, href: "javascript:alert(1)" };
  for (const block of [{ image: shot }, { images: [shot] }]) {
    const problems = problemsInWork(block).join("\n");
    assert.match(problems, /should be a path on this site/);
    assert.match(problems, /without an alt/);
    assert.match(problems, /without its width and height/);
    assert.match(problems, /the picture "https:\/\/example\.com\/a\.png" links to "javascript:alert\(1\)"/);
  }
});

test("Validation needs a quote's words and who said them, and a heading's title", () => {
  assert.match(
    problemsInWork({ quote: { text: "Good.", by: "" } }).join("\n"),
    /a quote without its text or who said it/,
  );
  assert.match(problemsInWork({ heading: { title: "" } }).join("\n"), /a heading without a title/);
});

test("Validation refuses values that would break out of where they go", () => {
  const evil = `x" onclick="alert(1)`;
  assert.deepEqual(
    problemsAfter((site) => (site.themeColor = evil)),
    [`themeColor should be a colour, like "#191919"`],
  );
  for (const url of ["javascript:alert(1)", "https://example.com/?q=1", "https://example.com/#top"]) {
    assert.deepEqual(
      problemsAfter((site) => (site.url = url)),
      [`url should be the site's address, like "https://example.com"`],
      url,
    );
  }
  assert.deepEqual(
    problemsAfter((_, lang) => (lang.locale = evil)),
    [`en: locale should look like "en_US"`],
  );
  assert.deepEqual(
    problemsAfter((_, lang) => {
      const group = lang.sidebar.groups[0];
      assert.ok(group);
      group.id = evil;
    }),
    [`en: the sidebar's group id "${evil}" should be lowercase letters, digits and dashes`],
  );
  // A language's code is its page's folder too.
  assert.deepEqual(
    problemsAfter((site, lang) => (site.languages["../elsewhere"] = structuredClone(lang))),
    [`"../elsewhere" should be a language code like "en" or "pt-BR" (it's also the name of its page's folder)`],
  );
});

test("Validation reports an address that isn't the site's, rather than failing on it", () => {
  for (const url of ["example.com", "", "https://example.com//", "https://example.com/portfolio//x/"]) {
    assert.deepEqual(
      problemsAfter((site) => (site.url = url)),
      [`url should be the site's address, like "https://example.com"`],
      url,
    );
  }
  for (const url of ["https://example.com/", "https://example.github.io/portfolio", "https://x.io/a/b/"]) {
    assert.deepEqual(
      problemsAfter((site) => (site.url = url)),
      [],
      url,
    );
  }
});

test("Validation refuses a time zone the browser's clock doesn't know", () => {
  assert.deepEqual(
    problemsAfter((site) => (site.timezone = "Tokyo")),
    [`timezone should be a time zone, like "Asia/Tokyo" or "UTC"`],
  );
  assert.deepEqual(
    problemsAfter((site) => (site.timezone = "Asia/Tokyo")),
    [],
  );
});

test("Validation checks personal answer ids as it does thread ids, and for twins", () => {
  const ids = (...list: string[]) =>
    problemsInEvery((lang) => {
      lang.questions.personal = list.map((id) => ({ id, q: "Why?", a: ["Because."] }));
    });
  assert.deepEqual(ids("My.Food"), [
    `en: the personal answer id "My.Food" should be lowercase letters, digits and dashes`,
    `fr: the personal answer id "My.Food" should be lowercase letters, digits and dashes`,
  ]);
  assert.deepEqual(ids("food", "food"), [
    "en: two personal answers have the same id",
    "fr: two personal answers have the same id",
  ]);
});

test("Validation refuses a thread id the page would also give a tab's title", () => {
  const problems = problemsInEvery((lang) => {
    lang.threads.push({ id: "about-title", title: "Twin", messages: [{ q: "a?", a: ["b."] }] });
  });
  assert.deepEqual(problems, [
    `en: "about-title" is used by the page itself; pick another thread id`,
    `fr: "about-title" is used by the page itself; pick another thread id`,
  ]);
});

test("Validation needs the words the page fills in, and the language row on a site with two", () => {
  assert.deepEqual(
    problemsAfter((_, lang) => {
      lang.strings.status = "Read";
      lang.asked.email = "Hello";
    }),
    [
      "en: asked.email should have {question} in it, where the question goes",
      `en: strings.status should have {file} in it, where the file goes ("Read {file}")`,
    ],
  );
  assert.deepEqual(
    problemsInEvery((lang) => delete lang.account.language),
    ["en", "fr"].map(
      (code) => `${code}: account.language is missing: the account menu's row that opens the other language`,
    ),
  );
  assert.deepEqual(
    problemsAfter((site) => {
      delete site.languages.fr;
      delete site.languages.en?.account.language;
    }),
    [],
  );
});

test("Validation checks a #thread link wherever there's Markdown", () => {
  assert.deepEqual(
    problemsAfter((_, lang) => {
      lang.home.intro = "See [this](#nowhere).";
      lang.asked.answer = "Or [that](#elsewhere).";
    }),
    [
      "en: a link in the text points at #nowhere, which isn't a thread",
      "en: a link in the text points at #elsewhere, which isn't a thread",
    ],
  );
});

test("Validation refuses links that would run code", () => {
  assert.deepEqual(
    problemsAfter((_, lang) => (lang.home.intro = "[hi](javascript:run)")),
    [
      `en: a link in "[hi](javascript:run)" links to "javascript:run", which should be a web, mailto, #thread or relative address`,
    ],
  );
  const href = "java\nscript:alert(1)";
  assert.deepEqual(
    problemsAfter((_, lang) =>
      lang.threads[0]?.messages[0]?.a.push({ link: { name: "x", kind: "y", href, icon: "file" } }),
    ),
    [`en: the link card "x" links to "${href}", which should be a web, mailto, #thread or relative address`],
  );
});

test("A safe link is a web, mailto, #thread or relative address, whatever its letters' case", () => {
  for (const ok of ["https://example.com", "mailto:you@example.com", "#about", "/resume.pdf", "resume.pdf"]) {
    assert.ok(isSafeHref(ok), ok);
  }
  for (const bad of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,x",
    "java\tscript:x",
    " https://x",
  ]) {
    assert.ok(!isSafeHref(bad), bad);
  }
});

test("Validation knows that Ask needs Cloudflare", () => {
  const ask = { role: "an engineer" };
  assert.deepEqual(validate(makeSite(sample({ ask })), icons).problems, []);
  for (const host of HOSTS.filter((h) => h !== "cloudflare")) {
    assert.deepEqual(validate(makeSite(sample({ ask, host })), icons).problems, [
      `ask needs Cloudflare Workers, where its Worker (src/worker) runs, but host is "${host}": remove ask, or set host to "cloudflare"`,
    ]);
  }
});

test("Ask's questions go where wrangler.jsonc runs the Worker first", () => {
  assert.match(
    readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"),
    new RegExp(`"run_worker_first": \\[[^\\]]*"${ASK_PATH}"`),
  );
});

// ---- What's built from it --------------------------------------------------------------

test("A card's comments line up, unless a value has wide characters", () => {
  // The card's lines as they show, tags aside.
  const shown = (lines: Card["lines"]) =>
    cardRows({ file: "role.yaml", lines }).map(
      (row) =>
        `${row.key ? `${row.key}:` : ""}${row.indent}${row.value}${row.comment ? `${row.beforeComment}# ${row.comment}` : ""}`,
    );
  assert.deepEqual(
    shown([
      ["company", "Acme", "a comment"],
      ["role", "Engineer", "another"],
    ]),
    ["company: Acme      # a comment", "role:    Engineer  # another"],
  );
  assert.deepEqual(
    shown([
      ["company", "アクメ", "a comment"],
      ["role", "Engineer", "another"],
    ]),
    ["company: アクメ  # a comment", "role:    Engineer  # another"],
  );
  // A list's other lines sit under its first, and an uncommented value can be any length.
  assert.deepEqual(
    shown([
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
  const site = sample({ name: "</script>Sam" });
  const person = structuredData(makePage(makeSite(site), "en"));
  assert.doesNotMatch(person, /</);
  assert.equal((JSON.parse(person) as { alternateName: string }).alternateName, "</script>Sam");
});

test("llms.txt has every answer in the main language, in Ask's words, and the panel's links", () => {
  const site = makeSite(sample({ host: "cloudflare", ask: { role: "an engineer" } }));
  const text = llms(site);
  const answers = plainAnswers(site, "en");
  assert.ok(answers.length > 2);
  for (const { title, q, text: answer } of answers) {
    assert.ok(text.includes(`### ${title}\n`), `the tab "${title}"`);
    // Each block of the answer (a line in Ask's index) is a paragraph.
    assert.ok(text.includes(`**${q}**\n\n${answer.split("\n").join("\n\n")}\n`), `"${q}" over its answer`);
  }
  // A thread's name heads its answers once, however many it has.
  assert.equal(text.split("### About\n").length, 2);
  // The panel's link, as a full address; the contact links only under Contact.
  assert.ok(text.includes("## Links\n\n- [The card](https://example.com/assets/og.png): Image\n"));
  assert.equal(text.split("https://github.com/example").length, 2);
  // Ask being on or off changes nothing in it.
  assert.equal(llms(makeSite(sample({ host: "static" }))), text);
});

test("llms.txt links into a site under a path, and leaves the Links section out when there are none", () => {
  const under = makeSite(sample({ url: "https://example.github.io/portfolio/" }));
  assert.ok(llms(under).includes("](https://example.github.io/portfolio/assets/og.png): Image"));
  const config = sample();
  for (const lang of Object.values(config.languages)) lang.panel = {};
  assert.ok(!llms(makeSite(config)).includes("## Links"));
});

test("Ask's answers have a figure's words, each block on a line of its own", () => {
  const site = makeSite(sample({ host: "cloudflare", ask: { role: "an engineer" } }));
  const index = JSON.parse(askIndex(site, "an engineer")) as { answers: { en: Array<{ id: string; text: string }> } };
  const work = index.answers.en.find((answer) => answer.id === "work.1")?.text ?? "";
  for (const said of [
    "Time to load: Before 1.04 s, After 385 ms (63% faster)",
    "The pipeline: Draft (by a model) → Publish",
    "“Sam got it done.” (A coworker)",
    "The card:",
  ]) {
    assert.ok(work.split("\n").includes(said), `"${said}" is a line of ${work}`);
  }
});

test("a picture's caption and a link's name are labels in Ask's answers, which Ask reads but doesn't quote", () => {
  const site = makeSite(sample({ host: "cloudflare", ask: { role: "an engineer" } }));
  const work = plainAnswers(site, "en").find((answer) => answer.id === "work.1")?.text ?? "";
  const labels = work.split("\n").filter(isLabel);
  assert.ok(labels.includes(labelled("picture", "The card, as shared.")), work);
  assert.ok(labels.includes(labelled("picture", "Once more.")), work);
  assert.ok(labels.includes(labelled("link", "The card")), work);
  for (const label of labels) {
    const piece = numbered(work).find(({ text }) => text === label);
    assert.ok(piece && piece.n === undefined, `"${label}" has no number to quote it by`);
  }
});

test("a card's rows are each a line of Ask's answers, which Ask can quote", () => {
  const site = makeSite(sample({ host: "cloudflare", ask: { role: "an engineer" } }));
  for (const { text } of plainAnswers(site, "en")) assert.ok(!/^\w+: [^\n]*; \w+: /m.test(text), text);
});

// ---- Hosts and addresses ---------------------------------------------------------------

test("HSTS adds includeSubDomains and preload only when a site asks, and preload needs both", () => {
  const sts = (hsts?: SiteConfig["hsts"]) =>
    Object.fromEntries(securityHeaders({ ask: false, hsts }))["Strict-Transport-Security"];
  assert.equal(sts(), "max-age=63072000");
  assert.equal(sts({ includeSubDomains: true }), "max-age=63072000; includeSubDomains");
  assert.equal(sts({ includeSubDomains: true, preload: true }), "max-age=63072000; includeSubDomains; preload");
  assert.deepEqual(validate(makeSite(sample({ hsts: { preload: true } })), icons).problems, [
    "hsts.preload needs hsts.includeSubDomains too (browsers only preload a whole domain)",
  ]);
});

test("A host that reads _headers gets exactly the security headers there, and the others carry the policy in the page", () => {
  for (const host of HOSTS) {
    const site = makeSite(sample({ host }));
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
  const under = makeSite(sample({ url: "https://example.github.io/portfolio" }));
  assert.equal(under.link("/assets/og.png"), "/portfolio/assets/og.png");
  assert.equal(under.link("#about"), "#about");
  assert.equal(under.link("https://example.com/"), "https://example.com/");
  assert.equal(under.address("/assets/og.png"), "https://example.github.io/portfolio/assets/og.png");
  assert.equal(under.path("en"), "/portfolio/");
  assert.equal(under.path("fr"), "/portfolio/fr/");
  assert.equal(under.url("fr"), "https://example.github.io/portfolio/fr/");
  const root = makeSite(sample());
  assert.equal(root.link("/assets/og.png"), "/assets/og.png");
  assert.equal(root.path("fr"), "/fr/");
  assert.equal(root.url("en"), "https://example.com/");
});

test("The stylesheet's addresses start at the site's root, and name files that exist", () => {
  const urls = [...css.matchAll(/url\((["']?)([^"')]+)\1\)/g)].map(([, , path = ""]) => path);
  assert.ok(urls.length > 0);
  for (const path of urls) {
    assert.match(path, /^\/(?!\/)/, path);
    assert.ok(existsSync(join(ROOT, "public", path)), `${path} isn't in public/`);
  }
});
