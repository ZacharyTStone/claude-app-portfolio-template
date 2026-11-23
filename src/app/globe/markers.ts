/* The marks over the globe: the owner's, at their city, with their name
   above it and the city's name and time beside it (written by the page),
   and this visitor's, at their own place, with their town and time (made
   here). Each follows its place as the globe turns, and hides behind it. */
import type { You } from "../../contracts/globe.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { make } from "../lib/dom.ts";
import { onScreen } from "./frame.ts";
import type { Placing } from "./placing.ts";
import type { Vector } from "./sphere.ts";

/** How far round the near side a place has to be for its mark to show. */
const SHOWS_FROM_DEPTH = 0.03;

/** Puts `marker` over `point` as the globe is seen now, or hides it. */
export function placeMarker(marker: HTMLElement, point: Vector, placing: Placing, longitude: number): void {
  const { x, y, depth } = onScreen(point, placing, longitude);
  marker.hidden = depth < SHOWS_FROM_DEPTH;
  [marker.style.left, marker.style.top] = [`${x}px`, `${y}px`];
}

/** The visitor's own mark: "You", then their town, if Cloudflare knows it,
    and their time, which tellYourTime keeps. */
export function youMarker(word: string): HTMLElement {
  return make(
    "div",
    { class: `${PAGE_CLASSES.globeMarker} ${PAGE_CLASSES.globeYou}`, "aria-hidden": "true" },
    make("span", { class: PAGE_CLASSES.globePlace }, word),
    make("span", { class: PAGE_CLASSES.globeTime }),
  );
}

/** The visitor's town and their own time, beside their mark. */
export function tellYourTime(marker: HTMLElement, { town }: You): void {
  const where = marker.querySelector(CLASS_SELECTOR.globeTime);
  if (!where) return;
  const language = document.documentElement.lang || undefined;
  const time = new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit" }).format(new Date());
  where.textContent = town ? `${town} · ${time}` : time;
}
