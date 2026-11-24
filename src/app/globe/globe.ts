/* The globe behind the home screen's text (the config's `globe`; frame.ts
   draws it). The first time the home screen shows, it turns from where its
   owner is from to where they are, drawing the way between, and marks
   where they are with their name and the city's. Then it's the visitor's
   to turn (spin.ts). With motion reduced, it shows the end at once. Its
   land is a script of its own, loaded only then. */
import { DATA } from "../../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { find, make, query } from "../lib/dom.ts";
import { isMotionReduced } from "../lib/motion.ts";
import { drift } from "./drift.ts";
import { drawFrame, type Scene } from "./frame.ts";
import { landPoints } from "./land-points.ts";
import { placeMarker, widthsOf, type Mark } from "./markers.ts";
import {
  LANDS_MS,
  PLAY_MS,
  momentAt,
  placeGlobe,
  sparkAt,
  turnOf,
  type Moment,
  type Placing,
  type Turn,
} from "./placing.ts";
import { sceneOf } from "./scene.ts";
import { makeSpinnable, type Turned } from "./spin.ts";
import { clamp, vectorOf, type Coordinates } from "./sphere.ts";

/** How far the globe tilts, up or down, under a drag, in degrees. */
const MOST_TILT = 35;
/** How far above the rim a drag can start. */
const GRAB_ABOVE_RIM = 24;

type Globe = {
  holder: HTMLElement;
  context: CanvasRenderingContext2D;
  owner: HTMLElement;
  here: Coordinates;
  turn: Turn;
  scene: Scene;
  /** None while there's no room for it, or the home screen is hidden. */
  placing: Placing | null;
  isDone: boolean;
  /** Where the visitor has turned it to, once it has landed. */
  view: Turned;
  grab: HTMLElement | null;
  isDrawingSoon: boolean;
  /** When a visitor last turned it (performance.now()), so its own slow
      turn rests a while after. */
  turnedAt: number;
  /** When it landed (performance.now()), for its spark. */
  landedAt: number;
  /** Whether it's drawn every frame once it has landed (drift.ts): not with
      motion reduced. Then its lights twinkle and its spark runs. */
  isLively: boolean;
};

/** Waits for the home screen to show, then turns the globe. */
export function initGlobe(): void {
  const holder = query(document, CLASS_SELECTOR.globe);
  const here = holder ? coordinatesIn(holder, DATA.globeHere) : undefined;
  if (!holder || !here || !("IntersectionObserver" in window)) return;
  const watcher = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    watcher.disconnect();
    void start(holder, here);
  });
  watcher.observe(holder);
}

/** "139.69 35.69", as the page carries a place. */
function coordinatesIn(element: HTMLElement, attribute: string): Coordinates | undefined {
  const [longitude, latitude] = (element.getAttribute(attribute) ?? "").split(" ").map(Number);
  if (longitude === undefined || latitude === undefined) return undefined;
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : undefined;
}

async function start(holder: HTMLElement, here: Coordinates): Promise<void> {
  const { LAND } = await import("./land.ts");
  const context = holder.querySelector("canvas")?.getContext("2d");
  if (!context) return;
  const from = coordinatesIn(holder, DATA.globeFrom);
  const scene = sceneOf(context, landPoints(LAND), { from, here, colours: getComputedStyle(holder) });
  const owner = find(holder, CLASS_SELECTOR.globeMarker);
  const globe: Globe = {
    ...{ holder, context, owner, here, scene, turn: turnOf(here, from), placing: null, isDone: false },
    ...{ view: { longitude: 0, tilt: 0 }, grab: null, isDrawingSoon: false, turnedAt: 0 },
    ...{ landedAt: 0, isLively: false },
  };
  fit(globe);
  new ResizeObserver(() => fit(globe)).observe(holder);
  play(globe);
}

/** Sizes the canvas to the home screen, sharp on any screen, and puts the
    globe under the text. */
function fit(globe: Globe): void {
  const { holder, context } = globe;
  const [width, height, scale] = [holder.clientWidth, holder.clientHeight, devicePixelRatio || 1];
  [context.canvas.width, context.canvas.height] = [Math.round(width * scale), Math.round(height * scale)];
  context.setTransform(scale, 0, 0, scale, 0, 0);
  globe.placing = width && height ? placeGlobe(width, height, textBottomIn(holder), globe.here[1]) : null;
  globe.owner.hidden = !globe.placing;
  if (globe.grab && globe.placing)
    globe.grab.style.top = `${globe.placing.y - globe.placing.radius - GRAB_ABOVE_RIM}px`;
  draw(globe, PLAY_MS);
}

/** How far down the globe's holder the home screen's text ends: every part
    of it but the last, the line under it, which may sit over the globe. */
function textBottomIn(holder: HTMLElement): number {
  const body = holder.parentElement ? query(holder.parentElement, CLASS_SELECTOR.homeBody) : null;
  const text = body ? [...body.children].slice(0, -1) : [];
  const top = holder.getBoundingClientRect().top;
  return Math.max(0, ...text.map((part) => part.getBoundingClientRect().bottom - top));
}

function play(globe: Globe): void {
  if (isMotionReduced()) return land(globe);
  const startedAt = performance.now();
  const frame = (now: number): void => {
    const ms = now - startedAt;
    draw(globe, ms);
    if (ms >= PLAY_MS) return land(globe);
    if (ms >= LANDS_MS) globe.holder.classList.add(PAGE_CLASSES.landed);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** The turn is over: the marks show, and the globe is the visitor's to
    turn. */
function land(globe: Globe): void {
  Object.assign(globe, { isDone: true, view: { longitude: globe.turn.end, tilt: 0 }, landedAt: performance.now() });
  globe.holder.classList.add(PAGE_CLASSES.landed);
  globe.grab = make("div", { class: PAGE_CLASSES.globeGrab, "aria-hidden": "true" });
  globe.holder.append(globe.grab);
  makeSpinnable(globe.grab, {
    degreesPerPixel: () => (globe.placing ? 180 / (Math.PI * globe.placing.radius) : 0),
    isOnGlobe: (event) => isOnGlobe(globe, event),
    turn: (by) => turnBy(globe, by),
  });
  globe.isLively = drift({
    isShowing: () => globe.placing !== null && globe.holder.clientWidth > 0,
    lastTurnedAt: () => globe.turnedAt,
    turn: (degrees) => {
      globe.view = { ...globe.view, longitude: globe.view.longitude + degrees };
      draw(globe, PLAY_MS);
    },
  });
  fit(globe);
}

function isOnGlobe({ holder, placing }: Globe, event: PointerEvent): boolean {
  if (!placing) return false;
  const box = holder.getBoundingClientRect();
  const [x, y] = [event.clientX - box.left - placing.x, event.clientY - box.top - placing.y];
  return Math.hypot(x, y) <= placing.radius * 1.02;
}

function turnBy(globe: Globe, by: Turned): void {
  globe.turnedAt = performance.now();
  globe.view = {
    longitude: globe.view.longitude + by.longitude,
    tilt: clamp(globe.view.tilt + by.tilt, -MOST_TILT, MOST_TILT),
  };
  // A lively globe is drawn every frame already.
  if (globe.isLively || globe.isDrawingSoon) return;
  globe.isDrawingSoon = true;
  requestAnimationFrame(() => {
    globe.isDrawingSoon = false;
    draw(globe, PLAY_MS);
  });
}

/** The moment of a globe that has landed: as the visitor has turned it,
    and, when it's lively, now, with its spark wherever it is. */
function landedMoment(globe: Globe): Moment {
  const moment = { longitude: globe.view.longitude, drawn: 1, settled: 1, shown: 1 };
  if (!globe.isLively) return moment;
  const at = performance.now();
  return { ...moment, at, spark: sparkAt(at - globe.landedAt) };
}

/** Draws the globe `ms` into its turn, or as the visitor has turned it once
    it's landed, with each mark over its place. */
function draw(globe: Globe, ms: number): void {
  if (!globe.placing) return;
  const placing = { ...globe.placing, latitude: globe.placing.latitude + globe.view.tilt };
  const moment = globe.isDone ? landedMoment(globe) : momentAt(ms, globe.turn);
  drawFrame(globe.context, globe.scene, placing, moment);
  const longitude = globe.isDone ? moment.longitude : globe.turn.end;
  const owner: Mark = { marker: globe.owner, point: vectorOf(globe.here) };
  placeMarker(owner, widthsOf(owner.marker), placing, longitude);
}
