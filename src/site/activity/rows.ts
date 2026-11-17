/* The panel's GitHub activity, made from the repos the build fetched: a
   row for each, in the panel's row style, linking to the repo, with the
   day it was last pushed to on the right. */
import { ACTIVITY_ICON } from "../../config/activity.ts";
import type { PanelRow } from "../../config/language.ts";
import type { Repo } from "./github.ts";

/** The day as the page's language writes it, by the owner's clock
    (`timeZone`, the config's): "Nov 12, 2026", "2026/11/12". Written as
    "2026-11-12" (UTC) for a language the platform doesn't know. */
export function dayPushed(repo: Repo, pageLanguage: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(pageLanguage, { dateStyle: "medium", timeZone }).format(Date.parse(repo.pushed));
  } catch {
    return repo.pushed.slice(0, "YYYY-MM-DD".length);
  }
}

/** "notes" for one of the user's own repos; "someone/tool" for another's. */
export function repoLabel(repo: Repo, user: string): string {
  const [owner = "", name = repo.name] = repo.name.split("/");
  return owner.toLowerCase() === user.toLowerCase() ? name : repo.name;
}

/** A row for each repo, as the panel lists them, the latest first. */
export const activityRows = (repos: Repo[], user: string, pageLanguage: string, timeZone: string): PanelRow[] =>
  repos.map((repo) => ({
    label: repoLabel(repo, user),
    meta: dayPushed(repo, pageLanguage, timeZone),
    icon: ACTIVITY_ICON,
    href: repo.url,
  }));
