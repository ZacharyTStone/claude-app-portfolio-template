/* The globe behind the home screen's text (the config's `globe`; frame.ts
   draws it). The first time the home screen shows, it turns from where its
   owner is from to where they are, drawing the way between, and marks
   where they are with their name, the city's and the time there. Then it's
   the visitor's to turn (spin.ts). With globe.visitors the way is drawn
   from this visitor, who is marked too, with their time, and dots show
   where the site's visitors have come from. With motion reduced, it shows
   the end at once. Its land is a script of its own, loaded only then. */
import { DATA } from "../../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import type { Visits, You } from "../../contracts/globe.ts";
import { find, make, query } from "../lib/dom.ts";
import { isMotionReduced } from "../lib/motion.ts";
import { words } from "../page.ts";
import { drawFrame, type Scene } from "./frame.ts";
import { landPoints } from "./land-points.ts";
import { keepWordsApart, placeMarker, tellYourTime, youMarker } from "./markers.ts";
import { LANDS_MS, PLAY_MS, momentAt, placeGlobe, turnOf, type Placing, type Turn } from "./placing.ts";
import { sceneOf, withVisits } from "./scene.ts";
import { makeSpinnable, type Turned } from "./spin.ts";
import { clamp, degreesApart, vectorOf, type Coordinates, type Vector } from "./sphere.ts";
import { askForVisits } from "./visits.ts";

/** How often the times beside the marks are told again. */
const TIME_EVERY_MS = 30_000;
/** How far the globe tilts, up or down, under a drag, in degrees. */
const MOST_TILT = 35;
/** How far above the rim a drag can start. */
const GRAB_ABOVE_RIM = 24;
/** How long the turn waits for /visits to say where this visitor is, so it
    can start from them; past that, it starts without. */
const WAITS_FOR_VISITS_MS = 1200;

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
  you: { marker: HTMLElement; point: Vector; place: You } | null;
  grab: HTMLElement | null;
  isDrawingSoon: boolean;
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
  const visitsAddress = holder.getAttribute(DATA.globeVisits);
  const visiting = visitsAddress ? askForVisits(visitsAddress) : Promise.resolve(null);
  const [{ LAND }, visits] = await Promise.all([import("./land.ts"), soonOrNone(visiting)]);
  const context = holder.querySelector("canvas")?.getContext("2d");
  if (!context) return;
  // The way is drawn from this visitor, when the site knows where they are
  // and they're further off than the owner's own town: from next door, a
  // way would be a stub, so there's none.
  const you = visits?.you;
  const yourPlace = you ? ([you.longitude, you.latitude] as const) : undefined;
  const from = yourPlace ? farEnough(yourPlace, here) : coordinatesIn(holder, DATA.globeFrom);
  const scene = sceneOf(context, landPoints(LAND), { from, here, colours: getComputedStyle(holder) });
  const owner = find(holder, CLASS_SELECTOR.globeMarker);
  const globe: Globe = {
    ...{ holder, context, owner, here, scene, turn: turnOf(here, from), placing: null, isDone: false },
    ...{ view: { longitude: 0, tilt: 0 }, you: null, grab: null, isDrawingSoon: false },
  };
  fit(globe);
  new ResizeObserver(() => fit(globe)).observe(holder);
  if (visits) showVisits(globe, visits);
  play(globe);
}

/** Within a degree (about 100 km), a place is next door: no way is drawn
    from it. */
const NEXT_DOOR_DEGREES = 1;

const farEnough = (place: Coordinates, here: Coordinates): Coordinates | undefined =>
  degreesApart(place, here) > NEXT_DOOR_DEGREES ? place : undefined;

const soonOrNone = <T>(coming: Promise<T | null>): Promise<T | null> =>
  Promise.race([coming, new Promise<null>((resolve) => setTimeout(() => resolve(null), WAITS_FOR_VISITS_MS))]);

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
    of it but the last, the credit, which may sit over the globe. */
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

/** The turn is over: the marks show with their times, kept up to date, and
    the globe is the visitor's to turn. */
function land(globe: Globe): void {
  Object.assign(globe, { isDone: true, view: { longitude: globe.turn.end, tilt: 0 } });
  globe.holder.classList.add(PAGE_CLASSES.landed);
  tellTimes(globe);
  setInterval(() => tellTimes(globe), TIME_EVERY_MS);
  globe.grab = make("div", { class: PAGE_CLASSES.globeGrab, "aria-hidden": "true" });
  globe.holder.append(globe.grab);
  makeSpinnable(globe.grab, {
    degreesPerPixel: () => (globe.placing ? 180 / (Math.PI * globe.placing.radius) : 0),
    isOnGlobe: (event) => isOnGlobe(globe, event),
    turn: (by) => turnBy(globe, by),
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
  globe.view = {
    longitude: globe.view.longitude + by.longitude,
    tilt: clamp(globe.view.tilt + by.tilt, -MOST_TILT, MOST_TILT),
  };
  if (globe.isDrawingSoon) return;
  globe.isDrawingSoon = true;
  requestAnimationFrame(() => {
    globe.isDrawingSoon = false;
    draw(globe, PLAY_MS);
  });
}

/** Draws the globe `ms` into its turn, or as the visitor has turned it once
    it's landed, with each mark over its place. */
function draw(globe: Globe, ms: number): void {
  if (!globe.placing) return;
  const placing = { ...globe.placing, latitude: globe.placing.latitude + globe.view.tilt };
  const moment = globe.isDone
    ? { longitude: globe.view.longitude, drawn: 1, settled: 1, shown: 1 }
    : momentAt(ms, globe.turn);
  drawFrame(globe.context, globe.scene, placing, moment);
  const longitude = globe.isDone ? moment.longitude : globe.turn.end;
  const owners = placeMarker(globe.owner, vectorOf(globe.here), placing, longitude);
  if (!globe.you) return;
  const yours = placeMarker(globe.you.marker, globe.you.point, placing, longitude);
  keepWordsApart(globe.you.marker, yours, owners);
}

/** With globe.visitors, once /visits has said: the site's visitors' places,
    and this visitor's own mark. */
function showVisits(globe: Globe, visits: Visits): void {
  globe.scene = withVisits(globe.scene, visits.places);
  const { you } = visits;
  if (you) {
    const marker = youMarker(words.globeYou ?? "");
    globe.holder.append(marker);
    globe.you = { marker, point: vectorOf([you.longitude, you.latitude]), place: you };
    tellYourTime(marker, you);
  }
  draw(globe, PLAY_MS);
}

function tellTimes(globe: Globe): void {
  const time = query(globe.owner, CLASS_SELECTOR.globeTime);
  const timeZone = globe.holder.getAttribute(DATA.globeZone);
  if (globe.you) tellYourTime(globe.you.marker, globe.you.place);
  if (!time || !timeZone) return;
  const language = document.documentElement.lang || undefined;
  const format = new Intl.DateTimeFormat(language, { timeZone, hour: "numeric", minute: "2-digit" });
  time.textContent = format.format(new Date());
}
