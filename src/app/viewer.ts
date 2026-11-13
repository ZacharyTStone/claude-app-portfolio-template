/* The viewer shows a link's page in a frame beside the conversation (over
   the whole screen where there's no room), as the app shows an artifact:
   the links the page marks for it (DATA.viewerAddress). The frame is made
   when it opens and thrown away when it closes, so nothing loads from
   another site until the visitor asks for it, and nothing keeps running
   there once they're done. */
import { DATA } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PART_SELECTOR } from "../contracts/page-selectors.ts";
import { SIZE } from "./constants.ts";
import { isPlainClick, make, onClick } from "./lib/dom.ts";
import { shell, words } from "./page.ts";

/** What a framed page may do: run its own scripts as the site it's from,
    send its own forms and open its links in new tabs. Navigating this page
    isn't on the list, so a framed page can't take the visitor anywhere. */
const FRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

type Viewer = {
  panel: HTMLElement;
  title: HTMLElement;
  /** The link itself, as it was. */
  openInNewTab: HTMLAnchorElement;
  framePlace: HTMLElement;
};

/** Made the first time a link opens in it. */
let viewer: Viewer | null = null;
let openedFrom: HTMLElement | null = null;

const besideTheConversation = matchMedia(`(min-width: ${SIZE.viewerBeside}px)`);

export const isViewerOpen = (): boolean => shell.classList.contains(PAGE_CLASSES.viewing);

/** As it does where there's no room for it beside the conversation. */
export const viewerCoversScreen = (): boolean => isViewerOpen() && !besideTheConversation.matches;

/** Makes the viewer, hidden, in the shell: a bar with the name of what it
    shows and its two buttons, over the place its frame goes. */
function makeViewer(): Viewer {
  const title = make("h2", { class: PAGE_CLASSES.viewerTitle, tabindex: "-1" });
  const openInNewTab = make("a", {
    class: `icon-button icon i-out ${PAGE_CLASSES.viewerOpen}`,
    target: "_blank",
    rel: "noopener noreferrer",
    "aria-label": words.viewerOpen,
    title: words.viewerOpen,
  });
  const closeButton = make("button", {
    type: "button",
    class: `icon-button icon i-close ${PAGE_CLASSES.viewerClose}`,
    "aria-label": words.viewerClose,
    title: words.viewerClose,
  });
  closeButton.addEventListener("click", closeViewerAndReturnFocus);
  const bar = make("header", { class: PAGE_CLASSES.viewerBar }, title, openInNewTab, closeButton);
  const framePlace = make("div", { class: PAGE_CLASSES.viewerFrame });
  const panel = make("aside", { class: PAGE_CLASSES.viewer, hidden: "" }, bar, framePlace);
  shell.append(panel);
  return { panel, title, openInNewTab, framePlace };
}

/** A frame showing `address`, named `name` for screen readers. The other
    site isn't told which page the visitor came from. */
function makeFrame(address: string, name: string, place: HTMLElement): HTMLIFrameElement {
  const frame = make("iframe", {
    src: address,
    title: name,
    sandbox: FRAME_SANDBOX,
    referrerpolicy: "no-referrer",
  });
  place.classList.add(PAGE_CLASSES.viewerLoading);
  frame.addEventListener("load", () => place.classList.remove(PAGE_CLASSES.viewerLoading), { once: true });
  return frame;
}

/** Shows a link's page in the viewer: the address and the name the link
    carries for it (DATA.viewerAddress, DATA.viewerTitle). */
function openInViewer(link: HTMLAnchorElement): void {
  const address = link.getAttribute(DATA.viewerAddress);
  if (!address) return;
  const name = link.getAttribute(DATA.viewerTitle) ?? "";
  viewer ??= makeViewer();
  const { panel, title, openInNewTab, framePlace } = viewer;
  title.textContent = name;
  panel.setAttribute("aria-label", name);
  openInNewTab.href = link.href;
  framePlace.replaceChildren(makeFrame(address, name, framePlace));
  panel.hidden = false;
  shell.classList.add(PAGE_CLASSES.viewing);
  openedFrom = link;
  title.focus();
}

/** Closes the viewer and throws its frame away. The focus stays where it
    is: on the tab the visitor just went to, say. */
export function closeViewer(): void {
  if (!viewer || !isViewerOpen()) return;
  viewer.framePlace.replaceChildren();
  viewer.panel.hidden = true;
  shell.classList.remove(PAGE_CLASSES.viewing);
  openedFrom = null;
}

/** For a viewer closed from inside it (its Close button, Escape): the
    focus goes back to the link that opened it. */
export function closeViewerAndReturnFocus(): void {
  const link = openedFrom;
  closeViewer();
  if (link?.isConnected) link.focus();
}

/** From now on, a plain click on a link the page marks for the viewer opens
    it there. A page with no such link (a site without a `viewer`) gets no
    viewer at all. */
export function initViewer(): void {
  if (!document.querySelector(PART_SELECTOR.viewerLink)) return;
  onClick(PART_SELECTOR.viewerLink, (link, event) => {
    if (!(link instanceof HTMLAnchorElement) || !isPlainClick(event)) return;
    event.preventDefault();
    openInViewer(link);
  });
}
