/* The globe behind the home screen's text (the config's `globe`; frame.ts
   draws it). The first time the home screen shows, it turns from where its
   owner is from to where they are, drawing the way between, and then marks
   where they are with the time there. With motion reduced, it shows the end
   at once. Its land is a script of its own, loaded only then. */
import { DATA } from "../../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { find, query } from "../lib/dom.ts";
import { isMotionReduced } from "../lib/motion.ts";
import { drawFrame, onScreen, type Scene } from "./frame.ts";
import { landPoints } from "./land-points.ts";
import { LANDS_MS, PLAY_MS, momentAt, placeGlobe, turnOf, type Placing, type Turn } from "./placing.ts";
import { sceneOf } from "./scene.ts";
import { vectorOf, type Coordinates } from "./sphere.ts";

/** How often the time beside the marker is told again. */
const TIME_EVERY_MS = 30_000;

type Globe = {
  holder: HTMLElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  marker: HTMLElement;
  here: Coordinates;
  turn: Turn;
  scene: Scene;
  /** None while there's no room for it, or the home screen is hidden. */
  placing: Placing | null;
  isDone: boolean;
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

/** "140.47 37.75", as the page carries a place. */
function coordinatesIn(element: HTMLElement, attribute: string): Coordinates | undefined {
  const [longitude, latitude] = (element.getAttribute(attribute) ?? "").split(" ").map(Number);
  if (longitude === undefined || latitude === undefined) return undefined;
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : undefined;
}

async function start(holder: HTMLElement, here: Coordinates): Promise<void> {
  const { LAND } = await import("./land.ts");
  const canvas = holder.querySelector("canvas");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  const from = coordinatesIn(holder, DATA.globeFrom);
  const marker = find(holder, CLASS_SELECTOR.globeMarker);
  const scene = sceneOf(context, landPoints(LAND), { from, here, colours: getComputedStyle(holder) });
  const globe: Globe = {
    holder,
    canvas,
    context,
    marker,
    here,
    turn: turnOf(here, from),
    scene,
    placing: null,
    isDone: false,
  };
  fit(globe);
  new ResizeObserver(() => fit(globe)).observe(holder);
  play(globe);
}

/** Sizes the canvas to the home screen, sharp on any screen, and puts the
    globe under the text and the marker where it lands. */
function fit(globe: Globe): void {
  const { holder, canvas, context, marker } = globe;
  const [width, height, scale] = [holder.clientWidth, holder.clientHeight, devicePixelRatio || 1];
  [canvas.width, canvas.height] = [Math.round(width * scale), Math.round(height * scale)];
  context.setTransform(scale, 0, 0, scale, 0, 0);
  globe.placing = width && height ? placeGlobe(width, height, textBottomIn(holder), globe.here[1]) : null;
  marker.hidden = !globe.placing;
  if (globe.placing) {
    const { x, y } = onScreen(vectorOf(globe.here), globe.placing, globe.turn.end);
    [marker.style.left, marker.style.top] = [`${x}px`, `${y}px`];
  }
  if (globe.isDone) drawAt(globe, PLAY_MS);
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
  if (isMotionReduced()) {
    globe.isDone = true;
    drawAt(globe, PLAY_MS);
    return land(globe);
  }
  const startedAt = performance.now();
  const frame = (now: number): void => {
    const ms = now - startedAt;
    drawAt(globe, ms);
    if (ms >= LANDS_MS && !globe.holder.classList.contains(PAGE_CLASSES.landed)) land(globe);
    if (ms < PLAY_MS) requestAnimationFrame(frame);
    else globe.isDone = true;
  };
  requestAnimationFrame(frame);
}

function drawAt(globe: Globe, ms: number): void {
  if (globe.placing) drawFrame(globe.context, globe.scene, globe.placing, momentAt(ms, globe.turn));
}

/** The marker shows, with the time where it is, kept up to date. */
function land(globe: Globe): void {
  tellTime(globe);
  setInterval(() => tellTime(globe), TIME_EVERY_MS);
  globe.holder.classList.add(PAGE_CLASSES.landed);
}

function tellTime({ holder, marker }: Globe): void {
  const time = query(marker, CLASS_SELECTOR.globeTime);
  const timeZone = holder.getAttribute(DATA.globeZone);
  if (!time || !timeZone) return;
  const language = document.documentElement.lang || undefined;
  time.textContent = new Intl.DateTimeFormat(language, { timeZone, hour: "numeric", minute: "2-digit" }).format(
    new Date(),
  );
}
