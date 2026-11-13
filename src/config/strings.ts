/* Each language's `strings`: the page's own wording. A page in English
   has each already (english-strings.ts); any other language states them.
   The page shows some itself (PageStrings). The browser code shows the
   rest, which each page carries to it as data-* attributes on <html>, so
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
  /** The copy icon under a thread's last answer, for screen readers: "Copy
      link to this tab". */
  copyTab: string;
  /** That icon's tooltip: "Copy link". */
  copyTitle: string;
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
  "copyTab",
  "copyTitle",
  "question",
  "followUpPlaceholder",
  "model",
  "status",
  "panel",
  "closePanel",
  "closePanelTitle",
] as const satisfies readonly (keyof PageStrings)[];

/** The wording the browser code shows, with the attribute on <html> that
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
} as const;

type ScriptStringName = keyof typeof SCRIPT_STRING_ATTRIBUTES;

/** In the order the page carries them. */
export const SCRIPT_STRING_NAMES = Object.keys(SCRIPT_STRING_ATTRIBUTES) as ScriptStringName[];

/** The script strings a site needs only when it has the part (the build
    says which are missing). */
export const PART_STRINGS = {
  viewer: ["viewerOpen", "viewerClose"],
  movingPictures: ["play", "pause"],
} as const satisfies Record<string, readonly ScriptStringName[]>;

type OptionalScriptStringName = (typeof PART_STRINGS)[keyof typeof PART_STRINGS][number];

const OPTIONAL_SCRIPT_STRING_NAMES: readonly ScriptStringName[] = Object.values(PART_STRINGS).flat();

export const REQUIRED_SCRIPT_STRING_NAMES = SCRIPT_STRING_NAMES.filter(
  (name): name is Exclude<ScriptStringName, OptionalScriptStringName> => !OPTIONAL_SCRIPT_STRING_NAMES.includes(name),
);

/** The script's wording as it reads it from the page: an optional string
    the page doesn't carry is "". Written over `keyof` so that each name
    keeps its comment where an editor shows it. */
export type ScriptStrings = { -readonly [Name in keyof typeof SCRIPT_STRING_ATTRIBUTES]: string };

export type Strings = PageStrings &
  Omit<ScriptStrings, OptionalScriptStringName> &
  Partial<Pick<ScriptStrings, OptionalScriptStringName>>;
