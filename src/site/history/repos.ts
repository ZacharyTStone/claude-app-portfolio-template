/* The public repos the calendar shows: the config's githubHistory.repos
   picks them from those the build fetched (queries.ts). */
import type { GitHubHistory } from "../../config/github-history.ts";
import type { History, PublicRepo } from "./history.ts";

/** The names `hide` has, as GitHub matches them: in any case. */
const hiddenNames = (repos: GitHubHistory["repos"]): Set<string> =>
  new Set((repos === true || !repos ? [] : repos.hide).map((name) => name.toLowerCase()));

/** The repos the calendar shows: none without `repos`, every one with
    `true`, and all but those `hide` names with it. */
export function shownRepos(history: History, repos: GitHubHistory["repos"]): PublicRepo[] {
  if (!repos) return [];
  const hidden = hiddenNames(repos);
  return history.repos.filter((repo) => !hidden.has(repo.name.toLowerCase()));
}

/** The names `hide` has that are none of the repos fetched: a typo, or a
    repo since renamed, made private or deleted. */
export function hiddenButNotFound(history: History, repos: GitHubHistory["repos"]): string[] {
  const fetched = new Set(history.repos.map((repo) => repo.name.toLowerCase()));
  return [...hiddenNames(repos)].filter((name) => !fetched.has(name));
}
