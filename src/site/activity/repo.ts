/* A repo the panel's activity lists, and what each place it's read from
   (github.ts, gitlab.ts, codeberg.ts) and their list together (recent.ts)
   make of their pushes the same way: each repo once, at its latest push,
   the latest first. */
import { ACTIVITY_SERVICES, type Activity, type ActivityService } from "../../config/activity.ts";

/** A public repo the user pushed to, as the panel lists it. */
export type Repo = {
  /** Where it is: "github", "gitlab" or "codeberg". */
  service: ActivityService;
  /** Its path there, as the place writes it: "alex-example/notes", or on
      GitLab "a-group/a-subgroup/notes". */
  name: string;
  /** Its page, on its own place: "https://github.com/alex-example/notes". */
  url: string;
  /** When the user last pushed to it, in UTC: "2026-11-12T03:04:05Z". */
  pushed: string;
};

/** A user name `activity` gives, and where it's one. */
export type Source = { service: ActivityService; user: string };

/** Each place `activity` names, in ACTIVITY_SERVICES' order. */
export const sourcesOf = (activity: Activity): Source[] =>
  (Object.keys(ACTIVITY_SERVICES) as ActivityService[]).flatMap((service) => {
    const user = activity[service];
    return user ? [{ service, user }] : [];
  });

/** "a", "a and b", "a, b and c"; or with "or" for "and". */
export function inWords(items: string[], conjunction = "and"): string {
  const last = items.at(-1) ?? "";
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} ${conjunction} ${last}` : last;
}

/** "GitHub", "GitHub and Codeberg", "GitHub, GitLab and Codeberg": the
    places `activity` names, as llms.txt says them. */
export const servicesInWords = (activity: Activity): string =>
  inWords(sourcesOf(activity).map(({ service }) => ACTIVITY_SERVICES[service]));

/** A time as the API gave it ("2026-10-31T14:32:23+01:00"), in UTC:
    "2026-10-31T13:32:23Z". One already in UTC is as it was. */
export const inUtc = (time: string): string => new Date(time).toISOString().replace(/\.000Z$/, "Z");

/** Of `pushes`, in any order, the latest for each key (`keyOf`), the
    latest first. */
export function latestOnceBy<Push extends { pushed: string }>(pushes: Push[], keyOf: (push: Push) => string): Push[] {
  const latestFirst = pushes.toSorted((one, other) => Date.parse(other.pushed) - Date.parse(one.pushed));
  const latest = new Map<string, Push>();
  for (const push of latestFirst) if (!latest.has(keyOf(push))) latest.set(keyOf(push), push);
  return [...latest.values()];
}

/** Each repo once, at its latest push, the latest first: of `pushes`, a
    Repo for each push, in any order. A repo is the same however its name is
    cased, but not on another place: each row links to its own. */
export const latestOnce = (pushes: Repo[]): Repo[] =>
  latestOnceBy(pushes, (repo) => `${repo.service}:${repo.name.toLowerCase()}`);
