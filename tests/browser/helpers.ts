/* What the checks share: what a check is, the devices they run on, the parts
   of the page that come and go (as selectors), waiting for what the page does
   a moment later, reading elements inside the page, the time of day, /ask
   stood in for, and what a visitor does in more than one file of checks. */
import { setTimeout as sleep } from "node:timers/promises";
import { devices, type BrowserContextOptions, type Locator, type Page, type Request } from "playwright";
import type { AskResponse } from "../../src/contracts/ask.ts";
import { plainText } from "../../src/config/markdown.ts";
import { CHATS_GROUP, groupId } from "../../src/contracts/page-ids.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { SEPARATOR } from "../../src/app/constants.ts";
import { CLASS, ID, tabIdOf, type Site } from "./site.ts";

// ---- A check -----------------------------------------------------------------------------

/** One check. run.ts opens `url` in a fresh browser context on `device` and
    calls `test`. The check fails when `test` throws, and so does the run
    when the page or its console reports an error meanwhile. */
export type Check = {
  /** What a visitor does and what the page should then do: the first thing
      read when the check fails, so it says both. */
  name: string;
  /** Where it starts, from the main page: "./", "#about", or a link read
      from the page. */
  url: string;
  /** A phone, or JavaScript off; a wide screen (`desktop`) when left out. */
  device?: BrowserContextOptions;
  /** Why it can't run on this site ("the site has no viewer"), when it
      can't: run.ts says so, and doesn't call `test`. */
  skip?: string | null;
  /** True for a check that makes /ask fail on purpose: what the console
      says of those requests isn't a problem. */
  allowAsk?: boolean;
  /** What the visitor does, and what's expected of the page: it throws (an
      assertion, or a wait that times out) when the page falls short. */
  test(page: Page): Promise<void>;
};

/** Says in the run's output that something wasn't checked on this site,
    and why. */
export function reportSkip(what: string, why: string): void {
  console.log(`skip ${what}: ${why}`);
}

// ---- Devices -----------------------------------------------------------------------------

/** A wide screen: the sidebar, the open tab and the details panel side by
    side. */
export const desktop: BrowserContextOptions = { viewport: { width: 1440, height: 900 } };

const phone = devices["iPhone 13"];
if (!phone) throw new Error("Playwright has no iPhone 13");
/** A phone: a narrow screen, where the sidebar is a drawer and a visit
    starts in a new chat. */
export const iPhone: BrowserContextOptions = phone;

/** Where every check's visitor is: New York, so the time-of-day checks know
    what to expect. */
export const VISITOR_ZONE = "America/New_York";

// ---- Parts of the page that more than one file of checks looks for -----------------------
// The page's ids and classes, as selectors, are ID and CLASS in site.ts. These
// are made of them: first the parts that come and go as the page is used.

/** The chat that's open. */
export const OPEN_CHAT = `${CLASS.tab}[${DATA.chat}]:target`;

/** The question card, while it shows. */
export const OPEN_CARD = `${ID.questionCard}:not([hidden])`;

/** The sidebar while it's a phone's drawer, and open. */
export const OPEN_DRAWER = `${ID.sidebar}${CLASS.drawerOpen}`;

/** The heading the script adds to the sidebar for the visitor's chats, there
    only while there's a chat to list. */
export const CHATS_HEADING = `#${groupId(CHATS_GROUP)}`;

/** The visitor's chats in the sidebar: a row each, under their heading. */
export const CHAT_ROWS = `${CHATS_HEADING} + ul a`;

/** The link to email the owner, in the "Something else" reply: what a
    question gets when the site has no answer for it. The checks know that
    reply by this link. */
export const EMAIL_LINK = `[${DATA.emailBody}]`;

/** A tab's row in the sidebar: its first, as a thread can be in the rows at
    the top and in a group too. */
export const sidebarRow = (page: Page, tab: string): Locator => page.locator(`${ID.sidebar} a[href="#${tab}"]`).first();

/** The shell around the sidebar, the open tab and the details panel: the
    script sets the sidebar's width on it, and makes it inert behind the
    goodbye. */
export const shell = (page: Page): Locator => page.locator(CLASS.shell);

/** The window's title while a tab is open: the tab's name, then the site's. */
export const windowTitle = (tabName: string, site: Site): string => `${tabName}${SEPARATOR}${site.name}`;

// ---- Waiting -----------------------------------------------------------------------------
// Playwright's waitFor() waits for an element to come or go. These wait for
// the rest: a value that's right only a moment after what changes it.

/** How long the waits here keep looking before they give up, in
    milliseconds. */
export const WAIT_TIMEOUT_MS = 5000;
/** How long eventually() and settled() leave between two looks, and
    settledTitle() between two, in milliseconds. */
const LOOK_EVERY_MS = 100;
const TITLE_EVERY_MS = 50;
/** How many looks running have to find the same value for settled() to
    take it as settled. */
const SAME_LOOKS_TO_SETTLE = 3;

/** Runs `check` (assertions, which throw) again and again until it passes,
    for what the page does over time. Once `timeout` ms are up, the failure
    it ends on is the check's. */
export async function eventually(check: () => Promise<void>, timeout = WAIT_TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > deadline) throw error;
    }
    await sleep(LOOK_EVERY_MS);
  }
}

/** Waits for the address to have no # at all, not even a bare one. */
export const waitForNoHash = (page: Page): Promise<void> =>
  eventually(async () => {
    if (page.url().includes("#")) throw new Error(`the address is still ${page.url()}`);
  });

/** Waits until a tab is the open one: the address names it. */
export const waitForTabToOpen = (page: Page, tab: string): Promise<void> => page.locator(`#${tab}:target`).waitFor();

/** A new visit to `url`: a fresh page load, but not a refresh (which ends
    the visit's chats). */
export async function revisit(page: Page, url: string): Promise<void> {
  await page.goto("about:blank");
  await page.goto(url);
}

/** The window title once it's what a check expects (or what it is after
    WAIT_TIMEOUT_MS, for the check to compare): it follows the address, a
    moment after the tab's content. */
export async function settledTitle(page: Page, isExpected: (title: string) => boolean): Promise<string> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let title = await page.title();
  while (!isExpected(title) && Date.now() < deadline) {
    await page.waitForTimeout(TITLE_EVERY_MS);
    title = await page.title();
  }
  return title;
}

/** What `read` gives once it has stopped changing: the same value at
    SAME_LOOKS_TO_SETTLE looks running, LOOK_EVERY_MS apart (or whatever it
    gives after WAIT_TIMEOUT_MS). For where something is once the page has
    stopped scrolling. */
export async function settled<Value>(page: Page, read: () => Promise<Value>): Promise<Value> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let value = await read();
  for (let sameLooks = 1; sameLooks < SAME_LOOKS_TO_SETTLE && Date.now() < deadline;) {
    await page.waitForTimeout(LOOK_EVERY_MS);
    const next = await read();
    sameLooks = next === value ? sameLooks + 1 : 1;
    value = next;
  }
  return value;
}

// ---- Text --------------------------------------------------------------------------------

/** Text as it reads, whatever the page's markup did to its spaces: every
    run of white space one space, and none at either end ("" for null). */
export const squash = (text: string | null): string => (text ?? "").replace(/\s+/g, " ").trim();

/** Markdown as the page shows it: its words, without the marks. */
export const plain = (markdown: string): string => plainText(markdown);

// ---- Inside the page ---------------------------------------------------------------------
// A callback given to evaluate() or evaluateAll() runs in the page, on its
// real elements. These files are compiled twice, though: with Node's types,
// which have no DOM, and with the DOM's (astro check). So such a callback's
// argument is a PageElement: the few members of an Element the checks use,
// written out, which both compilers take.

/** An element in the page, as far as a callback that runs there reads it.
    Each member is the DOM's own, and does what it does there; a callback
    that needs another of Element's members adds it here. */
export type PageElement = {
  id: string;
  textContent: string | null;
  /** The elements directly inside it. */
  children: Iterable<PageElement>;
  /** The last node in it: for a question, the words the visitor typed. */
  lastChild: { nodeValue: string | null } | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  matches(selector: string): boolean;
  querySelector(selector: string): PageElement | null;
  querySelectorAll(selector: string): Iterable<PageElement> & { length: number };
  getBoundingClientRect(): { left: number; right: number; top: number; width: number; height: number };
  dispatchEvent(event: unknown): boolean;
  ownerDocument: {
    /** The element with the keyboard's focus. */
    activeElement: unknown;
    defaultView: PageWindow | null;
  };
};

/** The page's window, as far as those callbacks use it. */
export type PageWindow = {
  getComputedStyle(element: unknown): { getPropertyValue(property: string): string };
  MouseEvent: new (type: string, init: Record<string, boolean>) => unknown;
  addEventListener(
    type: string,
    listener: (event: { defaultPrevented: boolean; preventDefault(): void }) => void,
    options: { once: boolean },
  ): void;
};

/** An element, as far as reading its attributes goes. */
export type Attributed = Pick<PageElement, "getAttribute">;

/** The words a question bubble ends with: what the visitor typed, after the
    "Question: " said to screen readers. */
export const lastText = (question: Pick<PageElement, "lastChild">): string | null =>
  question.lastChild?.nodeValue ?? null;

/** One attribute of each element `all` finds, in the page's order, read in
    one go (null where an element doesn't have it). */
export const attributeOfEach = (all: Locator, name: string): Promise<Array<string | null>> =>
  all.evaluateAll(
    (elements: Attributed[], attribute) => elements.map((element) => element.getAttribute(attribute)),
    name,
  );

/** Whether an element has a class, given as CLASS has it (".playing"). */
export const hasClass = (element: Locator, classSelector: string): Promise<boolean> =>
  element.evaluate((el: PageElement, selector) => el.matches(selector), classSelector);

/** Whether the keyboard's focus is on an element. */
export const hasFocus = (element: Locator): Promise<boolean> =>
  element.evaluate((el: PageElement) => el.ownerDocument.activeElement === el);

/** What the browser has worked out for one of an element's CSS properties
    ("color", "visibility"), stylesheet, media and motion all counted. */
export const computedStyle = (element: Locator, property: string): Promise<string> =>
  element.evaluate((el: PageElement, name) => {
    const view = el.ownerDocument.defaultView;
    if (!view) throw new Error("The element's page has no window");
    return view.getComputedStyle(el).getPropertyValue(name);
  }, property);

// ---- Time of day -------------------------------------------------------------------------

/** The hour (0 to 23) it is in a time zone at `at`. */
export const hourIn = (zone: string, at: Date): number =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", hour: "numeric" }).format(at));

// A zone's offset as Intl names it: "GMT+05:30" or "GMT-04:00" (plain "GMT"
// for none), for its sign, hours and minutes.
const GMT_OFFSET = /GMT([+-])(\d\d):(\d\d)/;

/** A zone's offset from UTC at `at`, in minutes: 330 for "Asia/Kolkata". */
export function offsetIn(zone: string, at: Date): number {
  const offsetName = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  const [, sign = "+", hours = "0", minutes = "0"] = offsetName?.match(GMT_OFFSET) ?? [];
  return (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes));
}

const MINUTE_MS = 60_000;

/** A minute ago, now and a minute from now. What the page shows of the time
    depends on the minute its script ran in, which a check can't know: it
    expects what any of these would give. */
export const minutesAroundNow = (): Date[] => [-MINUTE_MS, 0, MINUTE_MS].map((ms) => new Date(Date.now() + ms));

// ---- /ask, stood in for ------------------------------------------------------------------

/** What the stand-in /ask says: a reply, or "fail" for no answer at all. */
export type Reply = AskResponse | "fail";

/** /ask finding no answer on the site: the page then shows its "Something
    else" reply, as it does to every question when Ask is off. */
export const NO_ANSWER: Reply = { id: null };

/** /ask (at `url`) says `replies` to every question, or, given a list, each
    of them in turn and then nothing. Every request it gets is added to
    `seen`, for a check to count or read. */
export function askReturns(page: Page, url: string, replies: Reply | Reply[], seen: Request[] = []) {
  return page.route(url, (route) => {
    seen.push(route.request());
    const reply = Array.isArray(replies) ? replies[seen.length - 1] : replies;
    if (reply === undefined || reply === "fail") return route.abort();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
  });
}

// ---- What a visitor does -----------------------------------------------------------------

/** Types a question into a tab's composer, and sends it. */
export async function askIn(page: Page, tab: string, question: string): Promise<void> {
  await page.locator(`#${tab} ${CLASS.composer}`).click();
  await page.keyboard.type(question);
  await page.keyboard.press("Enter");
}

/** Opens a new chat from the sidebar, and asks `question` in its card. */
export async function askInNewChat(page: Page, question: string): Promise<void> {
  await page.locator(`${CLASS.nav} ${CLASS.newTab}`).click();
  await page.locator(OPEN_CARD).waitFor();
  await page.keyboard.type(question);
  await page.keyboard.press("Enter");
}

/** Picks the question card's first choice that opens a tab, and says which. */
export async function pickFirstTab(page: Page): Promise<string> {
  const choice = await firstTabChoice(page);
  const tab = tabIdOf(await choice.getAttribute("href"));
  await choice.click();
  return tab;
}

/** The question card's first choice that opens a tab, after opening the
    first topic when that asks which first. */
export async function firstTabChoice(page: Page): Promise<Locator> {
  const firstChoice = page.locator(`${ID.questionCard} ${CLASS.options} li > *`).first();
  // A choice that links to a tab opens it. One that doesn't is a topic: it
  // lists its own choices in the card, so the first is looked at again.
  while (!(await firstChoice.getAttribute("href"))) await firstChoice.click();
  return firstChoice;
}

/** Renames a tab as a visitor does: a click on its title, the new name over
    the old, Enter. Renamed to "", a thread gets its own name back. */
export async function renameTab(page: Page, tab: string, name: string): Promise<void> {
  await page.locator(`#${tab} ${CLASS.titleButton}`).click();
  await page.keyboard.press("ControlOrMeta+A");
  if (name) await page.keyboard.type(name);
  else await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
}
