/* What the browser checks know of the site they run on.

   First the page's names, as selectors: ID and CLASS. Then what the built
   site has (Site), which readSite() reads from its main page with JavaScript
   off: its threads, sidebar groups, panel, languages, the question card and
   its personal answers, the script's wording, whether Ask is on, and the
   parts only some sites have. The checks look for these, never for one
   site's content, so they run on any site.config.ts. */
import { mapValues } from "es-toolkit";
import type { Browser, Page } from "playwright";
import { SELECTOR } from "../../src/app/constants.ts";
import { threadAnswerId } from "../../src/contracts/ask.ts";
import { CLOCK_MOODS, type ClockMood, type Prompt } from "../../src/config/language.ts";
import { SCRIPT_STRING_NAMES, SCRIPT_STRING_ATTRIBUTES, type ScriptStrings } from "../../src/config/strings.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { HOURS, type GreetingPart } from "../../src/contracts/day-parts.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { PAGE_IDS } from "../../src/contracts/page-ids.ts";
import { type PersonalAnswer, type QuestionCard, type Topic } from "../../src/config/question-card.ts";
// Its types only. helpers.ts builds its selectors from the ones here, so a
// function imported back from it would have each file waiting for the other.
import type { PageElement } from "./helpers.ts";

// ---- The page's names, as selectors ------------------------------------------------------
// The names themselves (ids, data-* attributes, classes, the clock's local
// zone, the menus' letters, the hours of the day) are in src/contracts.

/** PAGE_IDS as selectors: ID.greeting is "#hello". */
export const ID = mapValues(PAGE_IDS, (id) => `#${id}`);

/** The page's classes (PAGE_CLASSES), as selectors: CLASS.thread is
    ".thread". */
export const CLASS = mapValues(PAGE_CLASSES, (name) => `.${name}`);

/** The details panel's sections, in the order the page has them. */
export const PANEL_SECTIONS = `${ID.panel} > section`;

/** The tab a link on the page opens: "about" for href="#about". */
export const tabIdOf = (href: string | null): string => (href ?? "").slice(1);

// A thread's or a personal answer's tab, as the build wrote it. (The chats'
// tabs are the script's, and no page has one with JavaScript off.)
const BUILT_TAB = `article${CLASS.tab}`;

// ---- What the site has -------------------------------------------------------------------

/** One of the site's threads: a tab of questions, each with its answer. */
export type Thread = {
  /** Its tab's id: "about", for the tab at "#about". */
  id: string;
  /** Its tab's title, as the page is built: a visitor can rename it. */
  title: string;
  /** Its questions in order, without the "Question: " said to screen
      readers. Never empty. */
  questions: string[];
  /** The text that answers each: answers[0] is all there is between
      questions[0] and the next question. */
  answers: string[];
};

/** A group of tabs in the sidebar: its heading's id ("group-work"), and the
    ids of the tabs under it. */
export type SidebarGroup = { id: string; tabs: string[] };

/** Another language's page: where the sidebar's link to it goes, and its
    language ("ja"). */
export type LanguagePage = { href: string; lang: string };

/** The account menu's clock: the owner's time beside the visitor's. */
export type Clock = {
  /** The owner's time zone ("Asia/Kolkata"); "UTC" when the clock names none. */
  zone: string;
  /** Its note on how far apart the two are: when they're in the same hour,
      and when the owner is ahead or behind, with "{n}" for the hours. */
  same: string;
  ahead: string;
  behind: string;
  /** What it says of each part of the owner's day. */
  moods: Record<ClockMood, string>;
};

/** A link in a thread that opens in the viewer (the config's `viewer`). */
export type ViewerLink = {
  /** The tab it's in. */
  tab: string;
  /** Where it links: what "Open in a new tab" goes to. */
  href: string;
  /** The address the viewer shows it at, in its frame. */
  shown: string;
  /** What the viewer calls it. */
  title: string;
};

/** The tab with the most quotes and file cards in it: what comes in as
    it's scrolled to (src/app/seen.ts). */
export type ComesIntoView = {
  tab: string;
  /** The answer the last of them is in, as /ask names it ("about.4"). */
  answer: string;
};

/** A picture a visitor plays: it rests as its still, with a Play button
    that links to the picture as it moves. */
export type PlayedPicture = {
  /** The tab it's in, and its place among that tab's played pictures
      (from 0). */
  tab: string;
  index: number;
  /** The answer it's in, as /ask names it ("about.1"). */
  answer: string;
  /** Its two files, as the page has them: the one its button links to,
      and the still it shows. */
  moving: string;
  still: string;
};

/** A picture that moves all the time, with the still of itself that a
    visitor who wants less motion is shown instead. */
export type MovingPicture = {
  /** The tab it's in, and its place among that tab's moving pictures
      (from 0). */
  tab: string;
  index: number;
  /** Its two files, as the page has them: the one that moves, and the
      still. */
  moving: string;
  still: string;
};

/** What the built site has. Every check is given this, and looks for
    nothing else. A part that only some sites have is null, undefined or
    empty here on a site without it, and a check that needs it sets `skip`. */
export type Site = {
  /** The main page's address, base path included
      ("http://127.0.0.1:4321/portfolio/"). */
  home: string;
  /** An address on the site, from the main page: "./", "#about", or a link
      read from the page. */
  url(path: string): string;
  /** The main page's language, as its <html lang> has it ("en"). */
  lang: string;
  /** The script's wording in that language. A string the page doesn't
      carry (for a part the site doesn't have) is "". */
  words: ScriptStrings;

  /** Where /ask is, as the page has it; null when Ask is off. */
  ask: string | null;
  /** The address the page sends a typed question to, for askReturns() to
      stand in for. With Ask off the page asks nothing, and this is where
      /ask would be. */
  askUrl: string;
  /** Why the checks that need Ask can't run ("Ask is off"), for their
      `skip`; null when it's on. */
  noAsk: string | null;

  /** Whose site it is: the name at the top of the sidebar, which ends every
      window title. */
  name: string;
  /** Who they are in one line, at the top of a new chat; null on a site
      without one. */
  tagline: string | null;
  /** The home screen's greeting for each part of the visitor's day; null
      for a part the page has none for. */
  greetings: Record<GreetingPart, string | null>;
  /** The questions to start with on the home screen: what each says, and
      the answer it gets ("work.2"). Empty on a site without any. */
  prompts: Prompt[];
  /** The ids of the tabs with a figure in them (stats, bars or a flow).
      Empty on a site without figures. */
  figureTabs: string[];

  /** The threads the sidebar lists, in its order: one it lists twice is
      here twice. Never empty (readSite throws on a page without one). */
  threads: Thread[];
  /** The thread most checks work in: the sidebar's first. */
  A: Thread;
  /** The sidebar's second thread, for an answer from another tab. It's A
      again on a site with one thread, so a check that needs two compares
      their ids. */
  B: Thread;
  /** Another tab to go to and come back from: the first thread that isn't
      A. Undefined when the sidebar has one thread. */
  C: Thread | undefined;
  /** The sidebar's groups of tabs, in order. Empty on a sidebar without
      groups. */
  groups: SidebarGroup[];
  /** A group with tabs in it, to fold; undefined when there's none. */
  foldingGroup: SidebarGroup | undefined;
  /** The details panel's sections, in order: the id of each one's heading
      ("panel-context"). */
  panel: string[];

  /** The question card, as the page carries it. */
  questions: QuestionCard;
  /** The card's topic that lists the personal answers; undefined on a card
      without one. */
  personalTopic: Topic | undefined;
  /** The personal answers the card doesn't list (/ask can still pick one),
      and those it does. Either can be empty. */
  hiddenAnswers: PersonalAnswer[];
  shownAnswers: PersonalAnswer[];

  /** The other languages' pages, from the sidebar's links. Empty on a site
      in one language. */
  languages: LanguagePage[];
  /** Where the account menu's language row goes, as the page is built (the
      script adds the open tab to it); null on a site in one language. */
  languageLink: string | null;
  /** The account menu's clock; null on a site without one. */
  clock: Clock | null;
  /** Whether a thread has a status line ("Read …"). */
  statusLine: boolean;
  /** The first link in a thread that opens in the viewer; null on a site
      without one. */
  viewer: ViewerLink | null;
  /** The pictures that move all the time. Empty on a site without one. */
  movingPictures: MovingPicture[];
  /** The pictures a visitor plays. Empty on a site without one. */
  playedPictures: PlayedPicture[];
  /** Where the checks of what comes in as it's scrolled to look; null on a
      site with no quote or file card in an answer. */
  comesIntoView: ComesIntoView | null;
};

// ---- Reading it from the page ------------------------------------------------------------

/** Reads the site served at `home`. */
export async function readSite(browser: Browser, home: string): Promise<Site> {
  // JavaScript off: the page as the build wrote it, before the script adds
  // to it or moves anything.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(home);

  const threads = await readThreads(page);
  const [A] = threads;
  if (!A) throw new Error("The page's sidebar lists no threads");
  const groups = await readSidebarGroups(page);
  const questions = await readQuestionCard(page);
  const ask = await readAttribute(page, "html", DATA.ask);

  const site: Site = {
    home,
    url: (path) => new URL(path, home).href,
    lang: (await readAttribute(page, "html", "lang")) ?? "",
    words: await readScriptWords(page),
    ask,
    // Where the page's fetch() goes: data-ask, from the page.
    askUrl: new URL(ask ?? "ask", home).href,
    noAsk: ask ? null : "Ask is off",
    name: ((await page.locator(CLASS.wordmark).first().textContent()) ?? "").trim(),
    tagline: await readAttribute(page, `[${DATA.tagline}]`, DATA.tagline),
    greetings: await readGreetings(page),
    prompts: await readPrompts(page),
    figureTabs: await readAttributeOfEach(page, `${BUILT_TAB}:has(${CLASS.figure})`, "id"),
    threads,
    A,
    B: threads[1] ?? A,
    C: threads.find((thread) => thread.id !== A.id),
    groups,
    foldingGroup: groups.find((group) => group.tabs.length),
    panel: await readAttributeOfEach(page, PANEL_SECTIONS, "aria-labelledby"),
    questions,
    personalTopic: questions.topics.find((topic) => topic.personal),
    hiddenAnswers: questions.personal.filter((answer) => answer.hidden),
    shownAnswers: questions.personal.filter((answer) => !answer.hidden),
    languages: await readLanguages(page),
    languageLink: await readAttribute(page, `[${DATA.langLink}]`, "href"),
    clock: await readClock(page),
    statusLine: (await page.locator(`${CLASS.tab} ${CLASS.status} summary b`).count()) > 0,
    viewer: await readViewerLink(page),
    movingPictures: await readMovingPictures(page),
    playedPictures: await readPlayedPictures(page),
    comesIntoView: await readComesIntoView(page),
  };
  await context.close();
  return site;
}

/** An attribute of the first element a selector finds: null when it finds
    nothing, or the element doesn't have the attribute. */
async function readAttribute(page: Page, selector: string, name: string): Promise<string | null> {
  const first = page.locator(selector).first();
  return (await first.count()) ? first.getAttribute(name) : null;
}

/** An attribute of every element a selector finds, in the page's order: ""
    where an element doesn't have it. */
const readAttributeOfEach = (page: Page, selector: string, name: string): Promise<string[]> =>
  page
    .locator(selector)
    .evaluateAll(
      (elements: PageElement[], attribute) => elements.map((element) => element.getAttribute(attribute) ?? ""),
      name,
    );

/** The script's wording: each string from its data-* attribute on <html>. */
async function readScriptWords(page: Page): Promise<ScriptStrings> {
  const words = {} as ScriptStrings;
  for (const key of SCRIPT_STRING_NAMES) {
    words[key] = (await readAttribute(page, "html", SCRIPT_STRING_ATTRIBUTES[key])) ?? "";
  }
  return words;
}

/** The thread each of the sidebar's rows opens: the rows at its top, then
    its groups'. A row that opens no thread (a link to another site, say)
    gives none. */
async function readThreads(page: Page): Promise<Thread[]> {
  const rows = `${ID.sidebar} ${CLASS.nav} a[href^='#'], ${ID.sidebar} ${CLASS.groupRows} > li > a`;
  const threads: Thread[] = [];
  for (const row of await page.locator(rows).all()) {
    const thread = await readThread(page, tabIdOf(await row.getAttribute("href")));
    if (thread) threads.push(thread);
  }
  return threads;
}

/** The thread in the tab `id`: null when the page has no such tab, or the
    tab asks no question. */
async function readThread(page: Page, id: string): Promise<Thread | null> {
  const tab = page.locator(`${BUILT_TAB}[id="${id}"]`);
  if (!(await tab.count())) return null;
  const questions: string[] = [];
  const answers: string[] = [];
  // A thread is a question, then what answers it (one block or several),
  // then the next question.
  for (const block of await tab.locator(`${CLASS.thread} > *`).all()) {
    const text = (await block.textContent()) ?? "";
    const isQuestion = (await block.getAttribute("class"))?.split(" ").includes(PAGE_CLASSES.question);
    if (isQuestion) {
      const saidToScreenReaders = (await block.locator(CLASS.srOnly).allTextContents()).join("");
      questions.push(text.replace(saidToScreenReaders, "").trim());
      answers.push("");
    } else if (answers.length) answers[answers.length - 1] += text;
  }
  const title = ((await tab.locator("h2").first().textContent()) ?? "").trim();
  return questions.length ? { id, title, questions, answers } : null;
}

/** The sidebar's groups: each heading, and the tabs its rows open. */
async function readSidebarGroups(page: Page): Promise<SidebarGroup[]> {
  const groups: SidebarGroup[] = [];
  for (const heading of await page.locator(`${ID.sidebar} ${CLASS.groupHeading}`).all()) {
    const id = (await heading.getAttribute("id")) ?? "";
    const hrefs = await readAttributeOfEach(page, `[id="${id}"] + ul a`, "href");
    groups.push({ id, tabs: hrefs.map(tabIdOf) });
  }
  return groups;
}

/** The other languages' pages, from the sidebar's links to them. */
async function readLanguages(page: Page): Promise<LanguagePage[]> {
  const languages: LanguagePage[] = [];
  for (const link of await page.locator(`${ID.sidebar} ${CLASS.languageSwitch} a`).all()) {
    languages.push({
      href: (await link.getAttribute("href")) ?? "",
      lang: (await link.getAttribute("hreflang")) ?? "",
    });
  }
  return languages;
}

/** The account menu's clock and its wording, or null without one. A clock
    that names no zone for the owner's time is read as UTC. */
async function readClock(page: Page): Promise<Clock | null> {
  if (!(await page.locator(SELECTOR.clock).count())) return null;
  const wording = async (attribute: string) => (await readAttribute(page, SELECTOR.clock, attribute)) ?? "";
  const moods = {} as Record<ClockMood, string>;
  for (const mood of CLOCK_MOODS) moods[mood] = await wording(DATA.mood(mood));
  return {
    zone: (await readAttribute(page, `${SELECTOR.clock} ${SELECTOR.ownerZone}`, DATA.zone)) ?? "UTC",
    same: await wording(DATA.clockSame),
    ahead: await wording(DATA.clockAhead),
    behind: await wording(DATA.clockBehind),
    moods,
  };
}

/** The greeting for each part of the day, from the attributes around the
    home screen's greeting. */
async function readGreetings(page: Page): Promise<Record<GreetingPart, string | null>> {
  const aroundTheGreeting = page.locator(ID.greeting).locator("..");
  const greetings = {} as Record<GreetingPart, string | null>;
  for (const part of Object.keys(HOURS.greeting) as GreetingPart[]) {
    greetings[part] = await aroundTheGreeting.getAttribute(DATA.greet(part));
  }
  return greetings;
}

/** The questions to start with, under the home screen's box. */
async function readPrompts(page: Page): Promise<Prompt[]> {
  const prompts: Prompt[] = [];
  for (const prompt of await page.locator(`${CLASS.prompts} ${SELECTOR.prompt}`).all()) {
    prompts.push({
      q: ((await prompt.textContent()) ?? "").trim(),
      answer: (await prompt.getAttribute(DATA.prompt)) ?? "",
    });
  }
  return prompts;
}

/** The question card: the JSON the build wrote into the page for the
    script. It's the build's own (src/config/question-card.ts's QuestionCard),
    so it's read as that, not checked. */
async function readQuestionCard(page: Page): Promise<QuestionCard> {
  return JSON.parse((await page.locator(ID.questionCardData).textContent()) ?? "") as QuestionCard;
}

/** The first link in a thread that the viewer opens, or null. */
async function readViewerLink(page: Page): Promise<ViewerLink | null> {
  // The first tab with such a link, then the first in it: the page's first.
  const tab = page.locator(`${BUILT_TAB}:has(${SELECTOR.viewLink})`).first();
  if (!(await tab.count())) return null;
  const link = tab.locator(SELECTOR.viewLink).first();
  return {
    tab: (await tab.getAttribute("id")) ?? "",
    href: (await link.getAttribute("href")) ?? "",
    shown: (await link.getAttribute(DATA.viewerAddress)) ?? "",
    title: (await link.getAttribute(DATA.viewerTitle)) ?? "",
  };
}

/** A figure whose picture a visitor plays, and in it its Play button and
    the picture as it moves, once that has loaded and shows (src/app/play.ts). */
export const PLAYED_FIGURE = SELECTOR.playedFigure;
export const PLAY_BUTTON = SELECTOR.playButton;
export const PLAYING_PICTURE = `${CLASS.moving}${CLASS.movingShown}`;

/** Every picture a visitor plays, in the page's order. */
async function readPlayedPictures(page: Page): Promise<PlayedPicture[]> {
  // In the page: each one's tab and place, with the number of the question
  // whose answer it's in (from 1, as /ask counts a thread's answers).
  const found = await page.locator(BUILT_TAB).evaluateAll(
    (tabs: PageElement[], selector) =>
      tabs.flatMap((tab) => {
        const inTab: Array<{ tab: string; index: number; question: number; moving: string; still: string }> = [];
        let question = 0;
        for (const block of tab.querySelector(selector.thread)?.children ?? []) {
          if (block.matches(selector.question)) question++;
          for (const figure of block.querySelectorAll(selector.figure)) {
            inTab.push({
              tab: tab.id,
              index: inTab.length,
              question,
              moving: figure.querySelector(selector.button)?.getAttribute("href") ?? "",
              still: figure.querySelector("img")?.getAttribute("src") ?? "",
            });
          }
        }
        return inTab;
      }),
    { thread: CLASS.thread, question: CLASS.question, figure: PLAYED_FIGURE, button: PLAY_BUTTON },
  );
  return found.map(({ question, ...picture }) => ({ ...picture, answer: threadAnswerId(picture.tab, question) }));
}

/** A quote or a file card in an answer that is shown: not one inside a
    status line that hasn't been opened. */
export const COMES_INTO_VIEW = `:is(${SELECTOR.comesIntoView}):not(details:not([open]) *)`;

/** The tab with the most of them, and the answer its last one is in. */
async function readComesIntoView(page: Page): Promise<ComesIntoView | null> {
  // In the page: each tab's count, with the number of the question whose
  // answer the last one is in (from 1, as /ask counts a thread's answers).
  const tabs = await page.locator(BUILT_TAB).evaluateAll(
    (tabs: PageElement[], selector) =>
      tabs.map((tab) => {
        let question = 0;
        let count = 0;
        let lastIn = 0;
        for (const block of tab.querySelector(selector.thread)?.children ?? []) {
          if (block.matches(selector.question)) question++;
          const here = block.querySelectorAll(selector.comesIntoView).length;
          if (here > 0) lastIn = question;
          count += here;
        }
        return { tab: tab.id, count, lastIn };
      }),
    { thread: CLASS.thread, question: CLASS.question, comesIntoView: COMES_INTO_VIEW },
  );
  const most = tabs.toSorted((a, b) => b.count - a.count)[0];
  return most && most.count > 0 ? { tab: most.tab, answer: threadAnswerId(most.tab, most.lastIn) } : null;
}

/** A picture that moves all the time, as the page has it: the one thing a
    page puts in a <picture> (Picture.astro), with the still in its
    <source>. */
export const MOVING_PICTURE = "picture";

/** Every picture that moves all the time, in the page's order. */
async function readMovingPictures(page: Page): Promise<MovingPicture[]> {
  return page.locator(BUILT_TAB).evaluateAll(
    (tabs: PageElement[], selector) =>
      tabs.flatMap((tab) =>
        [...tab.querySelectorAll(selector)].map((picture, index) => ({
          tab: tab.id,
          index,
          moving: picture.querySelector("img")?.getAttribute("src") ?? "",
          still: picture.querySelector("source")?.getAttribute("srcset") ?? "",
        })),
      ),
    MOVING_PICTURE,
  );
}
