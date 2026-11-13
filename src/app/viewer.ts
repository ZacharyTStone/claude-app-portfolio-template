/* The viewer: a panel beside the conversation (the whole screen where
   there's no room beside it) that shows a link's page in a frame, as the app
   shows an artifact. The links that open in it are the ones the page marks
   (DATA.viewerAddress, from the config's `viewer`); every other link, and every link
   without JavaScript, opens as links do.

   The frame is made when the viewer opens and thrown away when it closes,
   so nothing loads from another site until the visitor asks for it, and
   nothing keeps running there once they're done. */
import { DATA } from "../contracts/page-attributes.ts";
import { CLASS, SELECTOR, SIZE } from "./constants.ts";
import { closestFrom, isPlainClick, make } from "./lib/dom.ts";
import { shell, words } from "./page.ts";

/** What a framed page may do: run its own scripts as the site it's from,
    send its own forms and open its links in new tabs. Navigating this page
    isn't on the list, so a framed page can't take the visitor anywhere. */
const FRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox";

/** The viewer's parts, once it's been made. */
type Viewer = {
  panel: HTMLElement;
  /** The name of what it's showing. */
  title: HTMLElement;
  /** "Open in a new tab": the link itself, as it was. */
  openInNewTab: HTMLAnchorElement;
  /** Where the frame goes. */
  framePlace: HTMLElement;
};

/** Made the first time a link opens in it. */
let viewer: Viewer | null = null;
/** The link that opened it, which gets the focus back when it closes. */
let openedFrom: HTMLElement | null = null;

/** A window wide enough for the viewer to be beside the conversation. */
const besideTheConversation = matchMedia(`(min-width: ${SIZE.viewerBeside}px)`);

/** Whether the viewer is showing a page. */
export const isViewerOpen = (): boolean => shell.classList.contains(CLASS.viewing);

/** Whether the viewer covers the whole screen, as it does where there's no
    room for it beside the conversation. */
export const viewerCoversScreen = (): boolean => isViewerOpen() && !besideTheConversation.matches;

/** Makes the viewer, hidden, in the shell: a bar with the name of what it
    shows and its two buttons, over the place its frame goes. */
function makeViewer(): Viewer {
  const title = make("h2", { class: CLASS.viewerTitle, tabindex: "-1" });
  const openInNewTab = make("a", {
    class: `icon-btn ic i-out ${CLASS.viewerOpen}`,
    target: "_blank",
    rel: "noopener noreferrer",
    "aria-label": words.viewerOpen,
    title: words.viewerOpen,
  });
  const closeButton = make("button", {
    type: "button",
    class: `icon-btn ic i-close ${CLASS.viewerClose}`,
    "aria-label": words.viewerClose,
    title: words.viewerClose,
  });
  closeButton.addEventListener("click", () => closeViewer());
  const bar = make("header", { class: CLASS.viewerBar }, title, openInNewTab, closeButton);
  const framePlace = make("div", { class: CLASS.viewerFrame });
  const panel = make("aside", { class: CLASS.viewer, hidden: "" }, bar, framePlace);
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
  place.classList.add(CLASS.viewerLoading);
  frame.addEventListener("load", () => place.classList.remove(CLASS.viewerLoading), { once: true });
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
  shell.classList.add(CLASS.viewing);
  openedFrom = link;
  title.focus();
}

/** Closes the viewer and throws its frame away. The focus goes back to the
    link that opened it, unless `keepFocus` says it's already somewhere
    better (the tab the visitor just went to). */
export function closeViewer({ keepFocus = false }: { keepFocus?: boolean } = {}): void {
  if (!viewer || !isViewerOpen()) return;
  viewer.framePlace.replaceChildren();
  viewer.panel.hidden = true;
  shell.classList.remove(CLASS.viewing);
  if (!keepFocus && openedFrom?.isConnected) openedFrom.focus();
  openedFrom = null;
}

/** From now on, a plain click on a link the page marks for the viewer opens
    it there. A page with no such link (a site without a `viewer`) gets no
    viewer at all. */
export function initViewer(): void {
  if (!document.querySelector(SELECTOR.viewLink)) return;
  // On the document, so the copies of an answer that chats make work too.
  document.addEventListener("click", (event) => {
    const link = closestFrom(event.target, SELECTOR.viewLink);
    if (!(link instanceof HTMLAnchorElement) || !isPlainClick(event)) return;
    event.preventDefault();
    openInViewer(link);
  });
}
