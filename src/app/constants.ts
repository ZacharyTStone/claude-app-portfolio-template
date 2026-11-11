/* The names and numbers only the script (and the browser checks) count on.
   The names the pages write for it are in src/shared/page-data.ts, and what
   the site says comes from the page (page.ts). */
import { DATA, LOCAL_ZONE, PAGE_CLASSES, PAGE_IDS, panelId } from "../shared/page-data.ts";

export const STORAGE = {
  /** localStorage: the chats, per language (this, then the page's lang). */
  chats: "portfolio:chats:",
  /** localStorage: the names tabs were given, per language. */
  names: "portfolio:names:",
  /** localStorage: the ids of the folded headings. */
  folded: "portfolio:folded",
  /** localStorage: the sidebar's width, once it's been resized. */
  sidebarWidth: "portfolio:sidebar",
  /** localStorage: the order the panel's sections were left in. */
  panelOrder: "portfolio:panel-order",
  /** sessionStorage: what /ask said that stops asking for the visit. */
  askLock: "portfolio:ask-locked",
} as const;

/** The classes the script sets or makes, for the stylesheet and the browser
    checks. A class only the stylesheet needs is written where its element
    is made. */
export const CLASS = {
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
  /** Under a typed question, the reply /ask sent (src/shared/ask.ts). */
  reply: "reply",
  /** The goodbye "Log out" shows: its contact links, and "Log back in". */
  bye: "bye",
  byeLinks: "bye-links",
  byeBack: "bye-back",
} as const;

const has = (attribute: string) => `[${attribute}]`;
const thread = `.${PAGE_CLASSES.thread}`;

/** The parts of the page the script looks for. */
export const SELECTOR = {
  skip: `.${PAGE_CLASSES.skip}`,
  // Around the tabs.
  /** Every tab: one <article> per thread, and each chat. */
  tab: `.${PAGE_CLASSES.tab}`,
  chatTab: has(DATA.chat),
  /** A top bar's button that opens the drawer, or brings the sidebar back. */
  menuButton: `.${PAGE_CLASSES.menu}`,
  panelToggle: has(DATA.panelToggle),
  /** The share button in a top bar, and the copy icon under an answer. */
  copyLink: has(DATA.copyLink),

  // The sidebar.
  wordmark: `.${PAGE_CLASSES.wordmark}`,
  sideToggle: has(DATA.sideToggle),
  drawerClose: `.${PAGE_CLASSES.drawerClose}`,
  newTab: `.${PAGE_CLASSES.nav} .${PAGE_CLASSES.newTab}`,
  navRow: `.${PAGE_CLASSES.nav} a`,
  /** A row in one of the sidebar's groups of tabs. */
  tabRow: `.${PAGE_CLASSES.tabs} > li > a`,
  rowName: `.${PAGE_CLASSES.rowName}`,
  rowHint: `.${PAGE_CLASSES.rowHint}`,
  group: `.${PAGE_CLASSES.group}`,
  foldButton: `.${CLASS.foldButton}`,
  /** The links to the other languages' pages. */
  language: `.${PAGE_CLASSES.lang} a`,
  account: `.${PAGE_CLASSES.account}`,
  /** The account row, which opens the account menu. */
  me: `.${PAGE_CLASSES.me}`,

  // A tab.
  title: `.${PAGE_CLASSES.title}`,
  titleText: `.${CLASS.titleText}`,
  titleButton: `.${CLASS.titleButton}`,
  scroll: `.${PAGE_CLASSES.scroll}`,
  thread,
  composer: `.${PAGE_CLASSES.composer}`,
  chatHello: `.${CLASS.chatHello}`,

  // The home screen: the box to type a question in, its send button, and
  // the questions to start with under it.
  homeInput: `.${PAGE_CLASSES.homeAsk} input`,
  homeSend: `.${PAGE_CLASSES.homeAsk} .${PAGE_CLASSES.homeSend}`,
  prompt: has(DATA.prompt),

  // A thread: each question, then its answer.
  question: `.${PAGE_CLASSES.question}`,
  threadQuestion: `${thread} > .${PAGE_CLASSES.question}`,
  answer: `.${PAGE_CLASSES.answer}`,
  sent: `.${CLASS.sent}`,
  /** "Question: ", said to screen readers before each question. */
  srOnly: `.${PAGE_CLASSES.srOnly}`,
  /** The buttons under a thread's last answer. */
  messageActions: `.${PAGE_CLASSES.messageActions}`,
  /** In "Something else": the question it answers, the email link, and
      the LinkedIn message to copy (its text, and its copy button). */
  askedQuestion: `.${PAGE_CLASSES.askedQuestion}`,
  mail: has(DATA.mail),
  draft: `.${PAGE_CLASSES.draft}`,
  draftText: `.${PAGE_CLASSES.draftText}`,
  copyDraft: has(DATA.copyDraft),
  /** A share button's words. */
  label: `.${PAGE_CLASSES.label}`,

  // Menus.
  submenu: `.${CLASS.submenu}`,

  // The details panel: its toggles (one in each top bar, and its close
  // button), its sections and their headings, and its contact links (the
  // config's panel.context).
  panelToggles: `#${PAGE_IDS.top} ${has(DATA.panelToggle)}, #${PAGE_IDS.details} ${has(DATA.panelToggle)}`,
  panelSection: ":scope > section",
  panelHeading: "h2",
  contactLinks: `section[aria-labelledby="${panelId("context")}"] .rows a`,

  // The account menu.
  clock: has(DATA.clock),
  /** Each time in the clock, and the one that's the owner's. */
  zone: has(DATA.zone),
  ownerZone: `${has(DATA.zone)}:not([${DATA.zone}="${LOCAL_ZONE}"])`,
  clockNote: `.${PAGE_CLASSES.clockNote}`,
  mailRow: `.${PAGE_CLASSES.mailRow}`,
  rowMeta: `.${PAGE_CLASSES.rowMeta}`,
  languageLink: has(DATA.langLink),
  logout: has(DATA.logout),
} as const;

/** In milliseconds. */
export const TIMING = {
  /** The least a reply takes, "thinking", before it comes. */
  thinking: 750,
  /** Between the messages of a reply. */
  betweenMessages: 140,
  /** How long /ask has to answer. */
  askTimeout: 12_000,
  /** How long a toast ("Copied") shows, and a copy button says "Copied". */
  toast: 3200,
  copied: 1600,
  /** How long a question jumped to is outlined. */
  flash: 900,
  /** How long a submenu stays after the mouse leaves it. */
  submenuLinger: 250,
  /** How long a panel section slides as it's dragged past another, and
      when it settles after. */
  slide: 180,
  settle: 200,
} as const;

/** In CSS pixels, unless it says otherwise. */
export const SIZE = {
  /** From this width the sidebar is beside the tab, not a drawer (the
      stylesheet's breakpoint). */
  wide: 800,
  /** The sidebar's narrowest and widest, the room it leaves the rest, and
      how far an arrow key moves its edge. */
  sidebarMin: 220,
  sidebarMax: 480,
  sidebarRoom: 560,
  sidebarStep: 16,
  /** How close a menu comes to the edge of the screen. */
  edge: 8,
  /** A menu's padding: a submenu moves up by this, so its first row is
      level with the row that opens it. */
  menuPadding: 6,
  /** How far left of its chevron the thread's menu starts. */
  titleMenuShift: 12,
  /** How far below the top a question lands: one jumped to, or one just
      sent, once its reply is in. */
  jumpMargin: 16,
  /** A tab's name: its longest, and the box's least width while it's
      renamed (both in characters). */
  nameMax: 60,
  nameBox: 6,
} as const;
