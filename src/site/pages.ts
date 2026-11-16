/* The portfolio's pages: each language's home screen ("/", "/ja/"), and a
   page for each of its tabs with that tab open ("/about/", "/ja/about/").
   Each is the whole app, so the script moves between tabs in place, and
   without it every tab is an ordinary link to a page of its own. The route
   (src/pages/[...page].astro) builds them, the sitemap lists them, and
   PageMeta writes each one's head from its PageHead.

   Paths here are from the site's own root, as the config writes them:
   site.link() puts a site that's served under a path under it, and
   site.fileUrl() makes the full address. */

import type { Block } from "../config/blocks.ts";
import { PAGE_IDS, personalTabId } from "../contracts/page-ids.ts";
import { tabPagePath, tabWindowTitle } from "../contracts/tab-pages.ts";
import { describe } from "./description.ts";
import type { Site, SiteLanguage } from "./site.ts";

/** What a page's <head> says of it, for search engines and a link's
    preview (src/components/PageMeta.astro). A page of another kind than
    the portfolio's has one too. */
export type PageHead = {
  /** The page's language. */
  code: string;
  /** Where it is: its canonical address. */
  path: string;
  /** The window's title, and the title of a link's preview. */
  title: string;
  description: string;
  /** The same page in each language that has it, its own among them, by
      language: what hreflang links to. The main language's is also the
      one for any other (x-default). */
  versions: Record<string, string>;
};

/** One of the portfolio's pages. */
export type PortfolioPage = {
  head: PageHead;
  /** The tab that's open on it from the first paint. None on the home
      screen. */
  tab?: string;
};

/** A tab with a page of its own: a thread, or a personal answer. "Something
    else" and a visitor's chats have none. */
type TabWithAPage = {
  id: string;
  /** Its name, as its title and the window's title have it. */
  title: string;
  /** What its first answer is made of, which the page's description says. */
  firstAnswer: Block[];
};

/** A language's tabs that have a page of their own, in the page's order:
    each thread, then each personal answer. */
export function tabsWithPages(language: SiteLanguage): TabWithAPage[] {
  const threads = language.threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    firstAnswer: thread.messages[0]?.a ?? [],
  }));
  const personalAnswers = language.questions.personal.map((answer) => ({
    id: personalTabId(answer.id),
    title: answer.title ?? answer.q,
    firstAnswer: answer.a,
  }));
  return [...threads, ...personalAnswers];
}

/** A tab's page in a language: "/ja/about/". */
export const tabPath = (site: Site, code: string, tabId: string): string => tabPagePath(site.home(code), tabId);

/** A tab's page in a language, as the pages link to it: "/ja/about/", or
    "/portfolio/ja/about/" on a site served under a path. */
export const tabHref = (site: Site, code: string, tabId: string): string => site.link(tabPath(site, code, tabId));

/** The same page in every language, by language. */
const inEveryLanguage = (site: Site, pathIn: (code: string) => string): Record<string, string> =>
  Object.fromEntries(site.codes.map((code) => [code, pathIn(code)]));

function homePage(site: Site, code: string): PortfolioPage {
  const { title, description } = site.language(code).meta;
  return { head: { code, path: site.home(code), title, description, versions: inEveryLanguage(site, site.home) } };
}

/** A tab's page, which says what its first answer says, or what the home
    page does when that answer has no words of its own. */
function tabPage(site: Site, code: string, tab: TabWithAPage): PortfolioPage {
  return {
    tab: tab.id,
    head: {
      code,
      path: tabPath(site, code, tab.id),
      title: tabWindowTitle(tab.title, site.config.name),
      description: describe(tab.firstAnswer, code) ?? site.language(code).meta.description,
      versions: inEveryLanguage(site, (other) => tabPath(site, other, tab.id)),
    },
  };
}

/** Every page of the portfolio, a language at a time: its home page, then
    a page for each of its tabs. */
export const portfolioPages = (site: Site): PortfolioPage[] =>
  site.codes.flatMap((code) => [
    homePage(site, code),
    ...tabsWithPages(site.language(code)).map((tab) => tabPage(site, code, tab)),
  ]);

/** What a route with a rest parameter ([...page]) is given for a page at
    `path`: undefined for the site's root, and "ja/about" for "/ja/about/". */
export const routeParameter = (path: string): string | undefined => path.replace(/^\/|\/$/g, "") || undefined;

/** A page's hreflang links: each of its versions by language, and the main
    language's for any other (x-default), as full addresses. */
export function alternatesOf(site: Site, { versions }: PageHead): Array<{ hreflang: string; href: string }> {
  const mainVersion = versions[site.main];
  return [
    ...Object.entries(versions).map(([code, path]) => ({ hreflang: code, href: site.fileUrl(path) })),
    ...(mainVersion === undefined ? [] : [{ hreflang: "x-default", href: site.fileUrl(mainVersion) }]),
  ];
}

/** Where a link in the config to a tab goes from the page in `code`:
    "#about" to the about tab's page in that language, and "#top" to the
    language's home page. Undefined for any other link. */
export function tabLinkPath(site: Site, code: string, href: string): string | undefined {
  if (!href.startsWith("#")) return undefined;
  const tabId = href.slice(1);
  if (tabId === PAGE_IDS.home) return site.home(code);
  const isTabWithAPage = tabsWithPages(site.language(code)).some((tab) => tab.id === tabId);
  return isTabWithAPage ? tabPath(site, code, tabId) : undefined;
}

/** A link in the config, as the page in `code` writes it: one to a tab is
    to its page (tabLinkPath), and any other is as site.link() has it. */
export const pageLink = (site: Site, code: string, href: string): string =>
  site.link(tabLinkPath(site, code, href) ?? href);
