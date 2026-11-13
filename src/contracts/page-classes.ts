/* Every class the browser code (src/app) or the browser checks
   (tests/browser) count on, in one table: PAGE_CLASSES. The stylesheet
   (src/styles) has the values typed out, as it can't import them: change
   one here, and change it there. A class only the stylesheet needs isn't
   here: it's written where its element is made.

   The table is written in two parts. A class is in the first if a
   component writes it, and in the second if only the script ever puts it
   on an element. */

/** The classes a component (src/components) writes, so the built pages
    have them. The script may make more elements with one: a question sent
    into a chat is a `question` too. Each comment says which element has
    the class. */
const WRITTEN_BY_A_COMPONENT = {
  /** "Skip to content", the first link in the page. */
  skip: "skip",
  /** Who this is and how to reach them, which only shows printed. */
  printHead: "print-head",
  /** Every tab: an <article> for each thread, and for each chat the
      browser code makes. */
  tab: "tab",
  /** A tab's title, in the bar across its top. */
  title: "title",
  /** The part of a tab that scrolls. */
  scroll: "scroll",
  /** A tab's conversation, inside the part that scrolls: its questions
      and answers are this element's children. */
  thread: "thread",
  /** On a tab's title: draws a chevron after it. The browser code takes
      the class off, and puts a real button there for the thread's menu. */
  iconAfter: "ic-after",
  /** A question in a thread: a visitor's message. */
  question: "q",
  /** Text only screen readers get, such as "Question: " before each
      question. */
  srOnly: "sr",
  /** An answer in a thread: what follows a question. */
  answer: "a",
  /** A thread's "Read …" line, which opens onto the file it read. */
  status: "status",
  /** The buttons under a thread's last answer. */
  messageActions: "msg-actions",
  /** A composer: the link under every tab that opens the question card,
      and the box around the home screen's input. */
  composer: "composer",
  /** On the home screen: the line about you. The browser code draws a new
      chat's tagline and the goodbye's text the same way. */
  intro: "intro",
  /** On the home screen: around the box to type a question in and the
      questions to start with. */
  homeAsk: "home-ask",
  /** The button that sends what's typed in that box. */
  homeSend: "send",
  /** The list of questions to start with. */
  prompts: "prompts",
  /** A figure in an answer: bars, a flow or a picture. */
  figure: "fig",
  /** A figure whose picture a visitor plays; in it, what holds the picture
      with its button over it; and the button. */
  playedFigure: "plays",
  stage: "stage",
  playButton: "play",
  /** Someone else's words in an answer, with who said them. */
  quote: "quote",
  /** A file card: a small config file's lines under its name. */
  fileCard: "card",
  /** A top bar's button that opens the sidebar as a drawer on a phone, or
      brings it back once it's hidden. */
  menuButton: "menu",
  /** A button's words, in an element of their own, so a narrow screen can
      show its icon alone and keep its name: the share button's, which say
      "Copied" for a moment, and a played picture's "Play" and "Pause". */
  label: "label",
  /** In the sidebar: your name at the top. The browser code reads the
      site's name from it. */
  wordmark: "wordmark",
  /** In the sidebar: the button that closes it when it's a drawer. */
  drawerClose: "close",
  /** In the sidebar: the list of rows at the top, "New tab" first. */
  nav: "nav",
  /** In that list: the "New tab" row. */
  newTab: "new",
  /** In the sidebar: a group's heading. The browser code makes one more,
      for the visitor's chats. */
  groupHeading: "group",
  /** In the sidebar: the list of a group's rows. */
  groupRows: "tabs",
  /** In a group's row: its first line, the tab's name. */
  rowName: "t",
  /** In a group's row: its second line. */
  rowHint: "s",
  /** In the sidebar: around the links to the other languages' pages. */
  languageSwitch: "lang",
  /** Around the account row and its menu, at the foot of the sidebar. */
  account: "account",
  /** The account row itself, which opens the account menu. */
  accountRow: "me",
  /** In the account menu: the row with your email address. */
  mailRow: "pop-mail",
  /** In the account menu: the line under the clock's two times, which the
      browser code writes. */
  clockNote: "clock-note",
  /** What's on the right of a row in a menu or the panel ("Link"). */
  rowMeta: "meta",
  /** In "Something else": the words of the question it answers. */
  askedQuestion: "q-text",
  /** In "Something else": around the LinkedIn message to copy. */
  draft: "draft",
  /** In "Something else": that message's text. */
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
  /** On the sidebar: the phone drawer is open. */
  drawerOpen: "open",
  /** On the shell: the sidebar, or the panel, is hidden. */
  noSide: "no-side",
  noPanel: "no-panel",
  /** The sidebar's edge, and a panel section's grip; while either is dragged. */
  resizer: "resizer",
  grip: "grip",
  resizing: "resizing",
  dragging: "dragging",
  /** A heading that folds what's under it, the button in it, and folded. */
  foldable: "head-click",
  foldButton: "head-btn",
  folded: "folded",
  /** A tab's title: the button around its words that renames the tab, its
      words, the box it's renamed in, and the chevron for its menu. */
  titleButton: "title-name",
  titleText: "title-text",
  titleInput: "title-input",
  titleMenuButton: "title-chev",
  /** A sidebar row's "…", for its menu. */
  rowMore: "row-more",
  /** What's been sent into a thread, not the portfolio's own messages. */
  sent: "added",
  /** A question /ask found inappropriate, now "Question removed". */
  removed: "removed",
  /** A question just jumped to. */
  flash: "flash",
  /** The "thinking" line while a reply is on its way: its dots, its seconds
      and its word. */
  thinking: "thinking",
  thinkingDots: "dots",
  thinkingTime: "thinking-time",
  thinkingWord: "thinking-word",
  /** A new chat's "who this is", until something's sent in it: the name. */
  chatHello: "chat-hello",
  chatName: "name",
  /** The question card's choices, and a choice's words. */
  options: "options",
  optionLabel: "opt-t",
  /** A submenu, and one shown below its row; a row's menu shown above it. */
  submenu: "sub",
  below: "below",
  above: "above",
  /** A copy icon that copied. */
  done: "done",
  /** The toast, and the toast while it shows. */
  toast: "toast",
  show: "show",
  /** The line under a reply: the tab it's from, or the questions left. */
  from: "from",
  /** Under a typed question, the reply /ask sent (src/contracts/ask.ts), and
      under that the site's own lines it was written from. */
  reply: "reply",
  cited: "cited",
  /** The goodbye "Log out" shows: its contact links, and "Log back in". */
  bye: "bye",
  byeLinks: "bye-links",
  byeBack: "bye-back",
  /** The viewer (viewer.ts): the panel, its bar, the name of what it shows,
      its "Open in a new tab" and "Close" buttons, and where its frame goes;
      on the shell while it's open; on the frame's place until its page has
      loaded. */
  viewer: "viewer",
  viewerBar: "viewer-bar",
  viewerTitle: "viewer-title",
  viewerOpen: "viewer-open",
  viewerClose: "viewer-close",
  viewerFrame: "viewer-frame",
  viewing: "viewing",
  viewerLoading: "loading",
  /** A quote or a file card that comes in when it's scrolled to (seen.ts):
      while it's out of sight; once it has come in; and, when several come
      into view together, how far behind the first each one is. */
  waiting: "waiting",
  seen: "seen",
  seenAfter1: "after-1",
  seenAfter2: "after-2",
  seenAfter3: "after-3",
  /** A picture a visitor plays (play.ts): on its figure while it plays;
      the picture as it moves, put over the still; and that picture once
      it has loaded and shows. */
  playing: "playing",
  moving: "moving",
  movingShown: "shown",
} as const satisfies NoKeyOf<typeof WRITTEN_BY_A_COMPONENT>;

/** The page's classes, by what each names. */
export const PAGE_CLASSES = { ...WRITTEN_BY_A_COMPONENT, ...ADDED_BY_THE_SCRIPT } as const;
