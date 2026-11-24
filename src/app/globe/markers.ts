/* The marks over the globe: the owner's, at their city, with their name
   above it, or the city's name beside it (written by the page), and this
   visitor's, at their own place, with "You" (made here). Each follows its place as the globe turns, and hides behind it.
   Near the globe's right edge its words go before its dot rather than be
   cut off, and once its dot and the name over it would be, it hides. */
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { make, query } from "../lib/dom.ts";
import { onScreen } from "./frame.ts";
import type { Placing } from "./placing.ts";
import type { Vector } from "./sphere.ts";

/** How far round the near side a place has to be for its mark to show. */
const SHOWS_FROM_DEPTH = 0.03;

/** How close the visitor's mark can come to the owner's, across and up or
    down, before its words would sit on theirs. */
const CROWDED = { across: 160, upOrDown: 20 };

/** How close to the globe's left and right edges a mark may come. */
const EDGE = 12;
/** How far the dot's middle is from the end of the mark it's at. */
const DOT_MIDDLE = 4;

type Spot = { x: number; y: number };

/** A mark, and the place it stands for. */
export type Mark = { marker: HTMLElement; point: Vector };

/** How wide a mark is, words and dot, and the name over its dot. */
export type Widths = { mark: number; name: number };

/** Each mark's widths as it last showed: a hidden mark has none to read. */
const shownWidths = new WeakMap<HTMLElement, Widths>();

/** How wide `marker` is. Read every mark's before moving any, so a frame
    lays the page out once. */
export function widthsOf(marker: HTMLElement): Widths {
  if (!marker.hidden) {
    const name = query(marker, CLASS_SELECTOR.globeName)?.offsetWidth ?? 0;
    shownWidths.set(marker, { mark: marker.offsetWidth, name });
  }
  return shownWidths.get(marker) ?? { mark: 0, name: 0 };
}

/** Where a mark's words go at `x`: after its dot, or, near the right
    edge, before it; none when its dot or the name over it would be cut
    off at either edge. */
function sideAt(x: number, { mark, name }: Widths, width: number): "after" | "before" | undefined {
  const half = Math.max(name / 2, DOT_MIDDLE);
  if (x - half < EDGE || x + half > width - EDGE) return undefined;
  if (x - DOT_MIDDLE + mark <= width - EDGE) return "after";
  return x + DOT_MIDDLE - mark >= EDGE ? "before" : undefined;
}

/** Puts a mark over its place as the globe is seen now, or hides it, and
    says where it put it. */
export function placeMarker({ marker, point }: Mark, widths: Widths, placing: Placing, longitude: number): Spot {
  const { x, y, depth } = onScreen(point, placing, longitude);
  const side = sideAt(x, widths, placing.width);
  marker.hidden = depth < SHOWS_FROM_DEPTH || side === undefined;
  marker.classList.toggle(PAGE_CLASSES.globeFlipped, side === "before");
  [marker.style.left, marker.style.top] = [`${x}px`, `${y}px`];
  return { x, y };
}

/** When the visitor is close to the owner (in the same town, or the next),
    their words go a line lower, under the owner's, so neither covers the
    other. */
export function keepWordsApart(you: HTMLElement, yours: Spot, owners: Spot): void {
  const isCrowded = Math.abs(yours.x - owners.x) < CROWDED.across && Math.abs(yours.y - owners.y) < CROWDED.upOrDown;
  you.classList.toggle(PAGE_CLASSES.globeCrowded, isCrowded);
}

/** The visitor's own mark: "You", and nothing more. */
export function youMarker(word: string): HTMLElement {
  return make(
    "div",
    { class: `${PAGE_CLASSES.globeMarker} ${PAGE_CLASSES.globeYou}`, "aria-hidden": "true" },
    make("span", { class: PAGE_CLASSES.globePlace }, word),
  );
}
