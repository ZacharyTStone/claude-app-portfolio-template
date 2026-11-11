/* What the checks share: the Check type, the devices they run on, waiting
   for what the page does over time, and /ask stood in for. */
import { devices, type BrowserContextOptions, type Locator, type Page, type Request } from "playwright";
import type { AskResponse } from "../../src/shared/ask.ts";
import { DATA } from "../../src/shared/page-data.ts";
import { CLASS, ID } from "./site.ts";

/** The chat that's open. */
export const OPEN_CHAT = `${CLASS.tab}[${DATA.chat}]:target`;

export type Check = {
  name: string;
  /** Where it starts, from the main page: "./", "#about", or a link read
      from the page. */
  url: string;
  /** A phone, or JavaScript off; a wide screen otherwise. */
  device?: BrowserContextOptions;
  /** Why it can't run on this site, if it can't. */
  skip?: string | null;
  /** Failed requests to /ask are the check's own doing. */
  allowAsk?: boolean;
  test(page: Page): Promise<void>;
};

// ---- Devices ---------------------------------------------------------------------------

export const desktop: BrowserContextOptions = { viewport: { width: 1440, height: 900 } };
const phone = devices["iPhone 13"];
if (!phone) throw new Error("Playwright has no iPhone 13");
export const iPhone: BrowserContextOptions = phone;
/** As a visitor in New York, so the time-of-day checks know what to expect. */
export const VISITOR_ZONE = "America/New_York";

// ---- Waiting, and reading the page ----------------------------------------------------

export function skip(what: string, why: string): void {
  console.log(`skip ${what}: ${why}`);
}

/** Retries a check until it passes, for what the page does over time. */
export async function eventually(check: () => Promise<void>, timeout = 5000): Promise<void> {
  const until = Date.now() + timeout;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > until) throw error;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
}

/** Waits for the address to have no # at all, not even a bare one. */
export const waitForNoHash = (page: Page): Promise<void> =>
  eventually(async () => {
    if (page.url().includes("#")) throw new Error(`the address is still ${page.url()}`);
  });

/** A new visit to `url`: a fresh page load, but not a refresh. */
export async function revisit(page: Page, url: string): Promise<void> {
  await page.goto("about:blank");
  await page.goto(url);
}

/** The window title once it's what a check expects (or after 5 s): it
    follows the address, a moment after the tab's content. */
export async function settledTitle(page: Page, expected: (title: string) => boolean): Promise<string> {
  const until = Date.now() + 5000;
  let title = await page.title();
  while (!expected(title) && Date.now() < until) {
    await page.waitForTimeout(50);
    title = await page.title();
  }
  return title;
}

/** What `read` gives once it's the same three times 100 ms apart (or after
    5 s): where something is once the page has stopped scrolling. */
export async function settled<Value>(page: Page, read: () => Promise<Value>): Promise<Value> {
  const until = Date.now() + 5000;
  let value = await read();
  for (let same = 1; same < 3 && Date.now() < until;) {
    await page.waitForTimeout(100);
    const next = await read();
    same = next === value ? same + 1 : 1;
    value = next;
  }
  return value;
}

export const squash = (text: string | null): string => (text ?? "").replace(/\s+/g, " ").trim();
/** Markdown as the page shows it: its words, without the marks. */
export const plain = (markdown: string): string =>
  markdown.replace(/\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\)/g, "$1$2$3");

// Callbacks that run in the page, where there's a DOM (Node's own types
// have none), take these shapes instead.
export type Attributed = { getAttribute(name: string): string | null };
/** The words a question bubble ends with: what the visitor typed. */
export const lastText = (q: { lastChild: { nodeValue: string | null } | null }): string | null =>
  q.lastChild?.nodeValue ?? null;

// ---- Time of day -----------------------------------------------------------------------

export const hourIn = (zone: string, at: Date): number =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", hour: "numeric" }).format(at));

/** A zone's offset from UTC, in minutes. */
export function offsetIn(zone: string, at: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  const [, sign = "+", hours = "0", minutes = "0"] = name?.match(/GMT([+-])(\d\d):(\d\d)/) ?? [];
  return (sign === "-" ? -1 : 1) * (Number(hours) * 60 + Number(minutes));
}

/** Now, a minute ago and a minute from now: what the page shows depends on
    the minute it ran in. */
export const moments = (): Date[] => [-60_000, 0, 60_000].map((ms) => new Date(Date.now() + ms));

// ---- /ask, stood in for ----------------------------------------------------------------

/** What the stand-in /ask says: a reply, or "fail" for no answer at all. */
export type Reply = AskResponse | "fail";

/** /ask (at `url`) says `replies`, or each of them in turn. */
export function askReturns(page: Page, url: string, replies: Reply | Reply[], seen: Request[] = []) {
  return page.route(url, (route) => {
    seen.push(route.request());
    const reply = Array.isArray(replies) ? replies[seen.length - 1] : replies;
    if (reply === undefined || reply === "fail") return route.abort();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
  });
}

/** Types a question into a tab's composer, and sends it. */
export async function askIn(page: Page, tab: string, question: string): Promise<void> {
  await page.locator(`#${tab} ${CLASS.composer}`).click();
  await page.keyboard.type(question);
  await page.keyboard.press("Enter");
}

/** Opens a new chat from the sidebar, and asks `question` in its card. */
export async function askInNewChat(page: Page, question: string): Promise<void> {
  await page.locator(`${CLASS.nav} ${CLASS.newTab}`).click();
  await page.locator(`${ID.followUp}:not([hidden])`).waitFor();
  await page.keyboard.type(question);
  await page.keyboard.press("Enter");
}

/** Picks the question card's first choice that opens a tab, and says which. */
export async function pickFirstTab(page: Page): Promise<string> {
  const link = await firstTabChoice(page);
  const href = (await link.getAttribute("href")) ?? "";
  await link.click();
  return href.slice(1);
}

/** The question card's first choice that opens a tab, after opening the
    first topic when that asks which first. */
export async function firstTabChoice(page: Page): Promise<Locator> {
  const first = page.locator(`${ID.followUp} ${CLASS.options} li > *`).first();
  if (await first.getAttribute("href")) return first;
  await first.click();
  return firstTabChoice(page);
}
