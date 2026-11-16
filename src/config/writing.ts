/* The config's `writing`: a Writing tab that lists what you've posted
   elsewhere, as it was when the site was last built (docs/writing.md). */

/** Where your posts are. Qiita is the one place there is so far. */
export type Writing = {
  /** Your Qiita user id, as your profile's address has it
      (qiita.com/alex-example is "alex-example"). Every public post of
      yours is listed, newest first, each linking to Qiita. */
  qiita: string;
};

/** The Writing tab's id: its address (#writing), and the thread the build
    adds to every language's page. No thread of a site with `writing` can
    have it (src/site/checks). */
export const WRITING_TAB = "writing";

/** The icon of the Writing tab's row in the sidebar and of each post's
    card: one of the .i-* classes in src/styles. */
export const WRITING_ICON = "pen";
