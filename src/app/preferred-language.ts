/* A visitor who comes to the main language's page from somewhere else, and
   whose browser would rather read another of the site's languages, goes to
   that language's version of the page, before anything is drawn. Once they
   pick a language themselves (the sidebar's switch, the account menu's
   row), it's theirs: they're never sent anywhere again. Without JavaScript
   every visitor stays where they came in. */
import { ANY_OTHER_LANGUAGE } from "../contracts/tab-pages.ts";
import { local } from "./lib/storage.ts";
import { preferredLanguage } from "./language-choice.ts";
import { root } from "./page.ts";

/** In localStorage: the language the visitor last picked. */
const PICKED_KEY = "portfolio:language";

/** The page's versions, in its head: a link for each language, and one for
    any other (ANY_OTHER_LANGUAGE). */
const VERSIONS = 'link[rel="alternate"][hreflang]';

/** Each version's path on this site, by its language. */
function versionsOfThisPage(): Map<string, string> {
  const versions = new Map<string, string>();
  for (const link of document.querySelectorAll<HTMLLinkElement>(VERSIONS)) {
    // The head names the site's own address; a preview of it is elsewhere.
    versions.set(link.hreflang, new URL(link.href).pathname);
  }
  return versions;
}

/** Opened from a link on this site, Back or Forward to it, or a refresh:
    the visitor is already where they meant to be. */
function cameFromThisSite(): boolean {
  const [navigation] = performance.getEntriesByType("navigation");
  const moved = navigation instanceof PerformanceNavigationTiming && navigation.type !== "navigate";
  return moved || (document.referrer !== "" && new URL(document.referrer).origin === location.origin);
}

/** The path to send the visitor to, or null to stay. */
function betterPath(): string | null {
  // A chat's address (#chat-…), or an old one, is this language's own.
  if (local.get(PICKED_KEY) !== null || location.hash || cameFromThisSite()) return null;
  const versions = versionsOfThisPage();
  const mainVersion = versions.get(ANY_OTHER_LANGUAGE);
  versions.delete(ANY_OTHER_LANGUAGE);
  if (mainVersion !== location.pathname) return null;
  const code = preferredLanguage(navigator.languages, [...versions.keys()]);
  return code === undefined || code === root.lang ? null : (versions.get(code) ?? null);
}

/** Sends the visitor to their language's page, if they'd rather read it:
    true when they're on their way, and nothing else should start. */
export function goToPreferredLanguage(): boolean {
  const path = betterPath();
  if (path === null) return false;
  location.replace(path + location.search);
  return true;
}

/** From now on, following a link to another language's page is the
    visitor's pick. */
export function rememberPickedLanguage(): void {
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[hreflang]") : null;
    const code = link?.getAttribute("hreflang");
    if (code) local.set(PICKED_KEY, code);
  });
}
