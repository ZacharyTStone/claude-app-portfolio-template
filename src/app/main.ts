/* The page's one script: polish on a page that works without it, as the app
   it's laid out like. Nothing changes the page until start(). */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { clone, find, findAll, isComposing } from "./lib/dom.ts";
import { initAccountMenu } from "./account-menu.ts";
import { initCard, wireComposer } from "./question-card/card.ts";
import { dropEmptyChat, forgetChats, initChats, restoreChats } from "./conversation/chats.ts";
import { foldable } from "./folding.ts";
import { focusHome, greet, initHome } from "./home.ts";
import { finishOpening, goHome, openNewChat, startOnPhone } from "./navigation.ts";
import { askedTab, root, sidebar } from "./page.ts";
import { initPanel, tellPanelToggles } from "./panel.ts";
import { addPersonalTabs } from "./personal-tabs.ts";
import { initPlay } from "./play.ts";
import { closePopup, closePopupAndReturnFocus, initPopup, isPopupOpen } from "./popup.ts";
import { wireTitle } from "./rename.ts";
import { initRevealOnScroll } from "./reveal-on-scroll.ts";
import { resetThreads } from "./conversation/send.ts";
import { initShare } from "./share.ts";
import { closeDrawer, closeDrawerAndReturnFocus, initSidebar, isAddressOnDrawer, isDrawerOpen } from "./sidebar.ts";
import { clearHashReplacingHistory, currentTab, focusOpenTab, showOpenTab } from "./tabs.ts";
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
  // Before anything changes it: each personal answer's tab, and each
  // chat's, is a copy of "Something else" as the page was built.
  const tabPattern = clone(askedTab);
  const ownParts = completeThePage(tabPattern);
  // Before a tab is wired: the question card names its choices after the
  // sidebar's rows as the page has them, and wiring a tab that was renamed
  // in this browser renames its row.
  startFeatures(tabPattern);
  wire(ownParts);
  restoreChatsUnlessRefreshed();
  followTheAddress();
}

/** From here on a personal answer's tab is a tab like any other. */
function completeThePage(tabPattern: HTMLElement): OwnParts {
  addPersonalTabs(tabPattern);
  return {
    tabs: findAll(document, CLASS_SELECTOR.tab),
    tabRows: findAll(sidebar, PART_SELECTOR.tabRow),
    groupHeadings: findAll(sidebar, CLASS_SELECTOR.groupHeading),
  };
}

function startFeatures(tabPattern: HTMLElement): void {
  initToast();
  initChats({ tabPattern, wireTab, addRowMenu, goHome });
  greet();
  initSidebar();
  initPopup();
  initThreadMenus();
  initCard();
  initShare();
  initAccountMenu();
  initHome();
  initViewer();
  initRevealOnScroll();
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
  handleHere(find(sidebar, CLASS_SELECTOR.newTab), openNewChat);
  handleHere(find(document, CLASS_SELECTOR.skip), () => {
    showOpenTab();
    focusOpenTab();
  });
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
  if (namesNoTab) clearHashReplacingHistory();
}

function wasPageRefreshed(): boolean {
  const [navigation] = performance.getEntriesByType("navigation");
  return navigation instanceof PerformanceNavigationTiming && navigation.type === "reload";
}

/** From now on, and first for the address the page was opened at. */
function followTheAddress(): void {
  addEventListener("hashchange", onAddressChange);
  showOpenTab();
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
  showOpenTab();
  if (!openedDrawer) focusOpenTab();
  // Back on the home screen, the cursor is in its box again.
  focusHome();
  finishOpening();
  startOnPhone();
}
