/* The config's `activity`: a section of the details panel that lists the
   public repos you pushed to most recently, as they were when the site was
   last built (docs/github-activity.md). */

/** Where your public activity is. GitHub is the one place there is so far. */
export type Activity = {
  /** Your GitHub user name, as your profile's address has it
      (github.com/alex-example is "alex-example"). Only your public
      activity is read, never your private work. */
  github: string;
};

/** The panel section's name: its heading's id is "panel-activity". It
    comes after the config's own sections. */
export const ACTIVITY_SECTION = "activity";

/** How many repos the section lists, the most recently pushed first. */
export const ACTIVITY_REPOS = 4;

/** The icon of each repo's row: one of the .i-* classes in src/styles. */
export const ACTIVITY_ICON = "skills";
