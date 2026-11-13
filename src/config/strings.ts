/* The page's wording: each language's `strings` in site.config.ts. Some
   the page shows itself (PAGE_STRING_NAMES); the rest the browser code
   shows (SCRIPT_STRING_ATTRIBUTES): Portfolio.astro writes each of those as
   a data-* attribute on <html>, and src/app/page.ts reads them back as
   `words`, so one script serves every language. */

/** The wording the page itself shows (the browser code's is SCRIPT_STRING_ATTRIBUTES). A page in English has each already (english-strings.ts); any other language's `strings` states them. */
export const PAGE_STRING_NAMES = [
  // The link a keyboard reaches first: "Skip to content".
  "skip",
  // The sidebar's name, for screen readers: "Tabs".
  "tabs",
  // The button in the sidebar that hides it (its label and tooltip), the
  // link that closes it when it's a drawer on a phone, and the button in
  // every top bar that shows it again.
  "hideTabs",
  "closeTabs",
  "showTabs",
  // The button in every top bar that shows or hides the details panel: its
  // label for screen readers, and its shorter tooltip ("Details").
  "panelToggle",
  "panelToggleTitle",
  // The small print under the home screen and under every tab's composer.
  "credit",
  // A tab's share button: "Share".
  "share",
  // The copy icon under a thread's last answer: its label for screen
  // readers ("Copy link to this tab"), and its tooltip ("Copy link").
  "copyTab",
  "copyTitle",
  // Said to screen readers before each question: "Question: ".
  "question",
  // What the composer under every tab says: "Ask a follow-up…".
  "followUpPlaceholder",
  // After your name under that composer, where the app names its model:
  // "Portfolio", to read "Alex Example Portfolio".
  "model",
  "status", // "Read {file}"
  // The details panel's name, for screen readers ("Details"), and its close
  // button's label and tooltip.
  "panel",
  "closePanel",
  "closePanelTitle",
] as const;

/** The page's own wording: a string for each of PAGE_STRING_NAMES. */
export type PageStrings = Record<(typeof PAGE_STRING_NAMES)[number], string>;

/** The wording the browser code shows, and the data-* attribute on <html>
    that carries each to it. The last of them are for the parts only some
    sites have (PART_STRINGS). */
export const SCRIPT_STRING_ATTRIBUTES = {
  // A toast, and for a moment the share button's own words, after a link or
  // a message is copied ("Copied"), or couldn't be ("Couldn't copy").
  copied: "data-copied",
  copyFailed: "data-copy-failed",
  // A thread's menu, under the chevron beside its title: its "Copy link"
  // row.
  menuCopy: "data-menu-copy",
  // What screen readers call that menu and the shorter one on a sidebar
  // row, and the chevron's tooltip: "Thread options".
  menuOptions: "data-menu-options",
  // Its "Rename" row, and the tooltip on a tab's title, which renames too.
  menuRename: "data-menu-rename",
  // Its "Ask a follow-up" row, which opens the question card.
  menuFollowUp: "data-menu-follow-up",
  // Its "Jump to" row, which lists the thread's questions.
  menuJump: "data-menu-jump",
  // The "…" on a sidebar row, which opens the shorter menu: "More options".
  menuMore: "data-menu-more",
  // The "Delete" row a chat has in both menus.
  menuDelete: "data-menu-delete",
  // While a reply is on its way: what screen readers hear ("Thinking…"),
  // and the words one is picked from to show beside the seconds it's taken,
  // with "|" between them ("Thinking|Pondering|Mulling").
  thinking: "data-thinking",
  thinkingWords: "data-thinking-words",
  // The heading of the sidebar group the visitor's chats are listed under
  // ("Chats"), and the toast when one is deleted ("Chat deleted").
  chats: "data-chats",
  chatDeleted: "data-chat-deleted",
  // A chat's name until something is asked in it: "New chat".
  newChat: "data-new-chat",
  // The grip that drags a section of the details panel, with {name} for
  // the section's heading: "Move {name}".
  moveSection: "data-move-section",
  // The sidebar's edge, which drags to resize it: "Resize the tabs".
  resize: "data-resize",
  // Under an answer picked for a typed question, with {tab} for the name
  // of the tab it's from, as a link: "From the {tab} tab".
  askFrom: "data-ask-from",
  // What replaces a question /ask found inappropriate: "Question removed".
  askRemoved: "data-ask-removed",
  // The reply past a visitor's questions for the day, with {limit} for how
  // many that is (Markdown, so it can link to a tab), and the note under a
  // reply when only {n} are left.
  askLimited: "data-ask-limited",
  askLeft: "data-ask-left",
  // Under a reply /ask sent: where a personal answer is from.
  askFromPersonal: "data-ask-from-personal",
  // Wording for the parts only some sites have. A site needs one of these
  // only when it has the part (src/site/checks says which are missing),
  // and its page carries the ones it has.
  // The viewer (the config's `viewer`): its two buttons, "Open in a new
  // tab" and "Close".
  viewerOpen: "data-viewer-open",
  viewerClose: "data-viewer-close",
  // A picture a visitor plays (an `image` with a `still`, whose file says
  // how long it plays): its button, "Play" and, while it plays, "Pause".
  play: "data-play",
  pause: "data-pause",
} as const;

/** The name of a script string. */
export type ScriptStringName = keyof typeof SCRIPT_STRING_ATTRIBUTES;

/** Every script string a page can carry, by name, in the order the page
    carries them. */
export const SCRIPT_STRING_NAMES = Object.keys(SCRIPT_STRING_ATTRIBUTES) as ScriptStringName[];

/** The optional script strings each part needs. */
export const PART_STRINGS = {
  viewer: ["viewerOpen", "viewerClose"],
  movingPictures: ["play", "pause"],
} as const satisfies Record<string, readonly ScriptStringName[]>;

/** The name of a script string only a site with its part needs. */
type OptionalScriptStringName = (typeof PART_STRINGS)[keyof typeof PART_STRINGS][number];

/** The name of a script string every site needs. */
type RequiredScriptStringName = Exclude<ScriptStringName, OptionalScriptStringName>;

const OPTIONAL_SCRIPT_STRING_NAMES: readonly ScriptStringName[] = Object.values(PART_STRINGS).flat();

/** The script strings every language has, by name. */
export const REQUIRED_SCRIPT_STRING_NAMES = SCRIPT_STRING_NAMES.filter(
  (name): name is RequiredScriptStringName => !OPTIONAL_SCRIPT_STRING_NAMES.includes(name),
);

/** The script's wording as it reads it from the page: an optional string
    the page doesn't carry is "". */
export type ScriptStrings = Record<ScriptStringName, string>;

/** A language's wording: every page and script string, and the optional
    script strings for the parts the site has (the build says which are
    missing). */
export type Strings = PageStrings &
  Record<RequiredScriptStringName, string> &
  Partial<Record<OptionalScriptStringName, string>>;
