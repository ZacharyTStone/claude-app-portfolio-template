/* The config's `writing`: a Writing tab that lists what you've posted
   elsewhere, as it was when the site was last built (docs/writing.md). */

/** Where your posts are. Qiita is the one place there is so far. */
export type Writing = {
  /** Your Qiita user id, as your profile's address has it
      (qiita.com/alex-example is "alex-example"). Every public post of
      yours is listed, newest first, each linking to Qiita. */
  qiita: string;
  /** true for the tab to be there before your first post, saying
      writingEmpty. Left out, the tab, its row, its page and its answer in
      Ask come with the first post. Anything else of the config's that opens
      the tab (a row, a link, a topic, a prompt) needs it. */
  showWhenEmpty?: boolean;
};

/** The Writing tab's id: its page's address (/writing/), and the thread the build
    adds to every language's page once there's a post. No thread of a site
    with `writing` can have it (src/site/checks). */
export const WRITING_TAB = "writing";

/** The icon of the Writing tab's row in the sidebar and of each post's
    card: one of the .i-* classes in src/styles. */
export const WRITING_ICON = "pen";
