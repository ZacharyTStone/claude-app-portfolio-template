/* The config's `writing`: a Writing tab that lists what you've posted
   elsewhere, as it was when the site was last built (docs/writing.md). */

/** Where your posts are: any of these, at least one. The tab lists every
    public post from all of them together, newest first. */
export type Writing = {
  /** Your Qiita user id, as your profile's address has it
      (qiita.com/alex-example is "alex-example"). Every public post of
      yours is listed, each linking to Qiita. */
  qiita?: string;
  /** Your Zenn user name (zenn.dev/alex_example is "alex_example"). Every
      article of yours is listed, each linking to Zenn. */
  zenn?: string;
  /** Your DEV user name (dev.to/alex-example is "alex-example"). Every
      article of yours is listed, each linking to DEV. */
  dev?: string;
  /** Your note id (note.com/alex_example is "alex_example"): the posts in
      its feed, its latest. */
  note?: string;
  /** Your Medium user name, without its "@" (medium.com/@alex-example is
      "alex-example"): the posts in its feed, its latest ten. */
  medium?: string;
  /** Your Substack's name (alexexample.substack.com is "alexexample"): the
      posts in its feed, its latest twenty. */
  substack?: string;
  /** Your Hatena Blog's address, without "https://"
      ("alex-example.hatenablog.com"): the posts in its feed, its latest. */
  hatena?: string;
  /** Any other blog's RSS or Atom feed: Ghost, WordPress, Blogger, Ameba,
      Tumblr, Hashnode, your own. Each lists the posts the feed has. */
  feeds?: WritingFeed[];
  /** The most posts the tab lists, the newest: 30 lists your latest
      thirty, from every place together. Left out, it lists them all. Each
      post's title is a line Ask reads for every question. */
  latest?: number;
  /** true for the tab to be there before your first post, saying
      writingEmpty. Left out, the tab, its row, its page and its answer in
      Ask come with the first post. Anything else of the config's that opens
      the tab (a row, a link, a topic, a prompt) needs it. */
  showWhenEmpty?: boolean;
  /** true for a Qiita post to open in the site's viewer, beside the
      conversation, in place of a new tab: the build keeps its text and makes
      a page of the site's own of it, which the viewer frames (docs/writing.md).
      Each language then needs strings.viewerOpen and strings.viewerClose. */
  viewer?: boolean;
};

/** A blog's feed, for `writing.feeds`. */
export type WritingFeed = {
  /** The feed's address, RSS or Atom: "https://blog.example.com/rss/". */
  url: string;
  /** What a card calls the place, where the tab has posts from more than
      one: "Alex's blog". Left out, it's the feed's host. */
  name?: string;
};

/** The Writing tab's id: its page's address (/writing/), and the thread the build
    adds to every language's page once there's a post. No thread of a site
    with `writing` can have it (src/site/checks). */
export const WRITING_TAB = "writing";

/** The icon of the Writing tab's row in the sidebar and of each post's
    card: one of the .i-* classes in src/styles. */
export const WRITING_ICON = "pen";
