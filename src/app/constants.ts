/* The numbers and storage keys only the script (and the browser checks)
   count on, and the parts of the page it looks for. The page's ids, classes
   and data attributes are in src/contracts, and what the site says comes
   from the page (page.ts). */
import { DATA, LOCAL_ZONE } from "../contracts/page-attributes.ts";
import { panelId } from "../contracts/page-ids.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR, ID_SELECTOR } from "../contracts/page-selectors.ts";

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

/** The parts of the page that take more than one name to find. One that a
    single name finds is that name's selector (src/contracts/page-selectors.ts). */
export const SELECTOR = {
  // The sidebar: "New tab", the rows beside it, and a row in one of its
  // groups of tabs.
  newTab: `${CLASS_SELECTOR.nav} ${CLASS_SELECTOR.newTab}`,
  navRow: `${CLASS_SELECTOR.nav} a`,
  tabRow: `${CLASS_SELECTOR.groupRows} > li > a`,
  /** The links to the other languages' pages. */
  language: `${CLASS_SELECTOR.languageSwitch} a`,

  // The home screen: the box to type a question in, and its send button.
  homeInput: `${CLASS_SELECTOR.homeAsk} input`,
  homeSend: `${CLASS_SELECTOR.homeAsk} ${CLASS_SELECTOR.homeSend}`,

  /** A thread's own questions, not those inside an answer. */
  threadQuestion: `${CLASS_SELECTOR.thread} > ${CLASS_SELECTOR.question}`,

  // The details panel: its toggles (one in each top bar, and its close
  // button), its sections and their headings, and its contact links (the
  // config's panel.context).
  panelToggles: `${ID_SELECTOR.home} ${ATTRIBUTE_SELECTOR.panelToggle}, ${ID_SELECTOR.panel} ${ATTRIBUTE_SELECTOR.panelToggle}`,
  panelSection: ":scope > section",
  panelHeading: "h2",
  contactLinks: `section[aria-labelledby="${panelId("context")}"] .rows a`,

  /** In the account menu's clock, the time that's the owner's. */
  ownerZone: `${ATTRIBUTE_SELECTOR.zone}:not([${DATA.zone}="${LOCAL_ZONE}"])`,

  // A link that opens in the viewer.
  viewLink: `a${ATTRIBUTE_SELECTOR.viewerAddress}`,

  // What comes in as it's scrolled to: a quote, a file card.
  comesIntoView: `${CLASS_SELECTOR.quote}, ${CLASS_SELECTOR.fileCard}`,

  /** A played picture's Play button. */
  playButton: `a${ATTRIBUTE_SELECTOR.play}`,
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
