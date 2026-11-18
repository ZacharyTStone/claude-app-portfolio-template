/* The config's `activity`: a section of the details panel that lists the
   public repos you pushed to most recently, on GitHub, GitLab or Codeberg,
   as they were when the site was last built (docs/activity.md). */

/** Where your public activity is: your user name on any of the three, one
    at least. Only your public activity is read, never your private work. */
export type Activity = {
  /** Your GitHub user name, as your profile's address has it
      (github.com/alex-example is "alex-example"). */
  github?: string;
  /** Your GitLab user name, on gitlab.com, as your profile's address has
      it (gitlab.com/alex-example is "alex-example"). */
  gitlab?: string;
  /** Your Codeberg user name, as your profile's address has it
      (codeberg.org/alex-example is "alex-example"). */
  codeberg?: string;
};

/** Each place the panel reads public activity from, by its field in
    `activity`, in the order the build and llms.txt name them, with its
    name as a row, the build or llms.txt says it. */
export const ACTIVITY_SERVICES = {
  github: "GitHub",
  gitlab: "GitLab",
  codeberg: "Codeberg",
} as const satisfies Record<keyof Activity, string>;

/** One of the places: "github", "gitlab" or "codeberg". */
export type ActivityService = keyof typeof ACTIVITY_SERVICES;

/** The panel section's name: its heading's id is "panel-activity". It
    comes after the config's own sections. */
export const ACTIVITY_SECTION = "activity";

/** How many repos the section lists, the most recently pushed first. */
export const ACTIVITY_REPOS = 4;

/** The icon of each repo's row: one of the .i-* classes in src/styles. */
export const ACTIVITY_ICON = "skills";
