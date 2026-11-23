/* One frame of the globe on its canvas: the warm air round its rim, its
   land as dots lit by the sun (with a town's lights here and there on the
   night side), and the way drawn from where its owner is from. */
import type { Moment, Placing } from "./placing.ts";
import { clamp, seeAll, seenFrom, type Vector } from "./sphere.ts";

/** A colour's red, green and blue, 0 to 255. */
export type Rgb = readonly [red: number, green: number, blue: number];

/** The globe's colours, from its stylesheet. */
export type Colours = { day: Rgb; night: Rgb; light: Rgb; accent: Rgb; page: Rgb };

/** Dots of one colour, as indexes into the land. */
export type DotGroup = { colour: Rgb; points: Uint32Array };

/** What every frame draws, worked out once. */
export type Scene = {
  /** Each point of land's x, y and z, in turn. */
  land: Float32Array;
  /** Where frameIn writes each point as seen, so it makes nothing new. */
  seen: Float32Array;
  /** How bright each point's dot is, before its depth dims it. */
  brightness: Float32Array;
  groups: DotGroup[];
  /** The way from where the owner is from to where they are: none, or
      points along it. */
  way: Vector[];
  colours: Colours;
};

/** How high above the globe the way rises in its middle, as a share of
    its radius. */
const WAY_LIFT = 0.06;
/** How far past the rim the way may still show as it comes over it. */
const WAY_SHOWS_WITHIN = 1.035;
const WAY_WIDTH = 1.6;
const WAY_GLOW = 10;
/** How much the way dims once the globe has landed, and how far round from
    the rim it fades in, so it comes over the horizon. */
const WAY_DIMS = 0.5;
const WAY_FADES_OVER = 0.12;
/** How the far side of the land dims and shrinks, towards the rim. */
const AT_RIM = { brightness: 0.35, size: 0.9 };

const rgba = ([red, green, blue]: Rgb, alpha: number): string => `rgba(${red}, ${green}, ${blue}, ${alpha})`;

/** Draws the globe at `moment`. */
export function drawFrame(context: CanvasRenderingContext2D, scene: Scene, placing: Placing, moment: Moment): void {
  context.clearRect(0, 0, placing.width, placing.height);
  drawAir(context, scene.colours, placing, moment.shown);
  seeAll({ longitude: moment.longitude, latitude: placing.latitude }, scene.land, scene.seen);
  for (const group of scene.groups) drawDots(context, scene, group, { placing, shown: moment.shown });
  context.globalAlpha = 1;
  drawWay(context, scene, placing, moment);
}

/** A soft warm glow round the rim, and the globe's face, a little lit
    towards the top, in front of it. */
function drawAir(context: CanvasRenderingContext2D, colours: Colours, placing: Placing, shown: number): void {
  const { x, y, radius } = placing;
  const glow = context.createRadialGradient(x, y, radius * 0.9, x, y, radius * 1.12);
  glow.addColorStop(0, rgba(colours.accent, 0));
  glow.addColorStop(0.45, rgba(colours.accent, 0.11 * shown));
  glow.addColorStop(1, rgba(colours.accent, 0));
  fillCircle(context, glow, x, y, radius * 1.12);
  fillCircle(context, rgba(colours.page, 1), x, y, radius);
  const top = y - radius * 0.9;
  const face = context.createRadialGradient(x, top, 0, x, top, radius * 0.9);
  face.addColorStop(0, rgba(colours.day, 0.06 * shown));
  face.addColorStop(1, rgba(colours.day, 0));
  fillCircle(context, face, x, y, radius);
  context.strokeStyle = rgba(colours.accent, 0.22 * shown);
  context.lineWidth = 1;
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.stroke();
}

function fillCircle(
  context: CanvasRenderingContext2D,
  fill: string | CanvasGradient,
  ...[x, y, radius]: [number, number, number]
): void {
  context.fillStyle = fill;
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fill();
}

/** The near side's dots of one colour: on the canvas, and smaller and
    dimmer towards the rim. */
function drawDots(
  context: CanvasRenderingContext2D,
  { seen, brightness }: Scene,
  { colour, points }: DotGroup,
  { placing, shown }: { placing: Placing; shown: number },
): void {
  const { x, y, radius, width, height } = placing;
  context.fillStyle = rgba(colour, 1);
  for (const point of points) {
    const depth = seen[point * 3 + 2] ?? -1;
    const dotX = x + radius * (seen[point * 3] ?? 0);
    const dotY = y - radius * (seen[point * 3 + 1] ?? 0);
    if (depth <= 0 || dotY > height || dotX < 0 || dotX > width) continue;
    const size = AT_RIM.size + depth;
    context.globalAlpha = (brightness[point] ?? 0) * (AT_RIM.brightness + (1 - AT_RIM.brightness) * depth) * shown;
    context.fillRect(dotX - size / 2, dotY - size / 2, size, size);
  }
}

/** Where a point is on the canvas, and how far round the near side it is:
    below 0 behind the globe. */
type OnScreen = { x: number; y: number; depth: number };

/** Where a point `lift` above the globe is on the canvas. */
export function onScreen(point: Vector, placing: Placing, longitude: number, lift = 0): OnScreen {
  const { across, up, depth } = seenFrom({ longitude, latitude: placing.latitude }, point);
  return {
    x: placing.x + placing.radius * across * (1 + lift),
    y: placing.y - placing.radius * up * (1 + lift),
    depth,
  };
}

/** The way as far as it's drawn, rising off the globe and brightest at its
    head, which is a spark until it lands. */
function drawWay(context: CanvasRenderingContext2D, { way, colours }: Scene, placing: Placing, moment: Moment): void {
  const steps = way.length - 1;
  if (steps < 1 || moment.drawn === 0) return;
  const drawn = way
    .slice(0, Math.floor(steps * moment.drawn) + 1)
    .map((point, step) => onScreen(point, placing, moment.longitude, WAY_LIFT * Math.sin((Math.PI * step) / steps)));
  context.save();
  context.beginPath();
  context.arc(placing.x, placing.y, placing.radius * WAY_SHOWS_WITHIN, 0, 2 * Math.PI);
  context.clip();
  Object.assign(context, { lineWidth: WAY_WIDTH, lineCap: "round", shadowBlur: WAY_GLOW });
  context.shadowColor = rgba(colours.accent, 0.9);
  drawn.forEach((end, step) => {
    const start = drawn[step - 1];
    if (!start || Math.min(start.depth, end.depth) <= 0) return;
    const towardsHead = step / (drawn.length - 1);
    const overHorizon = clamp(Math.min(start.depth, end.depth) / WAY_FADES_OVER);
    const alpha = towardsHead ** 1.8 * overHorizon * (1 - WAY_DIMS * moment.settled) * moment.shown;
    context.strokeStyle = rgba(colours.accent, alpha);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  });
  const head = drawn.at(-1);
  if (moment.drawn < 1 && head && head.depth > 0) fillCircle(context, rgba(colours.light, 0.95), head.x, head.y, 2.6);
  context.restore();
}
