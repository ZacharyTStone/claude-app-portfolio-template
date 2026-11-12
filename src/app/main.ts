/* The page's one script: polish on a page that works without it, as the
   app it's laid out like. No module changes the page as it loads (they only
   find elements and read what's saved); it all starts here, in this order. */
import { PAGE_IDS } from "../shared/page-data.ts";
import { CLASS, SELECTOR } from "./constants.ts";
import { find, findAll, isComposing } from "./lib/dom.ts";
import { initAccount } from "./account.ts";
import { initCard, toggleCard, wireComposer } from "./card.ts";
import { dropEmptyChat, forgetChats, goHome, initChats, newChat, restoreChats } from "./chats.ts";
import { initFlows } from "./flow.ts";
import { foldable } from "./folding.ts";
import { greet } from "./greeting.ts";
import { focusHome, initHome } from "./home.ts";
import { closeMenu, initMenus, isMenuOpen } from "./menus.ts";
import { root, side } from "./page.ts";
import { initPanel, wirePanelToggle } from "./panel.ts";
import { addPersonalTabs } from "./personal.ts";
import { wireTitle } from "./rename.ts";
import { resetThreads } from "./send.ts";
import { initCopyDraft, wireCopy } from "./share.ts";
import { closeDrawer, drawerOpen, initSidebar, isWide, wireMenuButton } from "./sidebar.ts";
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
  for (const button of findAll(tab, SELECTOR.copyLink)) wireCopy(button, tab);
  find(tab, SELECTOR.thread).setAttribute("aria-live", "polite");
}

/** On a phone the start is a new chat with the question card open, not the
    home screen: where a visit starts, unless the address names a tab, and
    where Back to it goes (the empty chat it was is gone). Nothing has been
    touched in it yet, so focus stays on its heading. */
function startOnPhone(): void {
  if (isWide() || currentTab() || drawerOpen()) return;
  newChat(true, (tab) => toggleCard(find(tab, SELECTOR.composer), tab, false));
}

/** A link that's handled here, not followed. */
function onClick(link: HTMLElement, go: () => void): void {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    go();
  });
}

// For the CSS: what needs JavaScript can show.
root.classList.add(CLASS.js);
initToast();
addPersonalTabs();
initChats({ wireTab, addRowMenu });

greet();
initSidebar();
initMenus();
initThreadMenus();
// The card's choices are named after the sidebar's rows as the page has
// them, before a tab renamed in this browser renames its row (wireTab).
initCard();
initCopyDraft();
initAccount();
initHome();
initViewer();
initFlows();

// Every tab in the page, the personal ones included, and the home screen's
// top bar.
findAll(document, SELECTOR.tab).forEach(wireTab);
findAll(document, `#${PAGE_IDS.top} ${SELECTOR.menuButton}`).forEach(wireMenuButton);
findAll(document, SELECTOR.panelToggles).forEach(wirePanelToggle);

// The sidebar's groups, the panel, and a "…" on each row.
findAll(side, SELECTOR.group).forEach(foldable);
initPanel();
findAll(side, SELECTOR.tabRow).forEach(addRowMenu);

// The name, top left, always leads back to the start; "New tab" opens a
// new chat; "Skip to content" goes to the open tab's heading (its link
// would open no tab at all).
onClick(find(side, SELECTOR.wordmark), () => {
  goHome();
  focusHome();
});
onClick(find(side, SELECTOR.newTab), newChat);
onClick(find(document, SELECTOR.skip), () => sync(true));

// Escape closes the open menu, or else the viewer, or else the phone drawer.
addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || isComposing(event)) return;
  if (isMenuOpen()) closeMenu(true);
  else if (isViewerOpen()) closeViewer();
  else if (drawerOpen()) closeDrawer();
});

// A refresh starts over: the chats go (in every language). The tab that's
// open stays open, as do renamed tabs and the layout.
const navigation = performance.getEntriesByType("navigation")[0];
const reloaded = navigation instanceof PerformanceNavigationTiming && navigation.type === "reload";
if (reloaded) forgetChats();
restoreChats();

// The one handler for a change of address, whatever made it: the page
// follows it, and then whatever opened the tab finishes.
addEventListener("hashchange", () => {
  closeMenu(false);
  // Over the whole screen, the viewer would hide the tab just gone to (Back
  // on a phone, say); beside the conversation it stays.
  if (viewerCoversScreen()) closeViewer({ keepFocus: true });
  const toDrawer = side.matches(":target");
  if (!toDrawer) side.classList.remove(CLASS.drawerOpen);
  resetThreads();
  dropEmptyChat();
  sync(!toDrawer);
  // Back on the home screen, the cursor is in its box again.
  focusHome();
  finishOpening();
  startOnPhone();
});
// After a refresh, the address of a chat that's gone names nothing.
if (reloaded && location.hash && !currentTab()) clearHash(true);
sync(false);
startOnPhone();
focusHome();
