/* What the built site has, read from its main page with JavaScript off: its
   threads, sidebar groups, panel, languages, the question card (and its
   personal answers), the script's wording and whether Ask is on. The checks
   look for these, never for one site's content, so they run on any
   site.config.ts. */
import type { Browser, Page } from "playwright";
import { CLOCK_MOODS, type ClockMood } from "../../src/shared/config.ts";
import {
  DATA,
  HOURS,
  LOCAL_ZONE,
  PAGE_CLASSES,
  PAGE_IDS,
  SCRIPT_STRINGS,
  dataAttribute,
  type GreetingPart,
  type PersonalAnswer,
  type QuestionCard,
  type ScriptStrings,
  type Topic,
} from "../../src/shared/page-data.ts";
import { CLASS as SCRIPT_CLASS } from "../../src/app/constants.ts";
import type { Attributed } from "./helpers.ts";

// ---- The page's names, as selectors ------------------------------------------------------
// The names themselves (ids, data-* attributes, classes, the clock's local
// zone, the menus' letters, the hours of the day) are in src/shared/page-data.ts.

/** PAGE_IDS as selectors: ID.hello is "#hello". */
export const ID = Object.fromEntries(Object.entries(PAGE_IDS).map(([key, id]) => [key, `#${id}`])) as {
  [K in keyof typeof PAGE_IDS]: string;
};

/** The classes of the page's parts (PAGE_CLASSES) and of what the script
    makes (src/app/constants.ts), as selectors: CLASS.thread is ".thread". */
export const CLASS = Object.fromEntries(
  Object.entries({ ...PAGE_CLASSES, ...SCRIPT_CLASS }).map(([key, name]) => [key, `.${name}`]),
) as { [K in keyof typeof PAGE_CLASSES | keyof typeof SCRIPT_CLASS]: string };

// ---- The site ----------------------------------------------------------------------------

export type Thread = { id: string; title: string; questions: string[]; answers: string[] };

export type Site = {
  /** The main page's address, base path included. */
  home: string;
  /** An address on the site, from the main page: "./", "#about", or a link
      read from the page. */
  url(path: string): string;
  lang: string;
  words: ScriptStrings;
  /** Where /ask is, or null when Ask is off. */
  ask: string | null;
  /** The address the page sends questions to, to stand in for. */
  askUrl: string;
  /** Why the Ask checks can't run, or null. */
  noAsk: string | null;
  name: string;
  tagline: string | null;
  greetings: Record<GreetingPart, string | null>;
  /** The questions to start with on the home screen: what each says, and
      the answer it gets ("work.2"). */
  prompts: Array<{ q: string; answer: string }>;
  /** The threads with a figure in them (stats, bars or a flow). */
  figureTabs: string[];
  threads: Thread[];
  /** The threads to work in: A, B for answers from another tab, and C for
      another tab to go to (none when there's only one). */
  A: Thread;
  B: Thread;
  C: Thread | undefined;
  groups: Array<{ id: string; tabs: string[] }>;
  /** A sidebar group with tabs in it, to fold. */
  foldingGroup: { id: string; tabs: string[] } | undefined;
  /** The panel's sections, in order. */
  panel: string[];
  questions: QuestionCard;
  personalTopic: Topic | undefined;
  hiddenAnswers: PersonalAnswer[];
  shownAnswers: PersonalAnswer[];
  /** The other languages' pages. */
  languages: Array<{ href: string; lang: string }>;
  languageLink: string | null;
  clock: {
    zone: string;
    same: string;
    ahead: string;
    behind: string;
    moods: Record<ClockMood, string>;
  } | null;
  /** Whether a thread has a status line ("Read …"). */
  statusLine: boolean;
};

async function attribute(page: Page, selector: string, name: string): Promise<string | null> {
  const el = page.locator(selector).first();
  return (await el.count()) ? el.getAttribute(name) : null;
}

// A thread's questions (without the "Question:" said to screen readers), and
// the text of the answer after each.
async function readThread(page: Page, id: string): Promise<Thread | null> {
  const tab = page.locator(`article${CLASS.tab}[id="${id}"]`);
  if (!(await tab.count())) return null;
  const questions: string[] = [];
  const answers: string[] = [];
  for (const node of await tab.locator(`${CLASS.thread} > *`).all()) {
    const text = (await node.textContent()) ?? "";
    if ((await node.getAttribute("class"))?.split(" ").includes(PAGE_CLASSES.question)) {
      const sr = (await node.locator(CLASS.srOnly).allTextContents()).join("");
      questions.push(text.replace(sr, "").trim());
      answers.push("");
    } else if (answers.length) answers[answers.length - 1] += text;
  }
  const title = ((await tab.locator("h2").first().textContent()) ?? "").trim();
  return questions.length ? { id, title, questions, answers } : null;
}

/** Reads the site served at `home`. */
export async function readSite(browser: Browser, home: string): Promise<Site> {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(home);
  const html = (name: string) => attribute(page, "html", name);

  const words = {} as ScriptStrings;
  for (const key of SCRIPT_STRINGS) words[key] = (await html(`data-${dataAttribute(key)}`)) ?? "";

  const threads: Thread[] = [];
  const rows = `${ID.tabs} ${CLASS.nav} a[href^='#'], ${ID.tabs} ${CLASS.tabs} > li > a`;
  for (const row of await page.locator(rows).all()) {
    const thread = await readThread(page, ((await row.getAttribute("href")) ?? "").slice(1));
    if (thread) threads.push(thread);
  }
  const [A] = threads;
  if (!A) throw new Error("The page's sidebar lists no threads");

  const groups: Site["groups"] = [];
  for (const group of await page.locator(`${ID.tabs} ${CLASS.group}`).all()) {
    const id = (await group.getAttribute("id")) ?? "";
    const links = page.locator(`[id="${id}"] + ul a`);
    const tabs = await links.evaluateAll((all: Attributed[]) =>
      all.map((a) => (a.getAttribute("href") ?? "").slice(1)),
    );
    groups.push({ id, tabs });
  }
  const languages: Site["languages"] = [];
  for (const link of await page.locator(`${ID.tabs} ${CLASS.lang} a`).all()) {
    languages.push({
      href: (await link.getAttribute("href")) ?? "",
      lang: (await link.getAttribute("hreflang")) ?? "",
    });
  }

  const clockAt = `[${DATA.clock}]`;
  const said = async (name: string) => (await attribute(page, clockAt, name)) ?? "";
  let clock: Site["clock"] = null;
  if (await page.locator(clockAt).count()) {
    const moods = {} as Record<ClockMood, string>;
    for (const mood of CLOCK_MOODS) moods[mood] = await said(DATA.mood(mood));
    const theirs = `${clockAt} [${DATA.zone}]:not([${DATA.zone}="${LOCAL_ZONE}"])`;
    clock = {
      zone: (await attribute(page, theirs, DATA.zone)) ?? "UTC",
      same: await said(DATA.same),
      ahead: await said(DATA.ahead),
      behind: await said(DATA.behind),
      moods,
    };
  }
  // The greetings for each part of the day, around the home screen's.
  const greetings = {} as Site["greetings"];
  for (const part of Object.keys(HOURS.greeting) as GreetingPart[]) {
    greetings[part] = await page.locator(ID.hello).locator("..").getAttribute(DATA.greet(part));
  }
  const prompts: Site["prompts"] = [];
  for (const prompt of await page.locator(`${CLASS.prompts} [${DATA.prompt}]`).all()) {
    prompts.push({
      q: ((await prompt.textContent()) ?? "").trim(),
      answer: (await prompt.getAttribute(DATA.prompt)) ?? "",
    });
  }
  const sections = page.locator(`${ID.details} > section`);
  const questions = JSON.parse((await page.locator(ID.questions).textContent()) ?? "") as QuestionCard;
  const ask = await html(DATA.ask);

  const site: Site = {
    home,
    url: (path) => new URL(path, home).href,
    lang: (await html("lang")) ?? "",
    words,
    ask,
    // Where the page's fetch() goes: data-ask, from the page.
    askUrl: new URL(ask ?? "ask", home).href,
    noAsk: ask ? null : "Ask is off",
    name: ((await page.locator(CLASS.wordmark).first().textContent()) ?? "").trim(),
    tagline: await attribute(page, `[${DATA.tagline}]`, DATA.tagline),
    greetings,
    prompts,
    figureTabs: await page
      .locator(`article${CLASS.tab}:has(${CLASS.figure})`)
      .evaluateAll((all: Attributed[]) => all.map((tab) => tab.getAttribute("id") ?? "")),
    threads,
    A,
    B: threads[1] ?? A,
    C: threads.find((thread) => thread.id !== A.id),
    groups,
    foldingGroup: groups.find((group) => group.tabs.length),
    panel: await sections.evaluateAll((all: Attributed[]) => all.map((s) => s.getAttribute("aria-labelledby") ?? "")),
    questions,
    personalTopic: questions.topics.find((topic) => topic.personal),
    hiddenAnswers: questions.personal.filter((item) => item.hidden),
    shownAnswers: questions.personal.filter((item) => !item.hidden),
    languages,
    languageLink: await attribute(page, `[${DATA.langLink}]`, "href"),
    clock,
    statusLine: (await page.locator(`${CLASS.tab} .status summary b`).count()) > 0,
  };
  await context.close();
  return site;
}
