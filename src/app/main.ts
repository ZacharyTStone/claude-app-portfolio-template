/* The page's one script: polish on a page that works without it, as the app
   it's laid out like. Nothing changes the page until start(). */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { find, findAll, isComposing } from "./lib/dom.ts";
import { initAccountMenu } from "./account-menu.ts";
import { initCard, toggleCard, wireComposer } from "./card.ts";
import { dropEmptyChat, forgetChats, goHome, initChats, newChat, restoreChats } from "./chats.ts";
import { foldable } from "./folding.ts";
import { greet } from "./greeting.ts";
import { focusHome, initHome } from "./home.ts";
import { root, sidebar } from "./page.ts";
import { initPanel, tellPanelToggles } from "./panel.ts";
import { addPersonalTabs } from "./personal.ts";
import { initPlay } from "./play.ts";
import { closePopup, closePopupAndReturnFocus, initPopup, isPopupOpen } from "./popup.ts";
import { wireTitle } from "./rename.ts";
import { initSeen } from "./seen.ts";
import { resetThreads } from "./send.ts";
import { initShare } from "./share.ts";
import {
  closeDrawer,
  closeDrawerAndReturnFocus,
  initSidebar,
  isAddressOnDrawer,
  isDrawerOpen,
  isWide,
} from "./sidebar.ts";
import { clearHash, currentTab, finishOpening, sync } from "./tabs.ts";
import { addRowMenu, addTitleMenu, initThreadMenus } from "./thread-menu.ts";
import { initToast } from "./toast.ts";
import { closeViewer, closeViewerAndReturnFocus, initViewer, isViewerOpen, viewerCoversScreen } from "./viewer.ts";

/** What the page has of its own before a visitor's chats come back. A
    chat's tab and row are wired as they're made (initChats), so only these
    are wired here. */
type OwnParts = { tabs: HTMLElement[]; tabRows: HTMLElement[]; groupHeadings: HTMLElement[] };

start();

function start(): void {
  // For the stylesheet: what needs JavaScript can show.
  root.classList.add(PAGE_CLASSES.js);
  const ownParts = completeThePage();
  // Before a tab is wired: the question card names its choices after the
  // sidebar's rows as the page has them, and wiring a tab that was renamed
  // in this browser renames its row.
  startFeatures();
  wire(ownParts);
  restoreChatsUnlessRefreshed();
  followTheAddress();
}

/** From here on a personal answer's tab is a tab like any other. */
function completeThePage(): OwnParts {
  addPersonalTabs();
  return {
    tabs: findAll(document, CLASS_SELECTOR.tab),
    tabRows: findAll(sidebar, PART_SELECTOR.tabRow),
    groupHeadings: findAll(sidebar, CLASS_SELECTOR.groupHeading),
  };
}

function startFeatures(): void {
  initToast();
  initChats({ wireTab, addRowMenu });
  greet();
  initSidebar();
  initPopup();
  initThreadMenus();
  initCard();
  initShare();
  initAccountMenu();
  initHome();
  initViewer();
  initSeen();
  initPlay();
  initPanel();
  handleLinksHere();
  addEventListener("keydown", closeTopmostOnEscape);
}

function wire({ tabs, tabRows, groupHeadings }: OwnParts): void {
  tabs.forEach(wireTab);
  groupHeadings.forEach(foldable);
  tabRows.forEach(addRowMenu);
}

/** What the script adds to a tab. A chat's tab gets it too, from chats.ts,
    which can't import these itself. */
function wireTab(tab: HTMLElement): void {
  wireTitle(tab);
  addTitleMenu(tab);
  for (const composer of findAll(tab, CLASS_SELECTOR.composer)) wireComposer(composer, tab);
  tellPanelToggles(tab);
  // What's sent into the thread, and its reply, are read out by screen
  // readers as they go in.
  find(tab, CLASS_SELECTOR.thread).setAttribute("aria-live", "polite");
}

/** The name, top left, always leads back to the start; "New tab" opens a
    new chat; "Skip to content" goes to the open tab's heading (its link
    would open no tab at all). */
function handleLinksHere(): void {
  handleHere(find(sidebar, CLASS_SELECTOR.wordmark), () => {
    goHome();
    focusHome();
  });
  handleHere(find(sidebar, CLASS_SELECTOR.newTab), newChat);
  handleHere(find(document, CLASS_SELECTOR.skip), () => sync(true));
}

/** A link that's handled here, not followed. */
function handleHere(link: HTMLElement, action: () => void): void {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    action();
  });
}

/** One at a time, the topmost first. */
function closeTopmostOnEscape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || isComposing(event)) return;
  if (isPopupOpen()) closePopupAndReturnFocus();
  else if (isViewerOpen()) closeViewerAndReturnFocus();
  else if (isDrawerOpen()) closeDrawerAndReturnFocus();
}

/** A refresh starts over: the chats go (in every language), and with them
    the address of one that was open. The tab that's open stays open, as do
    renamed tabs and the layout. */
function restoreChatsUnlessRefreshed(): void {
  if (!wasPageRefreshed()) return restoreChats();
  forgetChats();
  const namesNoTab = location.hash && !currentTab();
  if (namesNoTab) clearHash(true);
}

function wasPageRefreshed(): boolean {
  const [navigation] = performance.getEntriesByType("navigation");
  return navigation instanceof PerformanceNavigationTiming && navigation.type === "reload";
}

/** From now on, and first for the address the page was opened at. */
function followTheAddress(): void {
  addEventListener("hashchange", onAddressChange);
  sync(false);
  startOnPhone();
  focusHome();
}

/** The one handler for a change of address, whatever made it: the page
    follows it, and then whatever opened the tab finishes. */
function onAddressChange(): void {
  closePopup();
  // Over the whole screen, the viewer would hide the tab just gone to (Back
  // on a phone, say); beside the conversation it stays.
  if (viewerCoversScreen()) closeViewer();
  // The address can be the drawer's own (#tabs): then the drawer is what
  // opened, and focus isn't taken from it. Any other address closes it.
  const openedDrawer = isAddressOnDrawer();
  if (!openedDrawer) closeDrawer();
  resetThreads();
  dropEmptyChat();
  sync(!openedDrawer);
  // Back on the home screen, the cursor is in its box again.
  focusHome();
  finishOpening();
  startOnPhone();
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
  newChat(replaceInHistory, (chatTab) =>
    toggleCard(find(chatTab, CLASS_SELECTOR.composer), chatTab, { moveFocus: false }),
  );
}
