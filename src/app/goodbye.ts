/* "Log out" really does: the page gives way to a goodbye with your contact
   links, and "Log back in" (or Escape) brings it back, at the start. */
import { DATA } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PAGE_IDS, panelId } from "../contracts/page-ids.ts";
import { CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { clone, findAll, make } from "./lib/dom.ts";
import { goHome } from "./navigation.ts";
import { detailsPanel } from "./page.ts";

/** The rows of the config's panel.context. */
const PANEL_CONTACT_LINKS = `section[aria-labelledby="${panelId("context")}"] ${CLASS_SELECTOR.panelRows} a`;

export function logOut(logoutRow: HTMLElement, accountMenu: HTMLElement): void {
  const logBackInButton = make(
    "button",
    { type: "button", class: PAGE_CLASSES.byeBack },
    logoutRow.getAttribute(DATA.byeBack) ?? "",
  );
  const goodbye = makeGoodbye(logoutRow, accountMenu, logBackInButton);
  // The skip link before the shell included: nothing behind the goodbye
  // can be reached while it shows.
  const everythingBehind = [...document.body.children].filter((element) => element instanceof HTMLElement);
  const setBehindInert = (isInert: boolean) => {
    for (const element of everythingBehind) element.inert = isInert;
  };

  const logBackIn = () => {
    goodbye.remove();
    setBehindInert(false);
    document.removeEventListener("keydown", logBackInOnEscape, true);
    goHome();
  };
  // Heard first (on the document, as the key comes in) and stopped there:
  // this Escape logs back in, and closes nothing else.
  const logBackInOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    logBackIn();
  };
  logBackInButton.addEventListener("click", logBackIn);
  document.addEventListener("keydown", logBackInOnEscape, true);
  setBehindInert(true);
  document.body.append(goodbye);
  logBackInButton.focus();
}

/** A dialog over the whole page, in the words the "Log out" row carries. */
function makeGoodbye(logoutRow: HTMLElement, accountMenu: HTMLElement, logBackInButton: HTMLElement): HTMLElement {
  const wording = (attribute: string) => logoutRow.getAttribute(attribute) ?? "";
  return make(
    "div",
    { class: PAGE_CLASSES.bye, role: "dialog", "aria-modal": "true", "aria-labelledby": PAGE_IDS.byeTitle },
    make("h2", { class: PAGE_CLASSES.hello, id: PAGE_IDS.byeTitle }, wording(DATA.byeTitle)),
    make("p", { class: PAGE_CLASSES.intro }, wording(DATA.byeText)),
    make("p", { class: PAGE_CLASSES.byeLinks }, ...contactLinks(accountMenu)),
    logBackInButton,
  );
}

/** The details panel's contact links, or else the account menu's email. */
function contactLinks(accountMenu: HTMLElement): HTMLElement[] {
  const panelLinks = findAll(detailsPanel, PANEL_CONTACT_LINKS);
  const links = panelLinks.length ? panelLinks : findAll(accountMenu, CLASS_SELECTOR.mailRow);
  return links.map(goodbyeLink);
}

/** A copy that's no longer a menu's row, without the note at its right
    ("Link"). An email link says the address itself, not just "Email". */
function goodbyeLink(link: HTMLElement): HTMLElement {
  const copy = clone(link);
  copy.removeAttribute("role");
  copy.removeAttribute("tabindex");
  copy.querySelector(CLASS_SELECTOR.rowMeta)?.remove();
  if (link instanceof HTMLAnchorElement && link.protocol === "mailto:") {
    copy.className = "icon i-contact";
    copy.textContent = link.pathname;
  }
  return copy;
}
