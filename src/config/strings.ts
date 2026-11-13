/* The page's wording: each language's `strings` in site.config.ts. Some
   the page shows itself (PAGE_STRINGS); the rest the browser code shows
   (SCRIPT_STRINGS): Portfolio.astro writes each of those as a data-*
   attribute on <html>, and src/app/page.ts reads them back as `words`, so
   one script serves every language. */

/** The wording the page itself shows (the browser code's is SCRIPT_STRINGS). Every language's `strings` has each of them. */
export const PAGE_STRINGS = [
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

/** The name of one of PAGE_STRINGS. */
export type PageString = (typeof PAGE_STRINGS)[number];

/** The wording the browser code shows, one data-* attribute each on
    <html> (data-copy-failed for copyFailed, and so on). */
export const SCRIPT_STRINGS = [
  // A toast, and for a moment the share button's own words, after a link or
  // a message is copied ("Copied"), or couldn't be ("Couldn't copy").
  "copied",
  "copyFailed",
  // A thread's menu, under the chevron beside its title: its "Copy link"
  // row.
  "menuCopy",
  // What screen readers call that menu and the shorter one on a sidebar
  // row, and the chevron's tooltip: "Thread options".
  "menuOptions",
  // Its "Rename" row, and the tooltip on a tab's title, which renames too.
  "menuRename",
  // Its "Ask a follow-up" row, which opens the question card.
  "menuFollowUp",
  // Its "Jump to" row, which lists the thread's questions.
  "menuJump",
  // The "…" on a sidebar row, which opens the shorter menu: "More options".
  "menuMore",
  // The "Delete" row a chat has in both menus.
  "menuDelete",
  // While a reply is on its way: what screen readers hear ("Thinking…"),
  // and the words one is picked from to show beside the seconds it's taken,
  // with "|" between them ("Thinking|Pondering|Mulling").
  "thinking",
  "thinkingWords",
  // The heading of the sidebar group the visitor's chats are listed under
  // ("Chats"), and the toast when one is deleted ("Chat deleted").
  "chats",
  "chatDeleted",
  // A chat's name until something is asked in it: "New chat".
  "newChat",
  // The grip that drags a section of the details panel, with {name} for
  // the section's heading: "Move {name}".
  "moveSection",
  // The sidebar's edge, which drags to resize it: "Resize the tabs".
  "resize",
  // Under an answer picked for a typed question, with {tab} for the name
  // of the tab it's from, as a link: "From the {tab} tab".
  "askFrom",
  // What replaces a question /ask found inappropriate: "Question removed".
  "askRemoved",
  // The reply past a visitor's questions for the day, with {limit} for how
  // many that is (Markdown, so it can link to a tab), and the note under a
  // reply when only {n} are left.
  "askLimited",
  "askLeft",
  // Under a reply /ask sent: where a personal answer is from.
  "askFromPersonal",
] as const;

/** The name of one of SCRIPT_STRINGS. */
export type ScriptString = (typeof SCRIPT_STRINGS)[number];

/** Wording for the parts only some sites have. A site needs one of these
    only when it has the part (src/site/validate.ts says which are missing),
    and its page carries the ones it has, as it does SCRIPT_STRINGS. */
export const OPTIONAL_SCRIPT_STRINGS = [
  // The viewer (the config's `viewer`): its two buttons, "Open in a new
  // tab" and "Close".
  "viewerOpen",
  "viewerClose",
  // A picture a visitor plays (an `image` with a `still`, whose file says
  // how long it plays): its button, "Play" and, while it plays, "Pause".
  "play",
  "pause",
] as const;

/** The name of one of OPTIONAL_SCRIPT_STRINGS. */
export type OptionalScriptString = (typeof OPTIONAL_SCRIPT_STRINGS)[number];

/** The optional script strings each part needs. */
export const PART_STRINGS = {
  viewer: ["viewerOpen", "viewerClose"],
  movingPictures: ["play", "pause"],
} as const satisfies Record<string, readonly OptionalScriptString[]>;

/** Every script string a page can carry. */
export const ALL_SCRIPT_STRINGS = [...SCRIPT_STRINGS, ...OPTIONAL_SCRIPT_STRINGS] as const;

/** The script's wording as it reads it from the page: an optional string
    the page doesn't carry is "". */
export type ScriptStrings = Record<ScriptString | OptionalScriptString, string>;

/** The data-* attribute for a script string: copyFailed → copy-failed
    (each capital becomes a dash and its small letter). */
export const dataAttribute = (key: string): string => key.replace(/[A-Z]/g, (capital) => `-${capital.toLowerCase()}`);

/** A language's wording: every page and script string, and the optional
    script strings for the parts the site has (the build says which are
    missing). */
export type Strings = Record<PageString | ScriptString, string> & Partial<Record<OptionalScriptString, string>>;
