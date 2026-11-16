/* The check of the tabs' pages' paths. Each thread's page is at /<id>/, and
   each personal answer's at /personal-<id>/ (in another language, under
   /<code>/), beside what else the site has at its root: each language's
   folder, its own files, and the files in public/. No tab's page can take
   one of their paths. */

import { ASK_PATH } from "../../contracts/ask.ts";
import { personalTabId } from "../../contracts/page-ids.ts";
import type { Site } from "../site.ts";
import type { ProblemUnless } from "./reporting.ts";

/** The site's own paths at its root, by name, as a problem says what each
    is. */
const SITES_OWN_PATHS: Record<string, string> = {
  assets: "where the site's pictures, icons and fonts are",
  _astro: "where the build puts the site's script and stylesheet",
  [ASK_PATH.slice(1)]: "where Ask's Worker answers",
  blog: "which is kept for a blog",
};

/** A page a host serves at /about/ can be a file about.html as well as a
    folder about/. */
const PAGE_FILE = /\.html$/;

/** What's at the root of the site by each name a page's path could have,
    as a problem says what it is. Hosts aren't all strict about case in a
    path, so the names are in lowercase. */
function pathsTaken(site: Site, publicRoot: string[]): Map<string, string> {
  const taken = new Map<string, string>();
  for (const name of publicRoot) taken.set(name.replace(PAGE_FILE, "").toLowerCase(), `where public/${name} is served`);
  for (const [name, what] of Object.entries(SITES_OWN_PATHS)) taken.set(name, what);
  for (const code of site.codes) taken.set(code.toLowerCase(), `where the ${code} language's own page is`);
  return taken;
}

/** The ids are the same in every language (whole-site.ts), and only the
    main one's pages are at the root. `publicRoot` is what public/ has at
    its root, by name: "assets", "_redirects". */
export function checkTabPaths(site: Site, publicRoot: string[], problemUnless: ProblemUnless): void {
  const taken = pathsTaken(site, publicRoot);
  const { threads, questions } = site.language(site.main);
  const tabs = [
    ...threads.map(({ id }) => ({ id, tabId: id, kind: "thread" })),
    ...questions.personal.map(({ id }) => ({ id, tabId: personalTabId(id), kind: "personal answer" })),
  ];
  for (const { id, tabId, kind } of tabs) {
    const takenBy = taken.get(tabId.toLowerCase());
    problemUnless(
      takenBy === undefined,
      `the ${kind} "${id}" would have its page at /${tabId}/, ${takenBy}: pick another ${kind} id`,
    );
  }
}
