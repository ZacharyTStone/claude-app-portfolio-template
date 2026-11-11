/* The config's checks, run before a build. Its shape is the type checker's
   (`npm run typecheck`), so these check only what types can't: what a value
   points at, what it looks like, and that the languages match. */

import { ID } from "../shared/config.ts";
import type { Language } from "../shared/config.ts";
import { personalAnswerId, threadAnswerId } from "../shared/ask.ts";
import { FIGURE_LIMITS } from "../shared/content.ts";
import type { Block, Picture } from "../shared/content.ts";
import { browserFollows, hrefsIn } from "../shared/markdown.ts";
import { CHATS_GROUP, ID_PREFIXES, PAGE_IDS, personalTab, SCRIPT_STRINGS } from "../shared/page-data.ts";
import { MAX_TOPICS } from "./constants.ts";
import { LOGOS } from "../components/logos.ts";
import type { Site } from "./site.ts";

export type Findings = {
  /** What stops the build. */
  problems: string[];
  /** Advice: printed, but the build goes ahead. */
  notes: string[];
};

/** Adds `message` to the findings unless `ok`. */
type Rule = (ok: unknown, message: string) => void;

const RESERVED_IDS: string[] = Object.values(PAGE_IDS);
/** A tab's title has the tab's id with this after it (Article.astro), so a
    thread "about-title" would share its id with the title of "about". */
const TITLE_SUFFIX = "-title";

// The shapes of the values the pages put in attributes and addresses. They
// are escaped there, but a javascript: link, or a language code that isn't
// one, would still do harm.
const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-zA-Z0-9]{2,8})*$/; // "en", "pt-BR"
const LOCALE = /^[a-z]{2,3}(_[A-Z]{2})?$/; // "en_US"
const COLOUR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]+)$/i; // "#191919", "black"
const WEB_URL = /^https?:\/\/[^\s"'<>\\]+$/;
// A WEB_URL with no query, # or empty step in its path: with
// "https://x.com//", every link on the site would start "//", another site.
const SITE_URL = /^https?:\/\/[^\s"'<>\\/?#]+(\/[^\s"'<>\\/?#]+)*\/?$/;
const SITE_PATH = /^\/(?!\/)[^\s"'<>\\]*$/; // "/assets/og.png"
const EMAIL = /^[^\s@"'<>\\]+@[^\s@"'<>\\]+$/;

/** Whether a link is safe to follow: a web or mailto address, #thread or a
    path, with nothing a browser would skip over (spaces or control
    characters, as in "java\nscript:"). */
export function isSafeHref(href: string): boolean {
  if (/[\s\x00-\x1f\x7f]/.test(href)) return false;
  const scheme = href.match(/^([a-z][a-z0-9+.-]*):/i)?.[1];
  return scheme === undefined || ["http", "https", "mailto"].includes(scheme.toLowerCase());
}

/** Whether the account menu's clock can tell the time in `zone`: it uses
    this constructor (src/app/account.ts), which throws for a zone it
    doesn't know. */
function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The .i-* icons a stylesheet has: .i-about and so on. */
export function iconsIn(css: string): Set<string> {
  const names = [...css.matchAll(/^\.i-([a-z-]+) \{/gm)].map(([, name]) => name);
  return new Set(names.filter((name) => name !== undefined));
}

/** `icons` are the ones the styles have (iconsIn). */
export function validate(site: Site, icons: Set<string>): Findings {
  const findings: Findings = { problems: [], notes: [] };
  const need: Rule = (ok, message) => {
    if (!ok) findings.problems.push(message);
  };
  checkLanguagesMatch(site, need);
  checkSite(site, need);
  checkAsk(site, need);
  const topics = site.lang(site.main).questions.topics.length;
  if (topics > MAX_TOPICS) {
    findings.notes.push(
      `the question card has ${topics} topics. ${MAX_TOPICS} or fewer read better, on a phone above all: group the rest under one topic with "ask" and "choices"`,
    );
  }
  for (const code of site.codes) checkLanguage(site, code, icons, need);
  return findings;
}

// Every language has the same threads, with as many questions each, and the
// same questions to pick, in the same order: an answer's id ("work.2") has
// to name the same answer in each.
function checkLanguagesMatch(site: Site, need: Rule) {
  const shape = (lang: Language) =>
    JSON.stringify({
      threads: lang.threads.map((t) => [t.id, t.messages.length]),
      topics: lang.questions.topics.map((t) => ({
        tab: t.tab,
        personal: !!t.personal,
        choices: (t.choices ?? []).map((c) => c.tab),
      })),
      personal: lang.questions.personal.map((p) => p.id),
      prompts: (lang.home.prompts ?? []).map((p) => p.answer),
    });
  const { codes, main } = site;
  for (const code of codes.slice(1)) {
    need(
      shape(site.lang(code)) === shape(site.lang(main)),
      `${code}: its threads, questions and home prompts don't match ${main}'s (same ids, as many questions, same order)`,
    );
  }
}

// The values for the whole site that end up in attributes and addresses.
function checkSite({ config, codes }: Site, need: Rule) {
  for (const code of codes) {
    need(
      LANGUAGE_CODE.test(code),
      `"${code}" should be a language code like "en" or "pt-BR" (it's also the name of its page's folder)`,
    );
  }
  need(SITE_URL.test(config.url), `url should be the site's address, like "https://example.com"`);
  need(isTimeZone(config.timezone), `timezone should be a time zone, like "Asia/Tokyo" or "UTC"`);
  need(
    !config.hsts?.preload || config.hsts.includeSubDomains === true,
    `hsts.preload needs hsts.includeSubDomains too (browsers only preload a whole domain)`,
  );
  if (config.nameLang != null) {
    need(LANGUAGE_CODE.test(config.nameLang), `nameLang should be a language code like "en"`);
  }
  need(EMAIL.test(config.links.email), `links.email should be an email address`);
  for (const key of ["github", "linkedin"] as const) {
    const href = config.links[key];
    if (href != null) need(WEB_URL.test(href), `links.${key} should be a web address, like "https://…"`);
  }
  need(COLOUR.test(config.themeColor), `themeColor should be a colour, like "#191919"`);
  need(SITE_PATH.test(config.social.image), `social.image should be a path on this site, like "/assets/og.png"`);
  for (const key of ["width", "height"] as const) {
    const size = config.social[key];
    need(Number.isInteger(size) && size > 0, `social.${key} should be a whole number of pixels`);
  }
  const image = config.person?.image;
  if (image != null) {
    need(SITE_PATH.test(image), `person.image should be a path on this site, like "/assets/portrait.webp"`);
  }
}

// Ask's Worker runs on Cloudflare Workers, and nowhere else.
function checkAsk({ config, host }: Site, need: Rule) {
  need(
    !config.ask || host === "cloudflare",
    `ask needs Cloudflare Workers, where its Worker (src/worker) runs, but host is "${host}": remove ask, or set host to "cloudflare"`,
  );
}

/** What the checks of one language's parts work with. Each message says
    which language it's about. */
type Checks = {
  site: Site;
  lang: Language;
  /** Its threads' ids. */
  ids: Set<string>;
  need: Rule;
  /** Something that points at a thread. */
  thread: (id: string, what: string) => void;
  /** Something drawn with an icon, which can be a logo unless `logos` says
      otherwise. */
  icon: (name: string, what: string, logos?: string[]) => void;
  /** Something that links somewhere. */
  link: (href: string, what: string) => void;
};

function checkLanguage(site: Site, code: string, icons: Set<string>, need: Rule) {
  const lang = site.lang(code);
  const ids = new Set(lang.threads.map((t) => t.id));
  const say: Rule = (ok, message) => need(ok, `${code}: ${message}`);
  const checks: Checks = {
    site,
    lang,
    ids,
    need: say,
    thread: (id, what) => say(ids.has(id), `${what} points at #${id}, which isn't a thread`),
    icon: (name, what, logos = LOGOS) =>
      say(icons.has(name) || logos.includes(name), `${what} has the icon "${name}", but src/styles has no .i-${name}`),
    link: (href, what) =>
      say(isSafeHref(href), `${what} links to "${href}", which should be a web, mailto, #thread or relative address`),
  };
  checkMeta(checks);
  checkHome(checks);
  checkThreads(checks);
  checkSidebar(checks);
  checkPanel(checks);
  checkQuestions(checks);
  checkWording(checks);
  checkTextLinks(checks);
}

function checkMeta({ lang, need }: Checks) {
  need(LOCALE.test(lang.locale), `locale should look like "en_US"`);
  for (const href of lang.meta.preload) {
    need(SITE_PATH.test(href), `meta.preload has "${href}", which should be a path on this site`);
  }
}

// A question to start with gets one of the site's answers, named as /ask
// names them.
function checkHome({ lang, need }: Checks) {
  const answers = new Set([
    ...lang.threads.flatMap((t) => t.messages.map((_, i) => threadAnswerId(t.id, i + 1))),
    ...lang.questions.personal.map((p) => personalAnswerId(p.id)),
  ]);
  for (const p of lang.home.prompts ?? []) {
    need(
      answers.has(p.answer),
      `the home prompt "${p.q}" gets the answer "${p.answer}", which isn't one: a thread's nth answer is "<thread>.<n>", and a personal answer "${personalAnswerId("<id>")}"`,
    );
  }
}

/** The pictures in a block: one, a row of them, or none. */
function picturesIn(b: Block): Picture[] {
  if (typeof b !== "object" || Array.isArray(b)) return [];
  if ("image" in b) return [b.image];
  return "images" in b ? b.images : [];
}

// A part of a thread's answer. A figure with too little in it isn't a
// figure, and one with too much doesn't read at a glance. A bar is drawn
// from its amount, which has to be a number above zero.
function checkBlock(b: Block, where: string, { need, icon, link }: Checks) {
  for (const { src, alt, width, height, href } of picturesIn(b)) {
    need(SITE_PATH.test(src), `${where} has a picture at "${src}", which should be a path on this site`);
    need(alt, `${where} has the picture "${src}" without an alt: say what it shows, for anyone who can't see it`);
    need(
      [width, height].every((size) => Number.isInteger(size) && size > 0),
      `${where} has the picture "${src}" without its width and height in pixels`,
    );
    if (href != null) link(href, `the picture "${src}"`);
  }
  if (typeof b !== "object" || Array.isArray(b)) return;
  if ("link" in b) {
    icon(b.link.icon, `the link card "${b.link.name}"`);
    link(b.link.href, `the link card "${b.link.name}"`);
  }
  const within = (n: number, { min, max }: { min: number; max: number }) => n >= min && n <= max;
  const between = ({ min, max }: { min: number; max: number }) => `${min} to ${max}`;
  if ("bars" in b) {
    const { rows } = b.bars;
    need(b.bars.title, `${where} has bars without a title`);
    need(
      within(rows.length, FIGURE_LIMITS.bars),
      `${where} has ${rows.length} bars in "${b.bars.title}": it takes ${between(FIGURE_LIMITS.bars)} (one number alone is text)`,
    );
    for (const r of rows) {
      need(r.label && r.value, `${where} has a bar in "${b.bars.title}" without a label or a value`);
      need(
        Number.isFinite(r.amount) && r.amount > 0,
        `${where} has the bar "${r.label}" with the amount ${JSON.stringify(r.amount)}: it should be a number above zero, in the same unit on every row`,
      );
    }
  }
  if ("flow" in b) {
    const { steps } = b.flow;
    need(b.flow.title, `${where} has a flow without a title`);
    need(
      within(steps.length, FIGURE_LIMITS.flow),
      `${where} has ${steps.length} steps in "${b.flow.title}": it takes ${between(FIGURE_LIMITS.flow)}`,
    );
    for (const s of steps) need(s.name, `${where} has a step in "${b.flow.title}" without a name`);
  }
  if ("heading" in b) need(b.heading.title, `${where} has a heading without a title`);
  if ("quote" in b) need(b.quote.text && b.quote.by, `${where} has a quote without its text or who said it (by)`);
}

function checkThreads(checks: Checks) {
  const { lang, ids, need } = checks;
  need(ids.size === lang.threads.length, "two threads have the same id");
  for (const t of lang.threads) {
    need(ID.test(t.id), `the thread id "${t.id}" should be lowercase letters, digits and dashes`);
    need(
      !RESERVED_IDS.includes(t.id) &&
        !ID_PREFIXES.some((start) => t.id.startsWith(start)) &&
        !t.id.endsWith(TITLE_SUFFIX),
      `"${t.id}" is used by the page itself; pick another thread id`,
    );
    need(t.messages.length, `the thread "${t.id}" has no messages`);
    for (const b of t.messages.flatMap((m) => m.a)) checkBlock(b, `the thread "${t.id}"`, checks);
  }
}

function checkSidebar({ lang, need, thread, icon }: Checks) {
  const { nav, groups } = lang.sidebar;
  for (const n of nav) {
    thread(n.tab, `the sidebar's "${n.label}"`);
    icon(n.icon, `the sidebar's "${n.label}"`, []);
  }
  const groupIds = groups.map((g) => g.id);
  need(
    new Set(groupIds).size === groupIds.length && !groupIds.includes(CHATS_GROUP),
    `the sidebar's group ids should be different from each other and from "${CHATS_GROUP}"`,
  );
  for (const g of groups) {
    need(ID.test(g.id), `the sidebar's group id "${g.id}" should be lowercase letters, digits and dashes`);
    for (const r of g.tabs) thread(r.tab, `the sidebar's "${r.title}"`);
  }
}

function checkPanel({ lang, thread, icon, link }: Checks) {
  for (const s of lang.panel.progress?.steps ?? []) thread(s.tab, `the panel's "${s.title}"`);
  for (const key of ["outputs", "context"] as const) {
    for (const r of lang.panel[key]?.rows ?? []) {
      icon(r.icon, `the panel's "${r.label}"`);
      if (r.href != null) link(r.href, `the panel's "${r.label}"`);
    }
  }
}

function checkQuestions({ lang, need, thread }: Checks) {
  const { topics, personal } = lang.questions;
  for (const t of topics) {
    if (t.tab) thread(t.tab, `the question card's "${t.label}"`);
    for (const c of t.choices ?? []) thread(c.tab, `the question card's "${t.label}"`);
    need(t.tab || t.personal || t.choices?.length, `the question card's "${t.label}" opens nothing`);
    need(t.tab || t.ask, `the question card's "${t.label}" needs an "ask" for its second question`);
  }
  const personalIds = personal.map((p) => p.id);
  need(new Set(personalIds).size === personalIds.length, "two personal answers have the same id");
  for (const p of personal) {
    // Its tab is #personal-<id>, and its answer "personal-<id>.1", which the
    // script reads back as a tab's id.
    need(ID.test(p.id), `the personal answer id "${p.id}" should be lowercase letters, digits and dashes`);
  }
}

// "Something else", the account menu, and the page's and the script's words.
function checkWording({ site, lang, need, thread }: Checks) {
  const { asked, account, strings } = lang;
  need(asked.email.includes("{question}"), "asked.email should have {question} in it, where the question goes");
  need(
    strings.status.includes("{file}"),
    `strings.status should have {file} in it, where the file goes ("Read {file}")`,
  );
  if (site.codes.length > 1) {
    need(account.language, "account.language is missing: the account menu's row that opens the other language");
  }
  if (site.config.links.linkedin) {
    need(asked.linkedin, "asked.linkedin is missing (links.linkedin needs it)");
    need(asked.message, "asked.message is missing (links.linkedin needs it)");
  }
  thread(account.upgrade.tab, "the account menu's upgrade row");
}

// Links in the text: Markdown's [label](href), wherever it is, read as the
// pages and the browser read it.
function checkTextLinks({ lang, ids, need, link }: Checks) {
  for (const text of allStrings(lang)) {
    for (const href of hrefsIn(text)) link(href, `a link in "${excerpt(text)}"`);
  }
  const personal = lang.questions.personal.map((p) => personalTab(p.id));
  for (const href of allStrings(lang).flatMap(hrefsIn)) {
    if (!href.startsWith("#")) continue;
    const target = href.slice(1);
    need(
      ids.has(target) || target === PAGE_IDS.top || personal.includes(target),
      `a link in the text points at #${target}, which isn't a thread`,
    );
  }
  // The browser shows these itself, and leaves a link it can't follow as words.
  const shownByBrowser = [...allStrings(lang.questions.personal), ...SCRIPT_STRINGS.map((key) => lang.strings[key])];
  for (const text of shownByBrowser) {
    for (const href of hrefsIn(text)) {
      need(
        browserFollows(href),
        `a link in "${excerpt(text)}" goes to "${href}", but the script shows this text, and only follows #tab, web and mailto links`,
      );
    }
  }
}

const excerpt = (text: string) => (text.length > 40 ? `${text.slice(0, 40)}…` : text);

// Every string in a value, however deep.
function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(allStrings);
  return [];
}
