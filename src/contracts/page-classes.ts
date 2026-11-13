/* Every class the browser code (src/app) or the browser checks
   (tests/browser) count on. The stylesheet has the values typed out, as it
   can't import them, and tests/styles/names.test.ts holds the two
   together. A class only the stylesheet needs isn't here.

   A class's key is its name in whole words: `rowName` is "row-name"
   (tests/contracts/page-classes.test.ts). A comment says what the name
   can't. */

/** The classes a component (src/components) writes, so the built pages
    have them. The script may make more elements with one: a question sent
    into a chat is a `question` too. */
const WRITTEN_BY_A_COMPONENT = {
  /** "Skip to content", the first link in the page. */
  skip: "skip",
  /** Who this is and how to reach them, which only shows printed; and in
      it, your name. */
  printHead: "print-head",
  printName: "print-name",
  /** Around the sidebar, the open tab and the details panel. The browser
      code sets the sidebar's width on it, and marks on it what's hidden. */
  shell: "shell",
  /** An <article> for each thread, and for each chat the browser code
      makes. */
  tab: "tab",
  /** A tab's, in the bar across its top. */
  title: "title",
  /** The part of a tab that scrolls. */
  scroll: "scroll",
  /** A tab's conversation: its questions and answers are this element's
      children. */
  thread: "thread",
  /** On a tab's title: draws a chevron after it. The browser code takes
      the class off, and puts a real button there for the thread's menu. */
  iconAfter: "icon-after",
  question: "question",
  /** Text only screen readers get, such as "Question: " before each
      question. */
  srOnly: "sr-only",
  answer: "answer",
  /** A thread's "Read …" line, which opens onto the file it read. */
  status: "status",
  /** The buttons under a thread's last answer. */
  messageActions: "message-actions",
  /** The link under every tab that opens the question card, and the box
      around the home screen's input. */
  composer: "composer",
  /** The home screen under its top bar. It carries the greeting's wording
      for the browser code (DATA.greet, DATA.tagline). */
  homeBody: "home-body",
  /** The big line with the sparkle before it: the home screen's greeting,
      the not-found page's heading and, made by the browser code, the
      goodbye's. */
  hello: "hello",
  /** On the home screen: the line about you. The browser code draws a new
      chat's tagline and the goodbye's text the same way, and the not-found
      page its lines. */
  intro: "intro",
  /** Around the home screen's box to type a question in and the questions
      to start with; the box's button; and the list of those questions. */
  homeAsk: "home-ask",
  homeSend: "home-send",
  prompts: "prompts",
  /** In an answer: bars, a flow or a picture. */
  figure: "figure",
  /** A figure whose picture a visitor plays; in it, what holds the picture
      with its button over it; and the button. */
  playedFigure: "played-figure",
  stage: "stage",
  playButton: "play-button",
  quote: "quote",
  fileCard: "file-card",
  /** A top bar's button that opens the sidebar as a drawer on a phone, or
      brings it back once it's hidden. */
  menuButton: "menu-button",
  /** A button's words, in an element of their own, so a narrow screen can
      show its icon alone and keep its name: the share button's, which say
      "Copied" for a moment, and a played picture's "Play" and "Pause". */
  label: "label",
  /** Your name at the top of the sidebar. The browser code reads the
      site's name from it. */
  wordmark: "wordmark",
  drawerClose: "drawer-close",
  /** The sidebar's list of rows at the top, and its "New tab" row. */
  nav: "nav",
  newTab: "new-tab",
  /** In the sidebar. The browser code makes one more group, for the
      visitor's chats. */
  groupHeading: "group-heading",
  groupRows: "group-rows",
  /** In a group's row: its first line, the tab's name, and its second. */
  rowName: "row-name",
  rowHint: "row-hint",
  /** In the sidebar: around the links to the other languages' pages. */
  languageSwitch: "language-switch",
  /** Around the account row and its menu, at the foot of the sidebar; and
      the row itself, which opens the menu. */
  account: "account",
  accountRow: "account-row",
  /** In the account menu: the row with your email address. */
  mailRow: "mail-row",
  /** In the account menu: each of the clock's two times, and the line
      under them, which the browser code writes. */
  clockTime: "clock-time",
  clockNote: "clock-note",
  /** In the details panel: a section's list of rows. */
  panelRows: "panel-rows",
  /** What's on the right of a row in a menu or the panel ("Link"). */
  rowMeta: "row-meta",
  /** In "Something else": the words of the question it answers; around the
      LinkedIn message to copy; and that message's text. */
  askedQuestion: "asked-question",
  draft: "draft",
  draftText: "draft-text",
} as const;

/** A key the components' classes already have doesn't compile here: the
    two parts are one table, where a key names one class. */
type NoKeyOf<Taken> = Record<string, string> & { readonly [Key in keyof Taken]?: never };

/** The classes only the script (src/app) puts on an element: no built page
    has one. */
const ADDED_BY_THE_SCRIPT = {
  /** On <html>: what needs JavaScript can show. */
  js: "js",
  /** On the sidebar, as a phone's drawer. */
  drawerOpen: "drawer-open",
  /** On the shell: the sidebar, or the panel, is hidden. */
  noSide: "no-side",
  noPanel: "no-panel",
  /** The sidebar's edge, and a panel section's grip; while either is dragged. */
  resizer: "resizer",
  grip: "grip",
  resizing: "resizing",
  dragging: "dragging",
  /** A heading that folds what's under it, the button in it, and folded. */
  foldable: "foldable",
  foldButton: "fold-button",
  folded: "folded",
  /** A tab's title: the button around its words that renames the tab, its
      words, the box it's renamed in, and the chevron for its menu. */
  titleButton: "title-button",
  titleText: "title-text",
  titleInput: "title-input",
  titleMenuButton: "title-menu-button",
  /** A sidebar row's "…", for its menu. */
  rowMore: "row-more",
  /** What's been sent into a thread, not the portfolio's own messages. */
  sent: "sent",
  /** A question /ask found inappropriate, now "Question removed". */
  removed: "removed",
  /** A question just jumped to. */
  flash: "flash",
  /** The line while a reply is on its way: its dots, its seconds and its
      word. */
  thinking: "thinking",
  thinkingDots: "thinking-dots",
  thinkingTime: "thinking-time",
  thinkingWord: "thinking-word",
  /** A new chat's "who this is", until something's sent in it: the name. */
  chatHello: "chat-hello",
  chatName: "chat-name",
  /** The question card's choices, and a choice's words. */
  options: "options",
  optionLabel: "option-label",
  /** A row's words, in a menu or among the card's choices: they take the
      room between what's on the row's left and on its right. */
  rowWords: "row-words",
  /** A submenu, and one shown below its row; a row's menu shown above it. */
  submenu: "submenu",
  below: "below",
  above: "above",
  /** A copy icon that copied. */
  done: "done",
  /** The toast, and the toast while it shows. */
  toast: "toast",
  show: "show",
  /** The line under a reply: the tab it's from, or the questions left. */
  from: "from",
  /** Under a typed question, the reply /ask sent, and under that the
      site's own lines it was written from. */
  reply: "reply",
  cited: "cited",
  /** The goodbye "Log out" shows: its contact links, and "Log back in". */
  bye: "bye",
  byeLinks: "bye-links",
  byeBack: "bye-back",
  /** The viewer's panel, its bar, the name of what it shows, its "Open in
      a new tab" and "Close" buttons, and where its frame goes; on the shell
      while it's open; on the frame's place until its page has loaded. */
  viewer: "viewer",
  viewerBar: "viewer-bar",
  viewerTitle: "viewer-title",
  viewerOpen: "viewer-open",
  viewerClose: "viewer-close",
  viewerFrame: "viewer-frame",
  viewing: "viewing",
  viewerLoading: "viewer-loading",
  /** A quote or a file card that comes in when it's scrolled to: while
      it's out of sight; once it has come in; and, when several come into
      view together, how far behind the first each one is. */
  waiting: "waiting",
  seen: "seen",
  seenAfter1: "seen-after-1",
  seenAfter2: "seen-after-2",
  seenAfter3: "seen-after-3",
  /** A picture a visitor plays: on its figure while it plays; the picture
      as it moves, put over the still; and that picture once it has loaded
      and shows. */
  playing: "playing",
  moving: "moving",
  movingShown: "moving-shown",
} as const satisfies NoKeyOf<typeof WRITTEN_BY_A_COMPONENT>;

/** As selectors they are CLASS_SELECTOR (page-selectors.ts). */
export const PAGE_CLASSES = { ...WRITTEN_BY_A_COMPONENT, ...ADDED_BY_THE_SCRIPT } as const;
