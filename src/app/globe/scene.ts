/* What every frame of the globe draws, worked out once when it starts: each
   point of land's brightness by the sun as it is now, which of them are a
   town's lights at night, the way, and the colours from the stylesheet. */
import type { Colours, DotGroup, Rgb, Scene } from "./frame.ts";
import { daylight, sunAt, wayBetween, type Coordinates, type Vector } from "./sphere.ts";

/** How bright a dot is by day, by night and as a town's lights. */
const BRIGHTNESS = { day: 0.66, night: 0.34, light: 0.95 };
/** How many in a hundred of the night side's dots are a town's lights. */
const LIGHTS_PER_HUNDRED = 9;
/** Below this much daylight a point can be a town's lights; above this
    one it's drawn in the day's colour. */
const DARK_ENOUGH_FOR_LIGHTS = 0.3;
const LIGHT_ENOUGH_FOR_DAY = 0.5;
const WAY_STEPS = 120;

/** The globe's custom properties (in Home.css), and the page's own. */
const COLOUR_PROPERTIES: Record<keyof Colours, string> = {
  day: "--globe-day",
  night: "--globe-night",
  light: "--globe-light",
  accent: "--accent",
  page: "--page",
};

type Kind = "day" | "night" | "light";

type SceneParts = {
  from: Coordinates | undefined;
  here: Coordinates;
  /** The globe's computed style, which has its colours. */
  colours: CSSStyleDeclaration;
};

export function sceneOf(context: CanvasRenderingContext2D, land: Float32Array, parts: SceneParts): Scene {
  const colours = coloursOf(context, parts.colours);
  const sun = sunAt(new Date());
  const count = land.length / 3;
  const brightness = new Float32Array(count);
  const byKind: Record<Kind, number[]> = { day: [], night: [], light: [] };
  for (let point = 0; point < count; point++) {
    const at: Vector = [land[point * 3] ?? 0, land[point * 3 + 1] ?? 0, land[point * 3 + 2] ?? 0];
    const lit = daylight(at, sun);
    const kind = kindOf(point, lit);
    brightness[point] =
      kind === "light" ? BRIGHTNESS.light : BRIGHTNESS.night + (BRIGHTNESS.day - BRIGHTNESS.night) * lit;
    byKind[kind].push(point);
  }
  const groups = (Object.keys(byKind) as Kind[]).map((kind): DotGroup => ({
    colour: colours[kind],
    points: Uint32Array.from(byKind[kind]),
  }));
  const way = parts.from ? wayBetween(parts.from, parts.here, WAY_STEPS) : [];
  return { land, seen: new Float32Array(land.length), brightness, groups, way, colours };
}

/** A night point's lights are spread by a hash of its place in the
    lattice, so they're the same on every visit. */
function kindOf(point: number, lit: number): Kind {
  const isLight =
    lit < DARK_ENOUGH_FOR_LIGHTS && Math.imul(point, 2654435761) >>> 0 < (LIGHTS_PER_HUNDRED / 100) * 2 ** 32;
  if (isLight) return "light";
  return lit > LIGHT_ENOUGH_FOR_DAY ? "day" : "night";
}

function coloursOf(context: CanvasRenderingContext2D, style: CSSStyleDeclaration): Colours {
  const rgbOfProperty = (property: string): Rgb => rgbOf(context, style.getPropertyValue(property).trim());
  return {
    day: rgbOfProperty(COLOUR_PROPERTIES.day),
    night: rgbOfProperty(COLOUR_PROPERTIES.night),
    light: rgbOfProperty(COLOUR_PROPERTIES.light),
    accent: rgbOfProperty(COLOUR_PROPERTIES.accent),
    page: rgbOfProperty(COLOUR_PROPERTIES.page),
  };
}

/** Any colour the stylesheet can write, as red, green and blue: the canvas
    reads it, and says it back as "#rrggbb" (or "rgba(…)" when it's see-
    through). */
function rgbOf(context: CanvasRenderingContext2D, colour: string): Rgb {
  context.fillStyle = "#000";
  context.fillStyle = colour || "#000";
  const asCanvasSaysIt = String(context.fillStyle);
  if (asCanvasSaysIt.startsWith("#")) {
    const value = parseInt(asCanvasSaysIt.slice(1), 16);
    return [value >> 16, (value >> 8) & 255, value & 255];
  }
  const [red = 0, green = 0, blue = 0] = (asCanvasSaysIt.match(/[\d.]+/g) ?? []).map(Number);
  return [red, green, blue];
}
