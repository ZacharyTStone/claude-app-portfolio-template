/* A thread's menus: one under the chevron beside its title, and a shorter
   one behind a "…" on its sidebar row. One of each serves every thread: it's
   filled for the thread it's opened from, and moved beside the button that
   opened it. */
import { MENU_KEYS } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { SIZE } from "./constants.ts";
import { copyText } from "./lib/clipboard.ts";
import { find, findAll, make, parentOf } from "./lib/dom.ts";
import { scrollToTop } from "./lib/motion.ts";
import { deleteChat } from "./chats.ts";
import { asMenu, menuRow, toggleMenu } from "./menu.ts";
import { questionText, side, words } from "./page.ts";
import { popupAttributes } from "./popup.ts";
import { renameTab } from "./rename.ts";
import { withSubmenu } from "./submenu.ts";
import { isChat, openTab, tabLink } from "./tabs.ts";
import { sayCopied } from "./toast.ts";

/** How long a question jumped to is outlined. */
const FLASH_MS = 900;

/** How far left of its chevron the title's menu starts. */
const TITLE_MENU_SHIFT_PX = 12;

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

export function initThreadMenus(): void {
  asMenu(titleMenu);
  asMenu(rowMenu);
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
    toggleMenu(titleMenu, chevron, () => {
      fillTitleMenu(tab);
      placeTitleMenu(chevron);
    }),
  );
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
    toggleMenu(rowMenu, moreButton, () => {
      const { rename, copyLinkGroup, deleteGroup } = sharedRows(tab);
      rowMenu.replaceChildren(rename, ...copyLinkGroup, ...deleteGroup);
      placeRowMenu(moreButton);
    }),
  );
}

/** The shared rows, with "Ask a follow-up" and "Jump to ›" (a submenu of
    the thread's questions) between them. */
function fillTitleMenu(tab: HTMLElement): void {
  const { rename, copyLinkGroup, deleteGroup } = sharedRows(tab);
  const jumpTo = menuRow(words.menuJump);
  titleMenu.replaceChildren(rename, ...copyLinkGroup, dividerLine(), followUpRow(tab), jumpTo, ...deleteGroup);
  // After the rows are in: the submenu goes into the menu, after them.
  const scroller = find(tab, CLASS_SELECTOR.scroll);
  withSubmenu(jumpTo, titleMenu, (popup) => popup.replaceChildren(...jumpRows(tab, scroller)));
}

/** Under a tab's chevron, a little to its left. It never passes the right
    edge of the top bar; and should the bar be too narrow for that, it's
    the left edge it keeps to. */
function placeTitleMenu(chevron: HTMLElement): void {
  const topBar = parentOf(chevron);
  topBar.append(titleMenu);
  // Shown, so it can be measured.
  titleMenu.hidden = false;
  const underChevron = chevron.offsetLeft - TITLE_MENU_SHIFT_PX;
  const furthestRight = topBar.clientWidth - titleMenu.offsetWidth - SIZE.edge;
  titleMenu.style.left = `${Math.max(SIZE.edge, Math.min(underChevron, furthestRight))}px`;
}

/** Below its "…" button, or above it when there's no room below in the
    sidebar. */
function placeRowMenu(moreButton: HTMLElement): void {
  parentOf(moreButton).append(rowMenu);
  rowMenu.classList.remove(PAGE_CLASSES.above);
  // Shown, so it can be measured.
  rowMenu.hidden = false;
  const lowestItCanReach = side.getBoundingClientRect().bottom - SIZE.edge;
  if (rowMenu.getBoundingClientRect().bottom > lowestItCanReach) rowMenu.classList.add(PAGE_CLASSES.above);
}

/** The rows both menus have, each group after the first with a line before
    it. */
type SharedRows = {
  rename: HTMLElement;
  /** For one of the portfolio's own threads; none for a chat, which is
      kept in this browser only: a link to it would open nothing anywhere
      else. */
  copyLinkGroup: HTMLElement[];
  /** For a chat; none for one of the portfolio's own threads, which can't
      be deleted. */
  deleteGroup: HTMLElement[];
};

function sharedRows(tab: HTMLElement): SharedRows {
  return {
    rename: renameRow(tab),
    copyLinkGroup: isChat(tab) ? [] : [dividerLine(), copyLinkRow(tab)],
    deleteGroup: isChat(tab) ? [dividerLine(), deleteRow(tab)] : [],
  };
}

/** The tab opens first, then its title turns into a box. */
function renameRow(tab: HTMLElement): HTMLElement {
  const row = menuRow(words.menuRename, { key: MENU_KEYS.rename });
  row.addEventListener("click", () => openTab(tab, () => renameTab(tab)));
  return row;
}

function copyLinkRow(tab: HTMLElement): HTMLElement {
  const row = menuRow(words.menuCopy, { key: MENU_KEYS.copyLink });
  row.addEventListener("click", async () => sayCopied(await copyText(tabLink(tab))));
  return row;
}

function deleteRow(chatTab: HTMLElement): HTMLElement {
  const row = menuRow(words.menuDelete, { class: "danger", key: MENU_KEYS.delete });
  row.addEventListener("click", () => deleteChat(chatTab));
  return row;
}

/** "Ask a follow-up" presses the tab's composer, which opens the question
    card. */
function followUpRow(tab: HTMLElement): HTMLElement {
  const row = menuRow(words.menuFollowUp);
  row.addEventListener("click", () => find(tab, CLASS_SELECTOR.composer).click());
  return row;
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

/** Scrolls a question to the top of its thread, and outlines it a moment. */
function jumpToQuestion(question: HTMLElement, scroller: HTMLElement): void {
  scrollToTop(scroller, question, SIZE.jumpMargin);
  question.classList.add(PAGE_CLASSES.flash);
  setTimeout(() => question.classList.remove(PAGE_CLASSES.flash), FLASH_MS);
}

/** The line between two groups of rows. */
function dividerLine(): HTMLElement {
  return make("hr");
}
