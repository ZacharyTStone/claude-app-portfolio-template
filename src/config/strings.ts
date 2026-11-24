/* Each language's `strings`: the page's own wording. A page in English
   has each already (english-strings.ts); any other language states them.
   The page shows some itself (PageStrings). The browser code shows the
   rest, which each page carries to it as data-* attributes on <body>, so
   one script serves every language (SCRIPT_STRING_ATTRIBUTES). */

export type PageStrings = {
  /** The link a keyboard reaches first: "Skip to content". */
  skip: string;
  /** The sidebar's name, for screen readers: "Tabs". */
  tabs: string;
  /** The button in the sidebar that hides it, as its label and tooltip:
      "Hide tabs". */
  hideTabs: string;
  /** The link that closes the sidebar when it's a drawer on a phone:
      "Close tabs". */
  closeTabs: string;
  /** The button in every top bar that shows the sidebar again: "Show tabs". */
  showTabs: string;
  /** The button in every top bar that shows or hides the details panel,
      for screen readers: "Show or hide the details panel". */
  panelToggle: string;
  /** That button's tooltip, shorter: "Details". */
  panelToggleTitle: string;
  /** The small print under the home screen and under every tab's composer. */
  credit: string;
  /** A tab's share button: "Share". */
  share: string;
  /** Said to screen readers before each question: "Question: ". */
  question: string;
  /** What the composer under every tab says: "Ask a follow-up…". */
  followUpPlaceholder: string;
  /** After your name under that composer, where the app names its model:
      "Portfolio", to read "Alex Example Portfolio". */
  model: string;
  /** The line over an answer that opens onto a file card, with {file}
      where the file's name goes (the build checks it's there): "Read
      {file}". */
  status: string;
  /** The details panel's name, for screen readers: "Details". */
  panel: string;
  /** The panel's close button, for screen readers: "Close the details
      panel". */
  closePanel: string;
  /** That button's tooltip: "Close". */
  closePanelTitle: string;
};

/** The contact form's wording (the config's contactForm), which the page
    shows itself, so that it's there without JavaScript. Only a site with
    the form needs it (PART_STRINGS). */
export type ContactFormStrings = {
  /** The label of the box for the visitor's address: "Your email". */
  contactEmail: string;
  /** The label of the box for their message: "Message". */
  contactMessage: string;
  /** The button that sends it: "Send". */
  contactSend: string;
  /** Under the form once the message has gone: "Sent, thanks. You’ll get
      a reply by email." */
  contactSent: string;
  /** Under the form when it hasn't, with {email} where your address goes,
      as a link: "That didn’t send. Try again later, or email {email}." */
  contactFailed: string;
};

/** Every name in ContactFormStrings. */
export const CONTACT_FORM_STRING_NAMES = [
  "contactEmail",
  "contactMessage",
  "contactSend",
  "contactSent",
  "contactFailed",
] as const satisfies readonly (keyof ContactFormStrings)[];

/** The page's wording for sending the contact form a question Ask has no
    answer for, on a site with both `ask` and `contactForm` (PART_STRINGS). */
export type AskFormStrings = {
  /** In the reply to such a question, the link that opens the form's tab
      with the question in its message box: "Send it with the contact
      form". */
  askForm: string;
};

/** Every name in AskFormStrings. */
export const ASK_FORM_STRING_NAMES = ["askForm"] as const satisfies readonly (keyof AskFormStrings)[];

/** Every name in PageStrings (tests/config/field-docs.test.ts holds the
    two together). */
export const PAGE_STRING_NAMES = [
  "skip",
  "tabs",
  "hideTabs",
  "closeTabs",
  "showTabs",
  "panelToggle",
  "panelToggleTitle",
  "credit",
  "share",
  "question",
  "followUpPlaceholder",
  "model",
  "status",
  "panel",
  "closePanel",
  "closePanelTitle",
] as const satisfies readonly (keyof PageStrings)[];

/** The page's wording for the Writing tab, on a site with `writing`
    (PART_STRINGS). */
export type WritingStrings = {
  /** The tab's name, in the sidebar's row for it and its top bar:
      "Writing". */
  writingTitle: string;
  /** The visitor's question in it: "what have they written?". */
  writingQuestion: string;
  /** The line over the posts, newest first: "Posts, newest first:". */
  writingIntro: string;
  /** What the tab says while there are no posts, on a site whose tab is
      there before the first post (writing.showWhenEmpty): "Nothing posted
      yet." */
  writingEmpty: string;
  /** After a post's count of likes, on a site with posts from Zenn or DEV:
      "likes" ("12 likes"). Qiita's are its own word, "LGTM". */
  writingLikes: string;
};

/** The names in WritingStrings that the tab shows with posts. */
export const WRITING_STRING_NAMES = [
  "writingTitle",
  "writingQuestion",
  "writingIntro",
] as const satisfies readonly (keyof WritingStrings)[];

/** The name in WritingStrings that the tab shows with none. */
export const EMPTY_WRITING_STRING_NAMES = ["writingEmpty"] as const satisfies readonly (keyof WritingStrings)[];

/** The name in WritingStrings that a card shows its likes with, on a site
    with posts from a place that counts them in no word of its own. */
export const WRITING_LIKES_STRING_NAMES = ["writingLikes"] as const satisfies readonly (keyof WritingStrings)[];

/** The page's wording for the panel's activity, on a site with
    `activity` (PART_STRINGS). */
export type ActivityStrings = {
  /** The heading of the panel's section, which says the repos are only
      the public ones: "Recent public repos". */
  activityTitle: string;
};

/** Every name in ActivityStrings. */
export const ACTIVITY_STRING_NAMES = ["activityTitle"] as const satisfies readonly (keyof ActivityStrings)[];

/** The page's wording for the parts of your GitHub history, on a site with
    `githubHistory` (PART_STRINGS). Numbers, days and months are the
    page's language's own, from the platform: none of them is here. */
export type HistoryStrings = {
  /** The stats' first tile, over the count of every contribution:
      "Contributions". */
  historyContributions: string;
  /** The stats' tile over the first year the history has: "Since". */
  historySince: string;
  /** The stats' tile over the most days in a row with a contribution:
      "Longest streak". */
  historyStreak: string;
  /** The stats' tile over the most contributions in a day, with the day
      under them: "Busiest day". */
  historyBusiest: string;
  /** Under the stats, when GitHub counts private work, with {n} for how
      many contributions it is: "Includes {n} contributions to private
      repos, in every count and in the calendar. The repos stay private." */
  historyPrivate: string;
  /** The calendar's title, with {year} for its first year: "Contributions,
      every week since {year}". */
  historyCalendar: string;
  /** The calendar's key, before its palest shade: "Less". */
  historyLess: string;
  /** The calendar's key, after its strongest shade: "More". */
  historyMore: string;
  /** The languages' title: "Languages in public repos". */
  historyLanguages: string;
  /** The languages' last bar, for all the rest together: "Other". */
  historyOther: string;
  /** The rhythm's title: "Contributions by day of the week". */
  historyRhythm: string;
};

/** Every name in HistoryStrings. */
export const HISTORY_STRING_NAMES = [
  "historyContributions",
  "historySince",
  "historyStreak",
  "historyBusiest",
  "historyPrivate",
  "historyCalendar",
  "historyLess",
  "historyMore",
  "historyLanguages",
  "historyOther",
  "historyRhythm",
] as const satisfies readonly (keyof HistoryStrings)[];

/** The calendar's wording for your public repos, on a site whose
    `githubHistory` has `repos` (PART_STRINGS). */
export type HistoryRepoStrings = {
  /** The calendar's key, beside the dot each repo has under the week it
      was made: "A public repo, the week it was made". */
  historyRepos: string;
  /** What screen readers call the list of a year's repos, under its row,
      with {year} for the year: "Public repos made in {year}". */
  historyReposIn: string;
};

/** Every name in HistoryRepoStrings. */
export const HISTORY_REPO_STRING_NAMES = [
  "historyRepos",
  "historyReposIn",
] as const satisfies readonly (keyof HistoryRepoStrings)[];

/** The wording the browser code shows, with the attribute on <body> that
    carries each to it. The last four are for the parts only some sites
    have (PART_STRINGS). */
export const SCRIPT_STRING_ATTRIBUTES = {
  /** A toast, and for a moment the share button's own words, after a link
      or a message is copied: "Copied". */
  copied: "data-copied",
  /** The same when it couldn't be copied: "Couldn't copy". */
  copyFailed: "data-copy-failed",
  /** A thread's menu, under the chevron beside its title: its "Copy link"
      row. */
  menuCopy: "data-menu-copy",
  /** What screen readers call that menu and the shorter one on a sidebar
      row, and the chevron's tooltip: "Thread options". */
  menuOptions: "data-menu-options",
  /** The menu's "Rename" row, and the tooltip on a tab's title, which
      renames too. */
  menuRename: "data-menu-rename",
  /** The menu's "Ask a follow-up" row, which opens the question card. */
  menuFollowUp: "data-menu-follow-up",
  /** The menu's "Jump to" row, which lists the thread's questions. */
  menuJump: "data-menu-jump",
  /** The "…" on a sidebar row, which opens the shorter menu: "More
      options". */
  menuMore: "data-menu-more",
  /** The "Delete" row a chat has in both menus. */
  menuDelete: "data-menu-delete",
  /** What screen readers hear while a reply is on its way: "Thinking…". */
  thinking: "data-thinking",
  /** The words one is picked from to show beside the seconds a reply has
      taken, with "|" between them: "Thinking|Pondering|Mulling". */
  thinkingWords: "data-thinking-words",
  /** The heading of the sidebar group the visitor's chats are listed
      under: "Chats". */
  chats: "data-chats",
  /** The toast when a chat is deleted: "Chat deleted". */
  chatDeleted: "data-chat-deleted",
  /** A chat's name until something is asked in it: "New chat". */
  newChat: "data-new-chat",
  /** The grip that drags a section of the details panel, with {name} for
      the section's heading: "Move {name}". */
  moveSection: "data-move-section",
  /** The sidebar's edge, which drags to resize it: "Resize the tabs". */
  resize: "data-resize",
  /** Under an answer picked for a typed question, with {tab} for the name
      of the tab it's from, as a link: "From the {tab} tab". */
  askFrom: "data-ask-from",
  /** What replaces a question /ask found inappropriate: "Question removed". */
  askRemoved: "data-ask-removed",
  /** The reply past a visitor's questions for the day, with {limit} for
      how many that is. It's Markdown, so it can link to a tab. */
  askLimited: "data-ask-limited",
  /** The note under a reply when few questions are left, with {n} for how
      many: "{n} left today." */
  askLeft: "data-ask-left",
  /** Under a reply /ask sent from a personal answer, with {tab} for the
      answer's name: "From “{tab}”". */
  askFromPersonal: "data-ask-from-personal",
  /** With a `viewer`: its button that opens what it shows in a new tab:
      "Open in a new tab". */
  viewerOpen: "data-viewer-open",
  /** With a `viewer`: its close button: "Close". */
  viewerClose: "data-viewer-close",
  /** With a picture a visitor plays (an `image` with a `still`): its
      button, "Play". */
  play: "data-play",
  /** The same button while the picture plays: "Pause". */
  pause: "data-pause",
  /** With the globe's visitors (globe.visitors): beside the visitor's own
      place on it, and all it says of them: "You". */
  globeYou: "data-globe-you",
} as const;

type ScriptStringName = keyof typeof SCRIPT_STRING_ATTRIBUTES;

/** In the order the page carries them. */
export const SCRIPT_STRING_NAMES = Object.keys(SCRIPT_STRING_ATTRIBUTES) as ScriptStringName[];

/** The strings a site needs only when it has the part (the build says
    which are missing): the script's, the contact form's (and its link
    from Ask's reply), the Writing tab's (and its line for no posts, on a
    site whose tab is there before the first, and its word for likes, on a
    site with posts from Zenn or DEV), the panel's activity's own, the
    GitHub history's, and its calendar's repos'. */
export const PART_STRINGS = {
  viewer: ["viewerOpen", "viewerClose"],
  movingPictures: ["play", "pause"],
  contactForm: CONTACT_FORM_STRING_NAMES,
  askForm: ASK_FORM_STRING_NAMES,
  writing: WRITING_STRING_NAMES,
  emptyWriting: EMPTY_WRITING_STRING_NAMES,
  writingLikes: WRITING_LIKES_STRING_NAMES,
  activity: ACTIVITY_STRING_NAMES,
  githubHistory: HISTORY_STRING_NAMES,
  githubRepos: HISTORY_REPO_STRING_NAMES,
  globeVisitors: ["globeYou"],
} as const satisfies Record<
  string,
  readonly (
    | ScriptStringName
    | keyof ContactFormStrings
    | keyof AskFormStrings
    | keyof WritingStrings
    | keyof ActivityStrings
    | keyof HistoryStrings
    | keyof HistoryRepoStrings
  )[]
>;

type OptionalScriptStringName = Extract<(typeof PART_STRINGS)[keyof typeof PART_STRINGS][number], ScriptStringName>;

const OPTIONAL_STRING_NAMES: readonly string[] = Object.values(PART_STRINGS).flat();

export const REQUIRED_SCRIPT_STRING_NAMES = SCRIPT_STRING_NAMES.filter(
  (name): name is Exclude<ScriptStringName, OptionalScriptStringName> => !OPTIONAL_STRING_NAMES.includes(name),
);

/** The script's wording as it reads it from the page: an optional string
    the page doesn't carry is "". Written over `keyof` so that each name
    keeps its comment where an editor shows it. */
export type ScriptStrings = { -readonly [Name in keyof typeof SCRIPT_STRING_ATTRIBUTES]: string };

export type Strings = PageStrings &
  Partial<ContactFormStrings> &
  Partial<AskFormStrings> &
  Partial<WritingStrings> &
  Partial<ActivityStrings> &
  Partial<HistoryStrings> &
  Partial<HistoryRepoStrings> &
  Omit<ScriptStrings, OptionalScriptStringName> &
  Partial<Pick<ScriptStrings, OptionalScriptStringName>>;
