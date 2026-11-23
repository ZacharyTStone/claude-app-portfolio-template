/* Where a tab's own page is, and what its window is called. The build
   writes a page for each thread and each personal answer with its tab open
   (src/site/pages.ts), and the script reads an address back to the tab it
   names as it moves between them in place (src/app/tab-addresses.ts). */

import { ID_PATTERN } from "../config/language.ts";

/** A tab's page is its id under its language's home page, with the slash
    every page's path ends with: tabPagePath("/ja/", "about") is
    "/ja/about/", and on a site served under a path,
    tabPagePath("/portfolio/ja/", "about") is "/portfolio/ja/about/". */
export const tabPagePath = (home: string, tabId: string): string => `${home}${tabId}/`;

/** The tab whose page `path` is, in the language whose home page is at
    `home`: "about" for "/ja/about/" under "/ja/", and for "/ja/about",
    which a host may serve as the same page. Null for the home page itself
    and for any path that isn't a tab's page: another language's ("/ja/"
    under "/"), a file's, a folder's further down. */
export function tabIdInPath(home: string, path: string): string | null {
  if (!path.startsWith(home)) return null;
  const tabId = path.slice(home.length).replace(/\/$/, "");
  return ID_PATTERN.test(tabId) ? tabId : null;
}

/** What joins a tab's name and the site's in the window's title, and the
    two notes of the account menu's clock. */
export const SEPARATOR = " · ";

/** The window's title while a tab is open: "About · Alex Example". A tab's
    page is built with it, and the script gives it to each tab it opens. */
export const tabWindowTitle = (tabName: string, siteName: string): string => `${tabName}${SEPARATOR}${siteName}`;

/** The hreflang of the <link rel="alternate"> in a page's head to its
    version for a visitor in any language the site isn't in: the main
    language's. The script reads them to send a visitor to their own
    language's page (src/app/preferred-language.ts). */
export const ANY_OTHER_LANGUAGE = "x-default";
