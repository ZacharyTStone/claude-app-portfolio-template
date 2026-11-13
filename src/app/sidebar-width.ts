/* How wide the sidebar may be: its limits, the width a window leaves it,
   and what the browser remembers of it. It needs no page. */
import { clamp } from "es-toolkit";

/** In CSS pixels. */
export const SIDEBAR_WIDTH = {
  narrowest: 220,
  widest: 480,
  /** What the sidebar leaves the tab beside it, at least. */
  roomForTheRest: 560,
  /** How far an arrow key moves its edge. */
  arrowKeyStep: 16,
} as const;

/** The widest the sidebar can be in a window this wide: less than its
    widest where that would leave the rest too little room, but never less
    than its narrowest. */
export const widestIn = (windowWidth: number): number =>
  clamp(windowWidth - SIDEBAR_WIDTH.roomForTheRest, SIDEBAR_WIDTH.narrowest, SIDEBAR_WIDTH.widest);

/** The nearest width the sidebar can have in a window this wide, in whole
    pixels. */
export const widthWithin = (px: number, windowWidth: number): number =>
  Math.round(clamp(px, SIDEBAR_WIDTH.narrowest, widestIn(windowWidth)));

/** How far a key moves the sidebar's edge: the left arrow narrows the
    sidebar, the right one widens it, and any other key moves nothing. */
export function edgeStepFor(key: string): number {
  if (key === "ArrowLeft") return -SIDEBAR_WIDTH.arrowKeyStep;
  if (key === "ArrowRight") return SIDEBAR_WIDTH.arrowKeyStep;
  return 0;
}

/** The width in what was saved, or null for the stylesheet's own: nothing
    saved, "" (saved when the stylesheet's own was asked for), or anything
    that isn't a width. */
export function rememberedWidth(saved: string | null): number | null {
  const width = Number(saved);
  return width > 0 ? width : null;
}
