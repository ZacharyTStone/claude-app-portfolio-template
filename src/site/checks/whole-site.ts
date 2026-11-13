/* The checks of the site as a whole: that its languages match, and the
   settings every language shares. */

import { range } from "es-toolkit";
import { answerBlocksIn, isTextBlock, picturesIn } from "../../config/blocks.ts";
import type { Language } from "../../config/language.ts";
import type { Topic } from "../../config/question-card.ts";
import type { Host, SiteConfig } from "../../config/site-config.ts";
import { isRecord } from "../../contracts/guards.ts";
import { panelRows } from "../panel.ts";
import type { Site } from "../site.ts";
import {
  isColour,
  isEmailAddress,
  isHttpsAddress,
  isLanguageCode,
  isPathOnSite,
  isPixelCount,
  isSiteAddress,
  isTimeZone,
  isWebAddress,
} from "./formats.ts";
import type { ProblemUnless } from "./reporting.ts";

type SiteCheck = (site: Site, problemUnless: ProblemUnless) => void;

/** What has to be the same in every language, in the order a difference
    is looked for: each part under the name a problem calls it by, each of
    its items as the problem describes it. The ids, counts and order of
    everything an answer's id, a topic or a home prompt can name; never the
    wording. */
type Outline = Record<"thread" | "topic" | "personal answer" | "home prompt", string[]>;

const quoted = (id: string): string => `"${id}"`;

function whatATopicOpens(topic: Topic): string {
  const choices = (topic.choices ?? []).map((choice) => quoted(choice.tab));
  const opened = [
    ...(topic.tab ? [quoted(topic.tab)] : []),
    ...(topic.personal ? ["the personal answers"] : []),
    ...(choices.length ? [`a choice of ${choices.join(", ")}`] : []),
  ];
  return opened.join(" and ") || "nothing to open";
}

function outlineOf(language: Language): Outline {
  return {
    thread: language.threads.map(
      ({ id, messages }) => `${quoted(id)} (${messages.length} ${messages.length === 1 ? "question" : "questions"})`,
    ),
    topic: language.questions.topics.map(whatATopicOpens),
    "personal answer": language.questions.personal.map(({ id }) => quoted(id)),
    "home prompt": (language.home.prompts ?? []).map(({ answer }) => `for ${quoted(answer)}`),
  };
}

const ORDINAL_ENDINGS: Record<Intl.LDMLPluralRule, string> = {
  zero: "th",
  one: "st",
  two: "nd",
  few: "rd",
  many: "th",
  other: "th",
};
const ordinalRules = new Intl.PluralRules("en", { type: "ordinal" });

/** "1st", "2nd", "3rd", "11th". */
const ordinal = (position: number): string => `${position}${ORDINAL_ENDINGS[ordinalRules.select(position)]}`;

/** Where one language's outline first differs from the main one's, as a
    problem says it: `the 2nd thread is "work" (2 questions) in fr and
    "work" (1 question) in en`. Undefined when they match. */
function firstDifference(code: string, outline: Outline, main: string, mainOutline: Outline): string | undefined {
  for (const [part, items] of Object.entries(outline) as Array<[keyof Outline, string[]]>) {
    const mainItems = mainOutline[part];
    const at = range(Math.max(items.length, mainItems.length)).find((index) => items[index] !== mainItems[index]);
    if (at === undefined) continue;
    const here = items[at] ?? "missing";
    const there = mainItems[at] ?? "missing";
    return `the ${ordinal(at + 1)} ${part} is ${here} in ${code} and ${there} in ${main}`;
  }
  return undefined;
}

/** An answer's id ("work.2") has to name the same answer in every language:
    /ask replies with an id, which each language's page shows from its own
    copy, and the account menu's link to another language keeps the open
    tab's #id. */
const checkLanguagesMatch: SiteCheck = (site, problemUnless) => {
  const { codes, main } = site;
  const mainOutline = outlineOf(site.language(main));
  for (const code of codes.slice(1)) {
    const difference = firstDifference(code, outlineOf(site.language(code)), main, mainOutline);
    problemUnless(
      difference === undefined,
      `${code}: its threads, questions and home prompts don't match ${main}'s (same ids, as many questions, same order): ${difference}`,
    );
  }
};

const checkLanguageCodes: SiteCheck = ({ codes }, problemUnless) => {
  for (const code of codes) {
    problemUnless(
      isLanguageCode(code),
      `"${code}" should be a language code like "en" or "pt-BR" (it's also the name of its page's folder)`,
    );
  }
};

/** A setting that has to look a certain way. */
type SettingFormat = {
  /** Where the setting is in the config, as its problem names it. */
  field: string;
  looksRight: (value: unknown) => boolean;
  /** How its problem ends: "<field> should be <shouldBe>". */
  shouldBe: string;
  mayBeLeftOut?: true;
};

/** The pages write these into attributes and addresses as they are, in the
    order their problems are listed. */
const SETTING_FORMATS: SettingFormat[] = [
  { field: "url", looksRight: isSiteAddress, shouldBe: `the site's address, like "https://example.com"` },
  { field: "timezone", looksRight: isTimeZone, shouldBe: `a time zone, like "Asia/Tokyo" or "UTC"` },
  { field: "nameLang", looksRight: isLanguageCode, shouldBe: `a language code like "en"`, mayBeLeftOut: true },
  { field: "links.email", looksRight: isEmailAddress, shouldBe: "an email address" },
  // Without "https://", a browser would read a profile as a page of this site.
  { field: "links.github", looksRight: isWebAddress, shouldBe: `a web address, like "https://…"`, mayBeLeftOut: true },
  {
    field: "links.linkedin",
    looksRight: isWebAddress,
    shouldBe: `a web address, like "https://…"`,
    mayBeLeftOut: true,
  },
  { field: "themeColor", looksRight: isColour, shouldBe: `a colour, like "#191919"` },
  { field: "social.image", looksRight: isPathOnSite, shouldBe: `a path on this site, like "/assets/og.png"` },
  { field: "social.width", looksRight: isPixelCount, shouldBe: "a whole number of pixels" },
  { field: "social.height", looksRight: isPixelCount, shouldBe: "a whole number of pixels" },
  {
    field: "person.image",
    looksRight: isPathOnSite,
    shouldBe: `a path on this site, like "/assets/portrait.webp"`,
    mayBeLeftOut: true,
  },
];

/** A setting's value, by where it is in the config: "links.email". */
const settingAt = (config: SiteConfig, field: string): unknown =>
  field.split(".").reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), config);

const checkSettingFormats: SiteCheck = ({ config }, problemUnless) => {
  for (const { field, looksRight, shouldBe, mayBeLeftOut } of SETTING_FORMATS) {
    const value = settingAt(config, field);
    const isLeftOut = value == null;
    problemUnless((mayBeLeftOut && isLeftOut) || looksRight(value), `${field} should be ${shouldBe}`);
  }
};

/** hstspreload.org takes a site only when its header covers every
    subdomain too, so `preload` alone would ask for something it can't get. */
const checkHsts: SiteCheck = ({ config }, problemUnless) => {
  const { hsts } = config;
  problemUnless(
    !hsts?.preload || hsts.includeSubDomains === true,
    `hsts.preload needs hsts.includeSubDomains too (browsers only preload a whole domain)`,
  );
};

/** The one host that runs Ask's Worker (src/worker). */
const ASK_HOST: Host = "cloudflare";

/** On any other host the page would send its questions to an address with
    nothing there. */
const checkAskRunsOnItsHost: SiteCheck = ({ config, host }, problemUnless) => {
  problemUnless(
    !config.ask || host === ASK_HOST,
    `ask needs Cloudflare Workers, where its Worker (src/worker) runs, but host is "${host}": remove ask, or set host to "${ASK_HOST}"`,
  );
};

/** Where a language's link cards, pictures and panel rows link to: the
    links the viewer can open. */
function viewableHrefs(language: Language): string[] {
  const inThreads = answerBlocksIn(language).flatMap((block) => {
    if (isTextBlock(block)) return [];
    if ("link" in block) return [block.link.href];
    return picturesIn(block).map((picture) => picture.href);
  });
  const inPanel = panelRows(language.panel).map((row) => row.href);
  return [...inThreads, ...inPanel].filter((href) => href != null);
}

/** The viewer matches a link character for character, so a missing slash
    is a different link. A page served over HTTPS can frame no other kind
    of address, and this site's own pages refuse to be framed
    (X-Frame-Options, frame-ancestors). */
const checkViewer: SiteCheck = (site, problemUnless) => {
  const { viewer, url } = site.config;
  if (!viewer) return;
  const hrefsOnTheSite = new Set(site.codes.flatMap((code) => viewableHrefs(site.language(code))));
  // An address that isn't one is reported as the `url` it is.
  const ownOrigin = URL.canParse(url) ? new URL(url).origin : "";
  for (const [href, frameAddress] of Object.entries(viewer)) {
    problemUnless(
      hrefsOnTheSite.has(href),
      `viewer has "${href}", but no link card, picture or panel row links there: it should be a link's href, exactly as the config has it`,
    );
    const isHttps = isHttpsAddress(frameAddress);
    problemUnless(isHttps, `viewer shows "${href}" at "${frameAddress}", which should be an https:// address`);
    problemUnless(
      !isHttps || new URL(frameAddress).origin !== ownOrigin,
      `viewer shows "${href}" at "${frameAddress}", a page of this site, and this site's pages refuse to be shown in a frame`,
    );
  }
};

/** The checks of the site as a whole, in the order their problems are
    listed: all of them before any language's. */
export const SITE_CHECKS: SiteCheck[] = [
  checkLanguagesMatch,
  checkLanguageCodes,
  checkSettingFormats,
  checkHsts,
  checkAskRunsOnItsHost,
  checkViewer,
];

/** The question card's first step reads best with this many topics or
    fewer (plus "Something else"), on a phone above all. */
const MAX_TOPICS = 4;

/** Advice, not a problem. The main language's count is every language's
    (checkLanguagesMatch). */
export function noteManyTopics(site: Site, notes: string[]): void {
  const topicCount = site.language(site.main).questions.topics.length;
  if (topicCount > MAX_TOPICS) {
    notes.push(
      `the question card has ${topicCount} topics. ${MAX_TOPICS} or fewer read better, on a phone above all: group the rest under one topic with "ask" and "choices"`,
    );
  }
}
