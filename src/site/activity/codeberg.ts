/* A Codeberg user's recent public activity, from Codeberg's API (which is
   Forgejo's), as the details panel lists it: the public repos they pushed
   to most recently, from the feed of what they did. No token is sent. What
   comes back is checked before anything of it reaches a page, and only
   what the panel shows is kept. */
import * as v from "valibot";
import { ACTIVITY_REPOS } from "../../config/activity.ts";
import { ask, pageAfter, readPages, type AskOptions, type Asking, type EventPage } from "./asking.ts";
import { inUtc, latestOnce, type Repo } from "./repo.ts";

/** codeberg.org, where every repo's page is. */
export const CODEBERG = "https://codeberg.org";

/** Where what a user did is, newest first, a page at a time: only what
    they did themselves, not what was done in the repos they watch. */
export const feedAddress = (user: string, perPage: number): string =>
  `${CODEBERG}/api/v1/users/${encodeURIComponent(user)}/activities/feeds?only-performed-by=true&limit=${perPage}`;

/** The most activities Codeberg gives in a page. */
const PAGE_SIZE = 50;

/** A push, as Forgejo names one: of commits ("commit_repo") or of a tag
    ("push_tag"). A mirror's sync ("mirror_sync_push") is the mirror's
    doing, not the user's, and a deleted branch ("delete_branch") isn't
    counted. */
const PUSHES = ["commit_repo", "push_tag"];

const Id = v.pipe(v.number(), v.integer());

/** "alex-example/notes": an owner and a repo, as a path on codeberg.org,
    neither "." nor "..". */
const REPO_NAME = /^(?!\.{1,2}\/)[A-Za-z0-9_.-]+\/(?!\.{1,2}$)[A-Za-z0-9_.-]+$/;

/** An activity as Forgejo's API has it, but for what the panel doesn't
    show: v.object leaves out every other field, what was pushed among
    them. */
const ActivitySchema = v.object({
  op_type: v.string(),
  /** Whose feed it's in, and who did it: the same, for a push of theirs. */
  user_id: Id,
  act_user_id: Id,
  is_private: v.boolean(),
  created: v.pipe(v.string(), v.isoTimestamp()),
  repo: v.object({ full_name: v.pipe(v.string(), v.regex(REPO_NAME)), private: v.boolean() }),
});

type Activity = v.InferOutput<typeof ActivitySchema>;

const asking = (address: string): Asking<Activity[]> => ({
  service: "codeberg",
  address,
  what: "a list of activities",
  schema: v.array(ActivitySchema),
  headers: { accept: "application/json" },
});

/** Each repo pushed to once, at its latest push, the latest first. Only a
    push counts, only the user's own, and only to a public repo. */
const reposPushedTo = (activities: Activity[]): Repo[] =>
  latestOnce(
    activities
      .filter(
        (activity) =>
          PUSHES.includes(activity.op_type) &&
          activity.act_user_id === activity.user_id &&
          !activity.is_private &&
          !activity.repo.private,
      )
      .map((push) => ({
        service: "codeberg",
        name: push.repo.full_name,
        url: `${CODEBERG}/${push.repo.full_name}`,
        pushed: inUtc(push.created),
      })),
  );

/** The public repos `user` pushed to most recently on Codeberg, the latest
    first, as many as the panel lists, or fewer if their recent activity
    names fewer. Throws if Codeberg can't be reached, refuses, has no such
    user, or sends anything but a list of activities. */
export async function codebergRepos(user: string, options: AskOptions): Promise<Repo[]> {
  const perPage = options.perPage ?? PAGE_SIZE;
  const readPage = async (address: string): Promise<EventPage<Activity>> => {
    const { got } = await ask(asking(address), options);
    return { events: got, next: pageAfter(address, got.length, perPage) };
  };
  const activities = await readPages(feedAddress(user, perPage), readPage, (read) => reposPushedTo(read).length);
  return reposPushedTo(activities).slice(0, ACTIVITY_REPOS);
}
