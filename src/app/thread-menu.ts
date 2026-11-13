/* A thread's menus: one under the chevron beside its title,
   and a shorter one behind a "…" on its sidebar row. */
import { MENU_KEYS } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { SIZE, TIMING } from "./constants.ts";
import { copyText } from "./lib/clipboard.ts";
import { find, findAll, make, parentOf } from "./lib/dom.ts";
import { scrollToTop } from "./lib/motion.ts";
import { deleteChat } from "./chats.ts";
import { asMenu, menuRow, popupAttributes, toggleMenu, withSubmenu } from "./menus.ts";
import { questionText, side, words } from "./page.ts";
import { renameTab } from "./rename.ts";
import { isChat, openTab, tabLink } from "./tabs.ts";
import { sayCopied } from "./toast.ts";

// One of each menu serves every thread: it's filled for the thread it's
// opened from, and moved beside the button that opened it.
const titleMenu = make("div", {
  class: "pop title-pop",
  role: "menu",
  id: PAGE_IDS.titleMenu,
  "aria-label": words.menuOptions,
  hidden: "",
});
const rowMenu = make("div", {
  class: "pop row-pop",
  role: "menu",
  id: PAGE_IDS.rowMenu,
  "aria-label": words.menuOptions,
  hidden: "",
});

/** The line between two groups of rows. */
const dividerLine = (): HTMLElement => make("hr");

// ---- The rows ----------------------------------------------------------------------

/** "Rename": opens the tab, then turns its title into a box. */
function renameRow(tab: HTMLElement): HTMLElement {
  const row = menuRow(words.menuRename, { key: MENU_KEYS.rename });
  row.addEventListener("click", () => openTab(tab, () => renameTab(tab)));
  return row;
}

/** "Copy link": copies the tab's address, and says whether it could. */
function copyLinkRow(tab: HTMLElement): HTMLElement {
  const row = menuRow(words.menuCopy, { key: MENU_KEYS.copyLink });
  row.addEventListener("click", async () => sayCopied(await copyText(tabLink(tab))));
  return row;
}

/** "Delete", for a chat. */
function deleteRow(chatTab: HTMLElement): HTMLElement {
  const row = menuRow(words.menuDelete, { class: "danger", key: MENU_KEYS.delete });
  row.addEventListener("click", () => deleteChat(chatTab));
  return row;
}

/** "Ask a follow-up": presses the tab's composer, which opens the question
    card. */
function followUpRow(tab: HTMLElement): HTMLElement {
  const row = menuRow(words.menuFollowUp);
  row.addEventListener("click", () => find(tab, CLASS_SELECTOR.composer).click());
  return row;
}

/** Scrolls a question to the top of its thread, and outlines it a moment. */
function jumpToQuestion(question: HTMLElement, scroller: HTMLElement): void {
  scrollToTop(scroller, question, SIZE.jumpMargin);
  question.classList.add(PAGE_CLASSES.flash);
  setTimeout(() => question.classList.remove(PAGE_CLASSES.flash), TIMING.flash);
}

/** A row for each question in the thread as it is now (a chat gains
    questions as it goes), which jumps to it: `scroller` is the part of the
    tab that scrolls. */
function jumpRows(tab: HTMLElement, scroller: HTMLElement): HTMLElement[] {
  return findAll(tab, PART_SELECTOR.threadQuestion).map((question) => {
    const row = menuRow(questionText(question));
    row.addEventListener("click", () => jumpToQuestion(question, scroller));
    return row;
  });
}

/** The rows both menus share, each group after the first with a line
    before it. */
type SharedRows = {
  rename: HTMLElement;
  /** A line and "Copy link", for one of the portfolio's own threads; none
      for a chat. */
  copyLinkGroup: HTMLElement[];
  /** A line and "Delete", for a chat; none for one of the portfolio's own
      threads. */
  deleteGroup: HTMLElement[];
};

/** Rename, then Copy link for the portfolio's own threads or Delete for a
    chat. A chat is kept in this browser only, so a link to it would open
    nothing anywhere else; and the portfolio's threads can't be deleted. */
function sharedRows(tab: HTMLElement): SharedRows {
  return {
    rename: renameRow(tab),
    copyLinkGroup: isChat(tab) ? [] : [dividerLine(), copyLinkRow(tab)],
    deleteGroup: isChat(tab) ? [dividerLine(), deleteRow(tab)] : [],
  };
}

// ---- The menu under a title's chevron ----------------------------------------------

/** Fills the title's menu for a tab: the shared rows, with "Ask a
    follow-up" and "Jump to ›" (a submenu of the thread's questions) between
    them. */
function fillTitleMenu(tab: HTMLElement): void {
  const { rename, copyLinkGroup, deleteGroup } = sharedRows(tab);
  const jumpTo = menuRow(words.menuJump);
  titleMenu.replaceChildren(rename, ...copyLinkGroup, dividerLine(), followUpRow(tab), jumpTo, ...deleteGroup);
  // After the rows are in: the submenu goes into the menu, after them.
  const scroller = find(tab, CLASS_SELECTOR.scroll);
  withSubmenu(jumpTo, titleMenu, (popup) => popup.replaceChildren(...jumpRows(tab, scroller)));
}

/** Puts the title's menu under a tab's chevron, a little to its left. It
    never passes the right edge of the top bar; and should the bar be too
    narrow for that, it's the left edge it keeps to. */
function placeTitleMenu(chevron: HTMLElement): void {
  const topBar = parentOf(chevron);
  topBar.append(titleMenu);
  // Shown, so it can be measured.
  titleMenu.hidden = false;
  const underChevron = chevron.offsetLeft - SIZE.titleMenuShift;
  const furthestRight = topBar.clientWidth - titleMenu.offsetWidth - SIZE.edge;
  titleMenu.style.left = `${Math.max(SIZE.edge, Math.min(underChevron, furthestRight))}px`;
}

/** The chevron beside a tab's title, for the thread's menu. */
export function addTitleMenu(tab: HTMLElement): void {
  const heading = find(tab, CLASS_SELECTOR.title);
  // The chevron the page draws after the title without JavaScript gives
  // way to the button.
  heading.classList.remove(PAGE_CLASSES.iconAfter);
  const chevron = make("button", {
    type: "button",
    class: `icon-button icon i-down ${PAGE_CLASSES.titleMenuButton}`,
    "aria-label": words.menuOptions,
    title: words.menuOptions,
    ...popupAttributes(PAGE_IDS.titleMenu),
  });
  heading.after(chevron);
  chevron.addEventListener("click", () =>
    toggleMenu(titleMenu, chevron, {
      prepare() {
        fillTitleMenu(tab);
        placeTitleMenu(chevron);
      },
    }),
  );
}

// ---- The menu behind a sidebar row's "…" -------------------------------------------

/** Puts the row's menu below its "…" button, or above it when there's no
    room below in the sidebar. */
function placeRowMenu(moreButton: HTMLElement): void {
  parentOf(moreButton).append(rowMenu);
  rowMenu.classList.remove(PAGE_CLASSES.above);
  // Shown, so it can be measured.
  rowMenu.hidden = false;
  const lowestItCanReach = side.getBoundingClientRect().bottom - SIZE.edge;
  if (rowMenu.getBoundingClientRect().bottom > lowestItCanReach) rowMenu.classList.add(PAGE_CLASSES.above);
}

/** A sidebar row's "…" button, shown on hover, for the shorter menu. */
export function addRowMenu(row: Element): void {
  const tabId = (row.getAttribute("href") ?? "").slice(1);
  const tab = document.getElementById(tabId);
  if (!tab) return;
  const moreButton = make("button", {
    type: "button",
    class: `icon-button icon i-more ${PAGE_CLASSES.rowMore}`,
    "aria-label": words.menuMore,
    title: words.menuMore,
    ...popupAttributes(PAGE_IDS.rowMenu),
  });
  row.after(moreButton);
  moreButton.addEventListener("click", () =>
    toggleMenu(rowMenu, moreButton, {
      prepare() {
        const { rename, copyLinkGroup, deleteGroup } = sharedRows(tab);
        rowMenu.replaceChildren(rename, ...copyLinkGroup, ...deleteGroup);
        placeRowMenu(moreButton);
      },
    }),
  );
}

/** Gives the two menus their keys. */
export function initThreadMenus(): void {
  asMenu(titleMenu);
  asMenu(rowMenu);
}
