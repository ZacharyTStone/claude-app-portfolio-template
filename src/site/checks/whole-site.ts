/* The checks of the site as a whole: that its languages match, and the
   settings every language shares (the address, the links, the social card,
   Ask, the viewer). Each takes the site and reports through `problemUnless`;
   check-site.ts runs them in order. */

import { isEqual } from "es-toolkit";
import type { Language } from "../../config/language.ts";
import { ASK_HOST, MAX_TOPICS } from "../constants.ts";
import { panelRows } from "../panel.ts";
import type { Site } from "../site.ts";
import { answerBlocksIn, isTextBlock, picturesIn } from "../../config/blocks.ts";
import type { ProblemUnless } from "./reporting.ts";
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

/** What has to be the same in every language: the ids, counts and order of
    everything an answer's id, a topic or a home prompt can name. Never the
    wording. */
type LanguageOutline = {
  /** Each thread's id and how many questions it answers, in order. */
  threads: Array<[threadId: string, questionCount: number]>;
  /** The question card's topics, in order: the thread each opens, whether
      it lists the personal answers, and the threads its choices open. */
  topics: Array<{ tab: string | undefined; personal: boolean; choices: string[] }>;
  /** The personal answers' ids, in order. */
  personal: string[];
  /** The answer each question on the home screen gets, in order. */
  prompts: string[];
};

/** A language's outline, to compare with another's. */
function outlineOf(language: Language): LanguageOutline {
  return {
    threads: language.threads.map((thread) => [thread.id, thread.messages.length]),
    topics: language.questions.topics.map((topic) => ({
      tab: topic.tab,
      personal: Boolean(topic.personal),
      choices: (topic.choices ?? []).map((choice) => choice.tab),
    })),
    personal: language.questions.personal.map((personalAnswer) => personalAnswer.id),
    prompts: (language.home.prompts ?? []).map((prompt) => prompt.answer),
  };
}

/** Every language has the same threads, with as many questions each, and
    the same topics, personal answers and home prompts, in the same order.
    An answer's id ("work.2") has to name the same answer in each: /ask
    replies with an id, which each language's page shows from its own copy,
    and the account menu's link to another language keeps the open tab's
    #id. A site gets it wrong by adding a thread or a question to one
    language only. */
export function checkLanguagesMatch(site: Site, problemUnless: ProblemUnless): void {
  const { codes, main } = site;
  for (const code of codes.slice(1)) {
    problemUnless(
      isEqual(outlineOf(site.lang(code)), outlineOf(site.lang(main))),
      `${code}: its threads, questions and home prompts don't match ${main}'s (same ids, as many questions, same order)`,
    );
  }
}

/** A language's code is its page's `lang` attribute and the name of its
    page's folder ("/pt-BR/"), so it's a code, not the language's name
    ("English") and not a path. */
export function checkLanguageCodes({ codes }: Site, problemUnless: ProblemUnless): void {
  for (const code of codes) {
    problemUnless(
      isLanguageCode(code),
      `"${code}" should be a language code like "en" or "pt-BR" (it's also the name of its page's folder)`,
    );
  }
}

/** The site's address starts every full link the build writes (canonical,
    the sitemap, the social card), and its path every link between pages. A
    site gets it wrong by leaving off "https://", or by pasting an address
    with a query or a # on the end. */
export function checkSiteAddress({ config }: Site, problemUnless: ProblemUnless): void {
  problemUnless(isSiteAddress(config.url), `url should be the site's address, like "https://example.com"`);
}

/** The account menu's clock tells the owner's time, in a zone named as
    browsers know it: "Asia/Tokyo", not "Tokyo". */
export function checkTimeZone({ config }: Site, problemUnless: ProblemUnless): void {
  problemUnless(isTimeZone(config.timezone), `timezone should be a time zone, like "Asia/Tokyo" or "UTC"`);
}

/** The list of HTTPS-only sites that browsers ship with (hstspreload.org)
    takes a site only when its header covers every subdomain too, so
    `preload` alone would ask for something it can't get. */
export function checkHsts({ config }: Site, problemUnless: ProblemUnless): void {
  const { hsts } = config;
  problemUnless(
    !hsts?.preload || hsts.includeSubDomains === true,
    `hsts.preload needs hsts.includeSubDomains too (browsers only preload a whole domain)`,
  );
}

/** The language the owner's name is written in becomes a `lang` attribute
    on the name, on pages in other languages. */
export function checkNameLanguage({ config }: Site, problemUnless: ProblemUnless): void {
  if (config.nameLang == null) return;
  problemUnless(isLanguageCode(config.nameLang), `nameLang should be a language code like "en"`);
}

/** The contact links go into the pages as they are: the email after
    "mailto:", the profiles as full web addresses. A site gets them wrong by
    writing a profile without "https://" ("github.com/alex"), which a
    browser would read as a page of this site. */
export function checkContactLinks({ config }: Site, problemUnless: ProblemUnless): void {
  problemUnless(isEmailAddress(config.links.email), `links.email should be an email address`);
  for (const profile of ["github", "linkedin"] as const) {
    const href = config.links[profile];
    if (href != null) problemUnless(isWebAddress(href), `links.${profile} should be a web address, like "https://…"`);
  }
}

/** The theme colour is written into a <meta> tag for the browser's own
    bars: a colour, and nothing that could end the attribute. */
export function checkThemeColour({ config }: Site, problemUnless: ProblemUnless): void {
  problemUnless(isColour(config.themeColor), `themeColor should be a colour, like "#191919"`);
}

/** The social card is a picture on this site, and its size in pixels: the
    page tells both to the sites that show link previews (og:image, and its
    width and height). */
export function checkSocialCard({ config }: Site, problemUnless: ProblemUnless): void {
  const { social } = config;
  problemUnless(isPathOnSite(social.image), `social.image should be a path on this site, like "/assets/og.png"`);
  for (const side of ["width", "height"] as const) {
    problemUnless(isPixelCount(social[side]), `social.${side} should be a whole number of pixels`);
  }
}

/** The owner's portrait, for search engines (schema.org), is a file on
    this site, which the build turns into a full address. */
export function checkPersonImage({ config }: Site, problemUnless: ProblemUnless): void {
  const portrait = config.person?.image;
  if (portrait == null) return;
  problemUnless(isPathOnSite(portrait), `person.image should be a path on this site, like "/assets/portrait.webp"`);
}

/** Ask's Worker runs on Cloudflare Workers and nowhere else: on any other
    host the page would send its questions to an address with nothing
    there. A site gets it wrong by moving host and leaving `ask` on. */
export function checkAskRunsOnItsHost({ config, host }: Site, problemUnless: ProblemUnless): void {
  problemUnless(
    !config.ask || host === ASK_HOST,
    `ask needs Cloudflare Workers, where its Worker (src/worker) runs, but host is "${host}": remove ask, or set host to "${ASK_HOST}"`,
  );
}

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

/** The viewer shows each link it lists at another address, in a frame.
    Three things make that work: some link card, picture or panel row links
    to exactly the address listed (the viewer matches it character for
    character, so a missing slash is a different link); the frame's address
    is https://, as a page served over HTTPS can frame no other; and it's on
    another site, because this site's own pages refuse to be framed
    (X-Frame-Options, frame-ancestors). */
export function checkViewer(site: Site, problemUnless: ProblemUnless): void {
  const { viewer, url } = site.config;
  if (!viewer) return;
  const hrefsOnTheSite = new Set(site.codes.flatMap((code) => viewableHrefs(site.lang(code))));
  // An address that isn't one is checkSiteAddress's to report.
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
}

/** Advice, not a problem: the question card's first step reads best with
    MAX_TOPICS topics or fewer. The main language's count is every
    language's (checkLanguagesMatch). */
export function noteManyTopics(site: Site, notes: string[]): void {
  const topicCount = site.lang(site.main).questions.topics.length;
  if (topicCount > MAX_TOPICS) {
    notes.push(
      `the question card has ${topicCount} topics. ${MAX_TOPICS} or fewer read better, on a phone above all: group the rest under one topic with "ask" and "choices"`,
    );
  }
}
