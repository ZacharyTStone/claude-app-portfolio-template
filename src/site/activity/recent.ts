/* The panel's activity from every place the config names: each one's
   recent public repos (github.ts, gitlab.ts, codeberg.ts), asked for at
   once, then listed together. */
import { ACTIVITY_REPOS, type Activity, type ActivityService } from "../../config/activity.ts";
import type { AskOptions } from "./asking.ts";
import { codebergRepos } from "./codeberg.ts";
import { githubRepos } from "./github.ts";
import { gitlabRepos } from "./gitlab.ts";
import { latestOnce, sourcesOf, type Repo } from "./repo.ts";

export type ActivityOptions = AskOptions & {
  /** A token to ask GitHub with, from GITHUB_TOKEN: none, unless the
      build's environment has one. It goes to GitHub alone. */
  githubToken?: string;
};

/** The public repos `activity`'s user pushed to most recently, wherever,
    the latest first, as many as the panel lists: each repo once, at its
    latest push, on its own place. Throws, saying why and where, if any
    place can't be read: of those that can't, the first in
    ACTIVITY_SERVICES' order, whichever answered first. */
export async function recentRepos(activity: Activity, options: ActivityOptions): Promise<Repo[]> {
  const { githubToken, ...asking } = options;
  const reposOn: Record<ActivityService, (user: string) => Promise<Repo[]>> = {
    github: (user) => githubRepos(user, { ...asking, token: githubToken }),
    gitlab: (user) => gitlabRepos(user, asking),
    codeberg: (user) => codebergRepos(user, asking),
  };
  const read = await Promise.allSettled(sourcesOf(activity).map(({ service, user }) => reposOn[service](user)));
  const failed = read.find((one) => one.status === "rejected");
  if (failed) throw failed.reason;
  return latestOnce(read.flatMap((one) => (one.status === "fulfilled" ? one.value : []))).slice(0, ACTIVITY_REPOS);
}
