/* A thread's menus: one under the chevron beside its title,
   and a shorter one behind a "…" on its sidebar row. */
import { MENU_KEYS, PAGE_CLASSES, PAGE_IDS } from "../shared/page-data.ts";
import { CLASS, SELECTOR, SIZE, TIMING } from "./constants.ts";
import { copyText } from "./lib/clipboard.ts";
import { find, findAll, make, parentOf } from "./lib/dom.ts";
import { scrollToTop } from "./lib/motion.ts";
import { deleteChat } from "./chats.ts";
import { asMenu, menuRow, popupAttributes, toggleMenu, withSubmenu } from "./menus.ts";
import { questionText, side, words } from "./page.ts";
import { renameTab } from "./rename.ts";
import { isChat, openTab } from "./tabs.ts";
import { sayCopied } from "./toast.ts";

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

// Scrolls a question to the top of its thread, and outlines it a moment.
function jumpTo(q: HTMLElement, scroll: HTMLElement): void {
  scrollToTop(scroll, q, SIZE.jumpMargin);
  q.classList.add(CLASS.flash);
  setTimeout(() => q.classList.remove(CLASS.flash), TIMING.flash);
}

const linkTo = (tab: HTMLElement) => `${location.origin}${location.pathname}#${tab.id}`;

// The rows both menus share: Rename, then Copy link for the portfolio's own
// threads or Delete for a chat. A chat is kept in this browser only, so a
// link to it would open nothing anywhere else; and the portfolio's threads
// can't be deleted. Lines go between the groups.
function threadRows(tab: HTMLElement) {
  const rename = menuRow(words.menuRename, { key: MENU_KEYS.rename });
  rename.addEventListener("click", () => openTab(tab, () => renameTab(tab)));
  const copy: HTMLElement[] = [];
  const remove: HTMLElement[] = [];
  if (isChat(tab)) {
    const row = menuRow(words.menuDelete, { class: "danger", key: MENU_KEYS.delete });
    row.addEventListener("click", () => deleteChat(tab));
    remove.push(make("hr"), row);
  } else {
    const row = menuRow(words.menuCopy, { key: MENU_KEYS.copyLink });
    row.addEventListener("click", async () => sayCopied(await copyText(linkTo(tab))));
    copy.push(make("hr"), row);
  }
  return { rename, copy, remove };
}

// Under the title: those, plus Ask a follow-up and Jump to ›.
function buildTitleMenu(tab: HTMLElement, chevron: HTMLElement): void {
  const rows = threadRows(tab);
  const followUp = menuRow(words.menuFollowUp);
  followUp.addEventListener("click", () => find(tab, SELECTOR.composer).click());
  const jump = menuRow(words.menuJump);
  titleMenu.replaceChildren(rows.rename, ...rows.copy, make("hr"), followUp, jump, ...rows.remove);
  const scroll = find(tab, SELECTOR.scroll);
  withSubmenu(jump, titleMenu, (sub) =>
    sub.replaceChildren(
      ...findAll(tab, SELECTOR.threadQuestion).map((q) => {
        const item = menuRow(questionText(q));
        item.addEventListener("click", () => jumpTo(q, scroll));
        return item;
      }),
    ),
  );
  // Under the chevron, but never past the edge of the screen.
  const topbar = parentOf(chevron);
  topbar.append(titleMenu);
  titleMenu.hidden = false;
  const room = topbar.clientWidth - titleMenu.offsetWidth - SIZE.edge;
  titleMenu.style.left = `${Math.max(SIZE.edge, Math.min(chevron.offsetLeft - SIZE.titleMenuShift, room))}px`;
}

/** The chevron beside a tab's title, for the thread's menu. */
export function addTitleMenu(tab: HTMLElement): void {
  const heading = find(tab, SELECTOR.title);
  heading.classList.remove(PAGE_CLASSES.iconAfter);
  const chevron = make("button", {
    type: "button",
    class: `icon-btn ic i-down ${CLASS.titleMenuButton}`,
    "aria-label": words.menuOptions,
    title: words.menuOptions,
    ...popupAttributes(PAGE_IDS.titleMenu),
  });
  heading.after(chevron);
  chevron.addEventListener("click", () =>
    toggleMenu(titleMenu, chevron, { build: () => buildTitleMenu(tab, chevron) }),
  );
}

/** A sidebar row's "…" button, shown on hover, for the shorter menu. */
export function addRowMenu(link: Element): void {
  const tab = document.getElementById((link.getAttribute("href") ?? "").slice(1));
  if (!tab) return;
  const more = make("button", {
    type: "button",
    class: `icon-btn ic i-more ${CLASS.rowMore}`,
    "aria-label": words.menuMore,
    title: words.menuMore,
    ...popupAttributes(PAGE_IDS.rowMenu),
  });
  link.after(more);
  more.addEventListener("click", () =>
    toggleMenu(rowMenu, more, {
      build() {
        const rows = threadRows(tab);
        rowMenu.replaceChildren(rows.rename, ...rows.copy, ...rows.remove);
        // Below the row, or above it when there's no room below.
        parentOf(more).append(rowMenu);
        rowMenu.classList.remove(CLASS.above);
        rowMenu.hidden = false;
        if (rowMenu.getBoundingClientRect().bottom > side.getBoundingClientRect().bottom - SIZE.edge) {
          rowMenu.classList.add(CLASS.above);
        }
      },
    }),
  );
}

export function initThreadMenus(): void {
  asMenu(titleMenu);
  asMenu(rowMenu);
}
