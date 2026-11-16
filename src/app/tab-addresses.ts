/* What an address names on the page: the tab it has open, what a link to it
   does, and the tab's own address to keep in its place. A thread and a
   personal answer each have a page of their own ("/about/", "/ja/about/"),
   built with that tab open. A chat, kept in this browser alone, and
   "Something else" are a #id on their language's home page
   ("/#chat-l2x8f"). An old address names a tab by its #id on any page
   ("/#about"), and #top the home screen. It needs no page: what the page has
   comes through `kindOf`. */
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { tabIdInPath, tabPagePath } from "../contracts/tab-pages.ts";

/** What the page has under an id: a tab with a page of its own, a tab with
    none, another of its parts (#tabs, #main), or nothing. */
export type IdKind = "tab with a page" | "tab" | "part" | null;

/** Where the page is: its origin, its language's home page ("/", "/ja/"),
    and what it has under each id. */
export type Here = { origin: string; home: string; kindOf: (id: string) => IdKind };

/** Where a link takes a visitor in place: to a tab, by its id, or to the
    home screen (null). */
export type Place = { tab: string | null };

const isTab = (kind: IdKind): boolean => kind === "tab with a page" || kind === "tab";

/** The id after an address's #: "about" for "/#about", "" for none. */
const idAfterHash = (url: URL): string => url.hash.slice(1);

/** What an address's #id names, for the tab it has open: a tab, the home
    screen (#top), another part of the page (#tabs), or nothing; "none" if
    it has no #id at all. */
function hashNames(url: URL, here: Here): "tab" | "home" | "part" | "nothing" | "none" {
  const id = idAfterHash(url);
  if (!id) return "none";
  if (id === PAGE_IDS.home) return "home";
  const kind = here.kindOf(id);
  if (kind === "part") return "part";
  return isTab(kind) ? "tab" : "nothing";
}

/** The tab whose page an address's path is, if this language has it. */
function tabAtPath(url: URL, { home, kindOf }: Here): string | null {
  const tabId = tabIdInPath(home, url.pathname);
  return tabId !== null && kindOf(tabId) === "tab with a page" ? tabId : null;
}

/** The tab an address has open: the one its #id names (a chat's, or an old
    address's), or else the one whose page its path is. Null for the home
    screen, which #top names too. */
export function openTabIn(url: URL, here: Here): string | null {
  const named = hashNames(url, here);
  if (named === "home") return null;
  return named === "tab" ? idAfterHash(url) : tabAtPath(url, here);
}

/** A tab's own address: its page's ("/ja/about/"), or for a tab with none
    its #id on the home page ("/ja/#chat-l2x8f"). */
export const ownAddress = (tabId: string, here: Here): string =>
  here.kindOf(tabId) === "tab with a page" ? tabPagePath(here.home, tabId) : `${here.home}#${tabId}`;

/** A place's own address: its tab's, or the home page's. */
export const addressOfPlace = ({ tab }: Place, here: Here): string =>
  tab === null ? here.home : ownAddress(tab, here);

/** Where a link goes in place: to a tab or the home screen of this
    language, on this page. Undefined for any other link, which the browser
    follows: to another site, another language's page or a file, or to a
    part of the page (#tabs). */
export function placeOfLink(url: URL, here: Here): Place | undefined {
  if (url.origin !== here.origin) return undefined;
  const isThisLanguagesPage = url.pathname === here.home || tabAtPath(url, here) !== null;
  const named = hashNames(url, here);
  const isAPartOrNothing = named === "part" || named === "nothing";
  return isThisLanguagesPage && !isAPartOrNothing ? { tab: openTabIn(url, here) } : undefined;
}

/** The address to put in place of `url`, keeping its query, without a step
    in the history; null when it's right as it is. That's the open tab's own
    address: an old #about becomes /about/, #top the home page, and /about
    /about/, and a #id that names nothing (a chat a refresh ended) goes. One
    that names a part of the page (#tabs) stays. */
export function addressToKeep(url: URL, here: Here): string | null {
  if (hashNames(url, here) === "part") return null;
  const own = addressOfPlace({ tab: openTabIn(url, here) }, here);
  if (own === url.pathname + url.hash) return null;
  const kept = new URL(own, url);
  kept.search = url.search;
  return kept.pathname + kept.search + kept.hash;
}
