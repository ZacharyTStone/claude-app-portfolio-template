/* The config's `githubHistory`: your whole contribution history on GitHub,
   which the build fetches, drawn as parts an answer places where they fit
   the conversation, each a block of its own ({ github: "calendar" }).
   docs/github-history.md has it all. */

/** Whose history it is, and the moments of it you name. */
export type GitHubHistory = {
  /** Your GitHub user name, as your profile's address has it
      (github.com/alex-example is "alex-example"). The build asks GitHub's
      GraphQL API for it, which needs a token in GITHUB_TOKEN. */
  user: string;
  /** Moments to name on the calendar, each a small tick at its month with
      its name beside it: where a job or a project began. One or two a
      year read best. */
  marks?: HistoryMark[];
  /** Your public repos on the calendar: each a dot under the week you
      made it, and under its year's row, its name as a link to it. Only
      your own that aren't forks and have code in them; your profile's
      README repo (named as you are) is left out. `true` shows them all,
      `{ hide: ["dotfiles"] }` all but those it names. */
  repos?: true | HiddenRepos;
};

/** { hide: ["dotfiles"] }. */
type HiddenRepos = {
  /** The repos to leave off the calendar, by their names on GitHub, in
      any case: "dotfiles". */
  hide: string[];
};

/** { at: "2022-04", label: "Rapptr Labs" }. */
export type HistoryMark = {
  /** The month, as "YYYY-MM": "2022-04". It has to be in a year the
      calendar shows. */
  at: string;
  /** A name, the same in every language: "Rapptr Labs". */
  label: string;
};

/** The parts of the history an answer can show, each a block of its own:
    "stats" (the totals, the longest streak and the busiest day),
    "calendar" (every week, a row a year), "languages" (of your public
    repos, by size) and "rhythm" (by day of the week). */
export const GITHUB_PARTS = ["stats", "calendar", "languages", "rhythm"] as const;

export type GitHubPart = (typeof GITHUB_PARTS)[number];
