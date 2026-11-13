/* The page's one script: polish on a page that works without it, as the
   app it's laid out like. No module changes the page as it loads (they only
   find elements and read what's saved); it all starts here, at "The start"
   below, in an order whose reasons are written beside each step. */
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { SELECTOR } from "./constants.ts";
import { find, findAll, isComposing } from "./lib/dom.ts";
import { initAccount } from "./account.ts";
import { initCard, toggleCard, wireComposer } from "./card.ts";
import { dropEmptyChat, forgetChats, goHome, initChats, newChat, restoreChats } from "./chats.ts";
import { foldable } from "./folding.ts";
import { greet } from "./greeting.ts";
import { focusHome, initHome } from "./home.ts";
import { closeMenu, initMenus, isMenuOpen } from "./menus.ts";
import { root, side } from "./page.ts";
import { initPanel, wirePanelToggle } from "./panel.ts";
import { initPlay } from "./play.ts";
import { addPersonalTabs } from "./personal.ts";
import { wireTitle } from "./rename.ts";
import { initSeen } from "./seen.ts";
import { resetThreads } from "./send.ts";
import { initCopyDraft, wireCopy } from "./share.ts";
import { closeDrawer, initSidebar, isAddressOnDrawer, isDrawerOpen, isWide, wireMenuButton } from "./sidebar.ts";
import { currentTab, clearHash, finishOpening, sync } from "./tabs.ts";
import { addRowMenu, addTitleMenu, initThreadMenus } from "./thread-menu.ts";
import { initToast } from "./toast.ts";
import { closeViewer, initViewer, isViewerOpen, viewerCoversScreen } from "./viewer.ts";

/** Everything a tab has: its top bar's buttons, title and composer. A chat
    gets it too, from chats.ts, which can't import what it needs itself. */
function wireTab(tab: HTMLElement): void {
  findAll(tab, SELECTOR.menuButton).forEach(wireMenuButton);
  wireTitle(tab);
  addTitleMenu(tab);
  for (const composer of findAll(tab, SELECTOR.composer)) wireComposer(composer, tab);
  findAll(tab, SELECTOR.panelToggle).forEach(wirePanelToggle);
  for (const copyButton of findAll(tab, SELECTOR.copyLink)) wireCopy(copyButton, tab);
  // What's sent into the thread, and its reply, are read out by screen
  // readers as they go in.
  find(tab, SELECTOR.thread).setAttribute("aria-live", "polite");
}

/** On a phone the start is a new chat with the question card open, not the
    home screen: where a visit starts, unless the address names a tab, and
    where Back to it goes (the empty chat it was is gone). Nothing has been
    touched in it yet, so focus stays on its heading. */
function startOnPhone(): void {
  if (isWide() || currentTab() || isDrawerOpen()) return;
  // The chat takes the home screen's place in the history: left there, the
  // home screen would open another chat each time Back reached it.
  const replaceInHistory = true;
  newChat(replaceInHistory, (chatTab) => toggleCard(find(chatTab, SELECTOR.composer), chatTab, { moveFocus: false }));
}

/** A link that's handled here, not followed. */
function handleLink(link: HTMLElement, action: () => void): void {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    action();
  });
}

/** Whether the page was loaded by a refresh. */
function wasPageRefreshed(): boolean {
  const [navigation] = performance.getEntriesByType("navigation");
  return navigation instanceof PerformanceNavigationTiming && navigation.type === "reload";
}

/** Escape closes the open menu, or else the viewer, or else the phone
    drawer: one at a time, the topmost first. */
function closeTopmostOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || isComposing(event)) return;
  if (isMenuOpen()) closeMenu({ refocus: true });
  else if (isViewerOpen()) closeViewer();
  else if (isDrawerOpen()) closeDrawer();
}

/** The one handler for a change of address, whatever made it: the page
    follows it, and then whatever opened the tab finishes. */
function followAddress(): void {
  closeMenu();
  // Over the whole screen, the viewer would hide the tab just gone to (Back
  // on a phone, say); beside the conversation it stays.
  if (viewerCoversScreen()) closeViewer({ keepFocus: true });
  // The address can be the drawer's own (#tabs): then the drawer is what
  // opened, and focus isn't taken from it. Any other address closes it.
  const openedDrawer = isAddressOnDrawer();
  if (!openedDrawer) side.classList.remove(PAGE_CLASSES.drawerOpen);
  resetThreads();
  dropEmptyChat();
  sync(!openedDrawer);
  // Back on the home screen, the cursor is in its box again.
  focusHome();
  finishOpening();
  startOnPhone();
}

// ---- The start ---------------------------------------------------------------------
// Everything from here runs once, top to bottom. Where a step has to come
// before or after another, its comment says so, and why. A step with no
// such comment isn't known to depend on its place.

// For the CSS: what needs JavaScript can show.
root.classList.add(PAGE_CLASSES.js);
initToast();

// Before anything looks for the page's tabs (the card, and the wiring
// below): from here on a personal answer's tab is a tab like any other.
addPersonalTabs();
// Before the first chat is made (restoreChats below, or "New tab"): a chat
// wires its own tab and row with these, as it's made.
initChats({ wireTab, addRowMenu });

greet();
initSidebar();
initMenus();
initThreadMenus();
// After the personal tabs are made, and before a tab renamed in this
// browser renames its row (wireTab, below): the card's choices are named
// after the sidebar's rows as the page has them.
initCard();
initCopyDraft();
initAccount();
initHome();
initViewer();
// After the personal tabs are made, so their quotes and cards wait as the
// page's own do; before the chats come back (restoreChats below), whose
// copies of answers are shown whole.
initSeen();
// After the personal tabs are made, as above: a picture in one plays as the
// page's own do.
initPlay();

// Every tab in the page, the personal ones included, and the home screen's
// top bar.
findAll(document, SELECTOR.tab).forEach(wireTab);
findAll(document, `#${PAGE_IDS.home} ${SELECTOR.menuButton}`).forEach(wireMenuButton);
findAll(document, SELECTOR.panelToggles).forEach(wirePanelToggle);

// The sidebar's groups, the panel, and a "…" on each row.
findAll(side, SELECTOR.group).forEach(foldable);
initPanel();
findAll(side, SELECTOR.tabRow).forEach(addRowMenu);

// The name, top left, always leads back to the start; "New tab" opens a
// new chat; "Skip to content" goes to the open tab's heading (its link
// would open no tab at all).
handleLink(find(side, SELECTOR.wordmark), () => {
  goHome();
  focusHome();
});
handleLink(find(side, SELECTOR.newTab), newChat);
handleLink(find(document, SELECTOR.skip), () => sync(true));

addEventListener("keydown", closeTopmostOnEscape);

// A refresh starts over: the chats go (in every language). The tab that's
// open stays open, as do renamed tabs and the layout.
const wasRefreshed = wasPageRefreshed();
if (wasRefreshed) forgetChats();
// After everything in the page is wired, above: a chat's tab, its row and
// the "Chats" group are wired as they're made (initChats), and would be
// wired a second time if the lines above found them in the page.
restoreChats();

addEventListener("hashchange", followAddress);

// Last, once every tab there will be is in the page and wired: the page is
// brought into step with the address it was opened at.
// After a refresh, the address of a chat that's gone names nothing.
if (wasRefreshed && location.hash && !currentTab()) clearHash(true);
sync(false);
startOnPhone();
focusHome();
