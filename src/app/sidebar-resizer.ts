/* The sidebar's edge resizes it: dragged (a blue line shows on hover),
   moved with the arrow keys, or double-clicked to go back to the
   stylesheet's width. The width is remembered per browser. */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { PAGE_IDS } from "../contracts/page-ids.ts";
import { make } from "./lib/dom.ts";
import { followPointer } from "./lib/drag.ts";
import { local } from "./lib/storage.ts";
import { shell, side, words } from "./page.ts";
import { edgeStepFor, rememberedWidth, SIDEBAR_WIDTH, widestIn, widthWithin } from "./sidebar-width.ts";

/** In localStorage. */
const WIDTH_KEY = "portfolio:sidebar";

/** The stylesheet's sidebar width: a custom property, set on the shell. */
const WIDTH_PROPERTY = "--sidebar-w";

/** To screen readers the edge is a separator whose value is the sidebar's
    width. */
const resizer = make("div", {
  class: PAGE_CLASSES.resizer,
  role: "separator",
  tabindex: "0",
  "aria-orientation": "vertical",
  "aria-controls": PAGE_IDS.sidebar,
  "aria-label": words.resize,
  "aria-valuemin": String(SIDEBAR_WIDTH.narrowest),
});

/** Puts the edge beside the sidebar, at the width this browser remembers. */
export function addSidebarResizer(): void {
  side.after(resizer);
  restoreWidth();
  // The window leaves the sidebar another width as it changes.
  addEventListener("resize", restoreWidth);

  resizer.addEventListener("pointerdown", (event) => {
    const isMainButton = event.button === 0;
    if (!isMainButton) return;
    event.preventDefault();
    dragResizer(event);
  });
  resizer.addEventListener("dblclick", () => setAndRememberWidth(null));
  resizer.addEventListener("keydown", (event) => {
    const step = edgeStepFor(event.key);
    if (!step) return;
    event.preventDefault();
    setAndRememberWidth(widthShowing() + step);
  });
}

/** The edge follows the pointer. A click that doesn't move leaves the width
    as it was, and unsaved. */
function dragResizer(down: PointerEvent): void {
  const sidebarLeft = side.getBoundingClientRect().left;
  let hasMoved = false;
  const moveEdgeToPointer = (move: PointerEvent) => {
    hasMoved = true;
    setWidth(move.clientX - sidebarLeft);
  };
  const letGo = () => {
    shell.classList.remove(PAGE_CLASSES.resizing);
    if (hasMoved) setAndRememberWidth(widthShowing());
  };
  shell.classList.add(PAGE_CLASSES.resizing);
  followPointer(resizer, down, moveEdgeToPointer, letGo);
}

function restoreWidth(): void {
  setWidth(rememberedWidth(local.get(WIDTH_KEY)));
}

/** Null is the stylesheet's own width, saved as "". */
function setAndRememberWidth(px: number | null): void {
  const widthNow = setWidth(px);
  local.set(WIDTH_KEY, px === null ? "" : String(widthNow));
}

/** Sets the sidebar's width, kept within what the window allows; null goes
    back to the stylesheet's own. Tells screen readers where the edge now
    is, and returns the width in whole pixels. */
function setWidth(px: number | null): number {
  if (px === null) shell.style.removeProperty(WIDTH_PROPERTY);
  else shell.style.setProperty(WIDTH_PROPERTY, `${widthWithin(px, innerWidth)}px`);
  const widthNow = Math.round(widthShowing());
  resizer.setAttribute("aria-valuemax", String(widestIn(innerWidth)));
  resizer.setAttribute("aria-valuenow", String(widthNow));
  return widthNow;
}

const widthShowing = (): number => side.getBoundingClientRect().width;
