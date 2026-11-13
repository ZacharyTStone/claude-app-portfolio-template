/* What the site under test has, for the checks to look for in place of any
   one site's content: read from its main page with JavaScript off, as the
   build wrote it. A part only some sites have is null, undefined or empty
   on a site without it, and a check that needs it asks for its fixture
   (fixtures.ts), which skips the check there. */
import type { Browser, Locator, Page } from "@playwright/test";
import type { ClockWording } from "../../src/app/clock.ts";
import type { Prompt } from "../../src/config/home.ts";
import { CLOCK_MOODS, type ClockMood } from "../../src/config/language.ts";
import type { PersonalAnswer, QuestionCard, Topic } from "../../src/config/question-card.ts";
import { SCRIPT_STRING_ATTRIBUTES, SCRIPT_STRING_NAMES, type ScriptStrings } from "../../src/config/strings.ts";
import { threadAnswerId } from "../../src/contracts/ask.ts";
import { HOURS, type GreetingPart } from "../../src/contracts/day-parts.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
  PART_SELECTOR as PART,
} from "../../src/contracts/page-selectors.ts";
import { COMES_INTO_VIEW, MOVING_PICTURE, PANEL_SECTIONS, PLAY_BUTTON, PLAYED_FIGURE } from "./parts.ts";

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
type LanguagePage = { href: string; lang: string };

/** The account menu's clock: its wording, and the owner's time zone ("UTC"
    when the clock names none). */
export type Clock = ClockWording & { zone: string };

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

/** The tab with the most quotes and file cards in it, and the answer its
    last one is in, as /ask names it ("about.4"). */
export type ComesIntoView = { tab: string; answer: string };

/** A picture that moves all the time, with the still of itself that a
    visitor who wants less motion is shown instead. */
export type MovingPicture = {
  /** The tab it's in, and its place among that tab's moving pictures
      (from 0). */
  tab: string;
  index: number;
  /** Its two files, as the page has them. */
  moving: string;
  still: string;
};

/** A picture a visitor plays: it rests as its still, with a Play button
    that links to the picture as it moves. */
export type PlayedPicture = MovingPicture & {
  /** The answer it's in, as /ask names it ("about.1"). */
  answer: string;
};

export type Site = {
  /** The main page's language, as its <html lang> has it ("en"). */
  lang: string;
  /** The script's wording in that language. A string the page doesn't
      carry (for a part the site doesn't have) is "". */
  words: ScriptStrings;

  /** Where /ask is, as the page has it; null when Ask is off. */
  ask: string | null;
  /** The address the page sends a typed question to, for the checks' /ask
      to stand in at. With Ask off the page asks nothing, and this is where
      /ask would be. */
  askUrl: string;

  /** Whose site it is: the name at the top of the sidebar, which ends every
      window title. */
  name: string;
  /** Who they are in one line, at the top of a new chat. */
  tagline: string | null;
  /** The home screen's greeting for each part of the visitor's day; null
      for a part the page has none for. */
  greetings: Record<GreetingPart, string | null>;
  /** The questions to start with on the home screen: what each says, and
      the answer it gets ("work.2"). */
  prompts: Prompt[];
  /** The ids of the tabs with a figure in them (stats, bars or a flow). */
  figureTabs: string[];

  /** The threads the sidebar lists, in its order: one it lists twice is
      here twice. Never empty. */
  threads: Thread[];
  /** The thread most checks work in: the sidebar's first. */
  firstThread: Thread;
  /** A thread to go to from the first, and for an answer from another tab:
      the sidebar's next that isn't the first. On a site with one thread
      it's the first again, and a check that needs two asks for
      `otherThread`. */
  secondThread: Thread;
  /** A sidebar group with tabs in it, to fold. */
  foldingGroup: SidebarGroup | undefined;
  /** The details panel's sections, in order: the id of each one's heading
      ("panel-context"). */
  panel: string[];

  /** The question card, as the page carries it. */
  questions: QuestionCard;
  /** The card's topic that lists the personal answers. */
  personalTopic: Topic | undefined;
  /** The personal answers the card doesn't list (/ask can still pick one),
      and those it does. */
  hiddenAnswers: PersonalAnswer[];
  shownAnswers: PersonalAnswer[];

  /** The other languages' pages, from the sidebar's links. */
  languages: LanguagePage[];
  /** Where the account menu's language row goes, as the page is built (the
      script adds the open tab to it); null on a site in one language. */
  languageLink: string | null;
  clock: Clock | null;
  /** Whether a thread has a status line ("Read …"). */
  statusLine: boolean;
  /** The first link in a thread that opens in the viewer. */
  viewer: ViewerLink | null;
  movingPictures: MovingPicture[];
  playedPictures: PlayedPicture[];
  comesIntoView: ComesIntoView | null;
};

/** The tab a link on the page opens: "about" for href="#about". */
export const tabIdOf = (href: string | null): string => (href ?? "").slice(1);

// A thread's or a personal answer's tab, as the build wrote it. (The chats'
// tabs are the script's, and no page has one with JavaScript off.)
const BUILT_TAB = `article${CLASS.tab}`;

/** Reads the site served at `home`. */
export async function readSite(browser: Browser, home: string): Promise<Site> {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(home);

  const threads = await readThreads(page);
  const [firstThread] = threads;
  if (!firstThread) throw new Error("The page's sidebar lists no threads");
  const questions = await readQuestionCard(page);
  const ask = await page.locator("html").getAttribute(DATA.ask);

  const site: Site = {
    lang: (await page.locator("html").getAttribute("lang")) ?? "",
    words: await readScriptWords(page),
    ask,
    askUrl: new URL(ask ?? "ask", home).href,
    name: ((await page.locator(CLASS.wordmark).first().textContent()) ?? "").trim(),
    tagline: await attributeOfFirst(page.locator(ATTRIBUTE.tagline), DATA.tagline),
    greetings: await readGreetings(page),
    prompts: await readPrompts(page),
    figureTabs: await attributeOfEach(page.locator(`${BUILT_TAB}:has(${CLASS.figure})`), "id"),
    threads,
    firstThread,
    secondThread: threads.find((thread) => thread.id !== firstThread.id) ?? firstThread,
    foldingGroup: (await readSidebarGroups(page)).find((group) => group.tabs.length),
    panel: await attributeOfEach(page.locator(PANEL_SECTIONS), "aria-labelledby"),
    questions,
    personalTopic: questions.topics.find((topic) => "personal" in topic && topic.personal),
    hiddenAnswers: questions.personal.filter((answer) => answer.hidden),
    shownAnswers: questions.personal.filter((answer) => !answer.hidden),
    languages: await readLanguages(page),
    languageLink: await attributeOfFirst(page.locator(ATTRIBUTE.langLink), "href"),
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

/** An attribute of the first element found: null when none is, or it
    hasn't the attribute. */
async function attributeOfFirst(found: Locator, name: string): Promise<string | null> {
  return (await found.count()) ? found.first().getAttribute(name) : null;
}

/** An attribute of every element found, in the page's order: "" where an
    element hasn't it. */
const attributeOfEach = (found: Locator, name: string): Promise<string[]> =>
  found.evaluateAll((elements, attribute) => elements.map((element) => element.getAttribute(attribute) ?? ""), name);

async function readScriptWords(page: Page): Promise<ScriptStrings> {
  const wordsOnThePage = await page.locator("html").evaluate(
    (html, attributes) => attributes.map((attribute) => html.getAttribute(attribute) ?? ""),
    SCRIPT_STRING_NAMES.map((name) => SCRIPT_STRING_ATTRIBUTES[name]),
  );
  return Object.fromEntries(SCRIPT_STRING_NAMES.map((name, nth) => [name, wordsOnThePage[nth] ?? ""])) as ScriptStrings;
}

/** The thread each of the sidebar's rows opens: the rows at its top, then
    its groups'. A row that opens no thread (a link to another site, say)
    gives none. */
async function readThreads(page: Page): Promise<Thread[]> {
  const rows = `${ID.sidebar} ${CLASS.nav} a[href^='#'], ${ID.sidebar} ${PART.tabRow}`;
  const tabsTheRowsOpen = (await attributeOfEach(page.locator(rows), "href")).map(tabIdOf);
  const threadsBuilt = await readBuiltThreads(page);
  return tabsTheRowsOpen.flatMap((tabId) => threadsBuilt.filter((thread) => thread.id === tabId));
}

/** Every tab the build wrote that asks a question, as a thread: a question,
    then what answers it (one block or several), then the next question. */
async function readBuiltThreads(page: Page): Promise<Thread[]> {
  const tabs = await page.locator(BUILT_TAB).evaluateAll(
    (builtTabs, selector) =>
      builtTabs.map((tab) => {
        const questions: string[] = [];
        const answers: string[] = [];
        for (const block of tab.querySelector(selector.thread)?.children ?? []) {
          const text = block.textContent ?? "";
          if (block.matches(selector.question)) {
            const saidToScreenReaders = [...block.querySelectorAll(selector.srOnly)].map((said) => said.textContent);
            questions.push(text.replace(saidToScreenReaders.join(""), "").trim());
            answers.push("");
          } else if (answers.length) answers[answers.length - 1] += text;
        }
        return { id: tab.id, title: (tab.querySelector("h2")?.textContent ?? "").trim(), questions, answers };
      }),
    { thread: CLASS.thread, question: CLASS.question, srOnly: CLASS.srOnly },
  );
  return tabs.filter((tab) => tab.questions.length);
}

async function readSidebarGroups(page: Page): Promise<SidebarGroup[]> {
  const headingIds = await attributeOfEach(page.locator(`${ID.sidebar} ${CLASS.groupHeading}`), "id");
  return Promise.all(
    headingIds.map(async (id) => {
      const hrefs = await attributeOfEach(page.locator(`[id="${id}"] + ul a`), "href");
      return { id, tabs: hrefs.map(tabIdOf) };
    }),
  );
}

const readLanguages = (page: Page): Promise<LanguagePage[]> =>
  page
    .locator(`${ID.sidebar} ${CLASS.languageSwitch} a`)
    .evaluateAll((links) =>
      links.map((link) => ({ href: link.getAttribute("href") ?? "", lang: link.getAttribute("hreflang") ?? "" })),
    );

async function readClock(page: Page): Promise<Clock | null> {
  const clock = page.locator(ATTRIBUTE.clock);
  if (!(await clock.count())) return null;
  const wording = async (attribute: string) => (await clock.getAttribute(attribute)) ?? "";
  const moods = {} as Record<ClockMood, string>;
  for (const mood of CLOCK_MOODS) moods[mood] = await wording(DATA.mood(mood));
  return {
    zone: (await attributeOfFirst(clock.locator(PART.ownerZone), DATA.zone)) ?? "UTC",
    same: await wording(DATA.clockSame),
    ahead: await wording(DATA.clockAhead),
    behind: await wording(DATA.clockBehind),
    moods,
  };
}

async function readGreetings(page: Page): Promise<Record<GreetingPart, string | null>> {
  const aroundTheGreeting = page.locator(CLASS.homeBody);
  const greetings = {} as Record<GreetingPart, string | null>;
  for (const part of Object.keys(HOURS.greeting) as GreetingPart[]) {
    greetings[part] = await aroundTheGreeting.getAttribute(DATA.greet(part));
  }
  return greetings;
}

const readPrompts = (page: Page): Promise<Prompt[]> =>
  page.locator(`${CLASS.prompts} ${ATTRIBUTE.prompt}`).evaluateAll(
    (prompts, answerAttribute) =>
      prompts.map((prompt) => ({
        q: (prompt.textContent ?? "").trim(),
        answer: prompt.getAttribute(answerAttribute) ?? "",
      })),
    DATA.prompt,
  );

/** The question card: the JSON the build wrote into the page for the
    script. It's the build's own, so it's read as that, not checked. */
async function readQuestionCard(page: Page): Promise<QuestionCard> {
  return JSON.parse((await page.locator(ID.questionCardData).textContent()) ?? "") as QuestionCard;
}

async function readViewerLink(page: Page): Promise<ViewerLink | null> {
  const tab = page.locator(`${BUILT_TAB}:has(${PART.viewerLink})`).first();
  if (!(await tab.count())) return null;
  const link = tab.locator(PART.viewerLink).first();
  return {
    tab: (await tab.getAttribute("id")) ?? "",
    href: (await link.getAttribute("href")) ?? "",
    shown: (await link.getAttribute(DATA.viewerAddress)) ?? "",
    title: (await link.getAttribute(DATA.viewerTitle)) ?? "",
  };
}

/** Every picture a visitor plays, in the page's order. */
async function readPlayedPictures(page: Page): Promise<PlayedPicture[]> {
  // In the page: each one's tab and place, with the number of the question
  // whose answer it's in (from 1, as /ask counts a thread's answers).
  const found = await page.locator(BUILT_TAB).evaluateAll(
    (tabs, selector) =>
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

/** The tab with the most quotes and file cards, and the answer its last
    one is in. */
async function readComesIntoView(page: Page): Promise<ComesIntoView | null> {
  // In the page: each tab's count, with the number of the question whose
  // answer the last one is in (from 1, as /ask counts a thread's answers).
  const tabs = await page.locator(BUILT_TAB).evaluateAll(
    (builtTabs, selector) =>
      builtTabs.map((tab) => {
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

/** Every picture that moves all the time, in the page's order. */
const readMovingPictures = (page: Page): Promise<MovingPicture[]> =>
  page.locator(BUILT_TAB).evaluateAll(
    (tabs, selector) =>
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
