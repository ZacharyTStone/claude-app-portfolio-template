/* The numbers and storage keys only the script (and the browser checks)
   count on. The page's ids, classes and data attributes are in
   src/contracts, and what the site says comes from the page (page.ts). */

export const STORAGE = {
  /** localStorage: the chats, per language (this, then the page's lang). */
  chats: "portfolio:chats:",
  /** localStorage: the ids of the folded headings. */
  folded: "portfolio:folded",
  /** localStorage: the sidebar's width, once it's been resized. */
  sidebarWidth: "portfolio:sidebar",
  /** sessionStorage: what /ask said that stops asking for the visit. */
  askLock: "portfolio:ask-locked",
} as const;

/** What joins a tab's name and the site's in the window title, and the
    clock's two notes. */
export const SEPARATOR = " · ";

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
  /** How long after a panel section starts to slide into place the drag's
      hold on it is let go: the slide is over by then. */
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
  /** From this width the viewer is beside the conversation, in the panel's
      place; below it, it covers the screen (the stylesheet's breakpoint). */
  viewerBeside: 1200,
  /** How much of a quote or a card has to be on screen before it comes in
      (a fraction of it, not pixels), or else how much of the screen it has
      to fill, for one too tall to show that much of. */
  inViewShare: 0.3,
  fillsScreenShare: 0.4,
} as const;
