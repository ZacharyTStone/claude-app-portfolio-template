/* The classes the components (src/components) write into the page that
   the browser code (src/app) and the browser checks (tests/browser) find
   its parts by. The values are part of the built page, and the stylesheet
   (src/styles) has them typed out, as it can't import them: change one
   here, and change it there. A class only the stylesheet needs isn't here:
   it's written where its element is. */

/** The classes of the page's parts that the browser code finds (or makes
    more of) and the browser checks look for. The stylesheet has the rest.
    Each comment says which element has the class. To see every side that
    counts on one, search for its name here (`PAGE_CLASSES.wordmark`), then
    for the selector made from it (`SELECTOR.wordmark` in src/app,
    `CLASS.wordmark` in tests/browser). */
export const PAGE_CLASSES = {
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
  plays: "plays",
  stage: "stage",
  playButton: "play",
  /** Someone else's words in an answer, with who said them. */
  quote: "quote",
  /** A file card: a small config file's lines under its name. */
  fileCard: "card",
  /** A top bar's button that opens the sidebar as a drawer on a phone, or
      brings it back once it's hidden. */
  menu: "menu",
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
  group: "group",
  /** In the sidebar: the list of a group's rows. */
  tabs: "tabs",
  /** In a group's row: its first line, the tab's name. */
  rowName: "t",
  /** In a group's row: its second line. */
  rowHint: "s",
  /** In the sidebar: around the links to the other languages' pages. */
  lang: "lang",
  /** Around the account row and its menu, at the foot of the sidebar. */
  account: "account",
  /** The account row itself, which opens the account menu. */
  me: "me",
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
