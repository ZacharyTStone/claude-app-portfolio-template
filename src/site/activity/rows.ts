/* The panel's activity, made from the repos the build fetched: a row for
   each, in the panel's row style, linking to the repo on its own place,
   with the day it was last pushed to on the right; and on a site that
   reads more than one place, which one, before the day. */
import { ACTIVITY_ICON, ACTIVITY_SERVICES, type Activity } from "../../config/activity.ts";
import type { PanelRow } from "../../config/language.ts";
import { sourcesOf, type Repo } from "./repo.ts";

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

/** "notes" for one of the user's own repos, by their name on its place;
    "someone/tool" for another's, and on GitLab "a-group/a-subgroup/tool". */
export function repoLabel(repo: Repo, activity: Activity): string {
  const user = activity[repo.service] ?? "";
  const [owner = "", ...path] = repo.name.split("/");
  return owner.toLowerCase() === user.toLowerCase() && path.length ? path.join("/") : repo.name;
}

/** A row for each repo, as the panel lists them, the latest first. Its note
    is the day, after the place's name ("GitLab · Nov 12, 2026") on a site
    whose `activity` names more than one: the same on every row, and every
    build, whichever places the rows are on. */
export function activityRows(repos: Repo[], activity: Activity, pageLanguage: string, timeZone: string): PanelRow[] {
  const namesThePlace = sourcesOf(activity).length > 1;
  return repos.map((repo) => {
    const day = dayPushed(repo, pageLanguage, timeZone);
    return {
      label: repoLabel(repo, activity),
      meta: namesThePlace ? `${ACTIVITY_SERVICES[repo.service]} · ${day}` : day,
      icon: ACTIVITY_ICON,
      href: repo.url,
    };
  });
}
