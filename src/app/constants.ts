/* The numbers and storage keys only the script (and the browser checks)
   count on, and the parts of the page it looks for. The page's ids, classes
   and data attributes are in src/contracts, and what the site says comes
   from the page (page.ts). */
import { DATA, LOCAL_ZONE } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PAGE_IDS, panelId } from "../contracts/page-ids.ts";

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

/** What joins a tab's name and the site's in the window title, and the
    clock's two notes. */
export const SEPARATOR = " · ";

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
  menuButton: `.${PAGE_CLASSES.menuButton}`,
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
  tabRow: `.${PAGE_CLASSES.groupRows} > li > a`,
  rowName: `.${PAGE_CLASSES.rowName}`,
  rowHint: `.${PAGE_CLASSES.rowHint}`,
  group: `.${PAGE_CLASSES.groupHeading}`,
  foldButton: `.${PAGE_CLASSES.foldButton}`,
  /** The links to the other languages' pages. */
  language: `.${PAGE_CLASSES.languageSwitch} a`,
  account: `.${PAGE_CLASSES.account}`,
  /** The account row, which opens the account menu. */
  me: `.${PAGE_CLASSES.accountRow}`,

  // A tab.
  title: `.${PAGE_CLASSES.title}`,
  titleText: `.${PAGE_CLASSES.titleText}`,
  titleButton: `.${PAGE_CLASSES.titleButton}`,
  scroll: `.${PAGE_CLASSES.scroll}`,
  thread,
  composer: `.${PAGE_CLASSES.composer}`,
  chatHello: `.${PAGE_CLASSES.chatHello}`,

  // The home screen: the box to type a question in, its send button, and
  // the questions to start with under it.
  homeInput: `.${PAGE_CLASSES.homeAsk} input`,
  homeSend: `.${PAGE_CLASSES.homeAsk} .${PAGE_CLASSES.homeSend}`,
  prompt: has(DATA.prompt),

  // A thread: each question, then its answer.
  question: `.${PAGE_CLASSES.question}`,
  threadQuestion: `${thread} > .${PAGE_CLASSES.question}`,
  answer: `.${PAGE_CLASSES.answer}`,
  sent: `.${PAGE_CLASSES.sent}`,
  /** "Question: ", said to screen readers before each question. */
  srOnly: `.${PAGE_CLASSES.srOnly}`,
  /** The buttons under a thread's last answer. */
  messageActions: `.${PAGE_CLASSES.messageActions}`,
  /** In "Something else": the question it answers, the email link, and
      the LinkedIn message to copy (its text, and its copy button). */
  askedQuestion: `.${PAGE_CLASSES.askedQuestion}`,
  mail: has(DATA.emailBody),
  draft: `.${PAGE_CLASSES.draft}`,
  draftText: `.${PAGE_CLASSES.draftText}`,
  copyDraft: has(DATA.copyDraft),
  /** A share button's words. */
  label: `.${PAGE_CLASSES.label}`,

  // Menus.
  submenu: `.${PAGE_CLASSES.submenu}`,

  // The details panel: its toggles (one in each top bar, and its close
  // button), its sections and their headings, and its contact links (the
  // config's panel.context).
  panelToggles: `#${PAGE_IDS.home} ${has(DATA.panelToggle)}, #${PAGE_IDS.panel} ${has(DATA.panelToggle)}`,
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

  // A link that opens in the viewer.
  viewLink: `a${has(DATA.viewerAddress)}`,

  // What comes in as it's scrolled to: a quote, a file card.
  comesIntoView: `.${PAGE_CLASSES.quote}, .${PAGE_CLASSES.fileCard}`,

  // A picture a visitor plays: its figure, what holds the picture, and its
  // Play button.
  playedFigure: `.${PAGE_CLASSES.playedFigure}`,
  stage: `.${PAGE_CLASSES.stage}`,
  playButton: `a${has(DATA.play)}`,
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
  /** How long after a page starts to load it's still arriving: until then
      what's on screen may come in as what's scrolled to does (seen.ts). */
  pageArrives: 700,
  /** How long a played picture takes to give way to its still once it
      stops (the stylesheet fades it for as long). */
  playFade: 300,
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
  /** From this width the viewer is beside the conversation, in the panel's
      place; below it, it covers the screen (the stylesheet's breakpoint). */
  viewerBeside: 1200,
  /** How much of a quote or a card has to be on screen before it comes in
      (a fraction of it, not pixels), or else how much of the screen it has
      to fill, for one too tall to show that much of. */
  inViewShare: 0.3,
  fillsScreenShare: 0.4,
} as const;
