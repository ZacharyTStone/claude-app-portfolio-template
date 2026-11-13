import { COLOR, FONT } from "./palette.ts";
import type { Place, Point } from "./places.ts";
import { rounded, shape, type Attributes, type Shape } from "./svg.ts";

/** Shapes drawn together: moved, faded or shown as one. */
export function group(attributes: Attributes, ...children: Shape[]): Shape {
  return shape("g", attributes, ...children);
}

/** Shapes drawn around (0, 0), put at a point. What's scaled or turned is scaled or turned about (0, 0): draw
    it there, and place it. */
export function placed(at: Point, ...shapes: Shape[]): Shape {
  return group({ transform: `translate(${rounded(at.x)} ${rounded(at.y)})` }, ...shapes);
}

/** The same shape, with motion on it: `moving(box(…), loop.shown(…))`. */
export function moving(target: Shape, ...motions: Shape[]): Shape {
  return { ...target, children: [...target.children, ...motions] };
}

/** The same shape, left out of the still picture. */
export function onlyWhenMoving(target: Shape): Shape {
  return { ...target, onlyWhenMoving: true };
}

/** The same shape, at the opacity it has while nothing moves it (undefined: none written). */
export function restingAt(target: Shape, opacity: number | undefined): Shape {
  return { ...target, attributes: { ...target.attributes, opacity } };
}

const DASHED = "10 12";

/** A rounded box. A `line` of "none" leaves it without an outline. */
export function box(
  at: Place,
  look: { radius?: number; fill?: string; line?: string; lineWidth?: number; dashed?: boolean; opacity?: number } = {},
): Shape {
  const { radius = 22, fill = COLOR.box, line = COLOR.boxLine, lineWidth = 2, dashed = false, opacity } = look;
  const hasOutline = line !== "none";
  return shape("rect", {
    x: at.x,
    y: at.y,
    width: at.width,
    height: at.height,
    rx: radius,
    fill,
    stroke: hasOutline ? line : undefined,
    "stroke-width": hasOutline ? lineWidth : undefined,
    "stroke-dasharray": dashed ? DASHED : undefined,
    opacity,
  });
}

/** A bar that stands for words: writing too small to read, or that doesn't matter. It's rounded at both ends,
    and `at` is its top left. */
export function bar(
  at: Point & { width: number },
  look: { height?: number; color?: string; opacity?: number } = {},
): Shape {
  const { height = 22, color = COLOR.mark, opacity } = look;
  return box({ ...at, height }, { radius: height / 2, fill: color, line: "none", opacity });
}

const REGULAR_WEIGHT = 400;

/** A line of text. `at` is where its baseline starts, ends or is centred, by `anchor` (`baselineAround` finds
    the baseline for a height). */
export function label(
  text: string,
  at: Point,
  look: {
    size?: number;
    weight?: number;
    color?: string;
    anchor?: "start" | "middle" | "end";
    mono?: boolean;
    opacity?: number;
  } = {},
): Shape {
  const { size = 40, weight = REGULAR_WEIGHT, color = COLOR.text, anchor = "middle", mono = false, opacity } = look;
  return shape(
    "text",
    {
      x: at.x,
      y: at.y,
      "text-anchor": anchor === "start" ? undefined : anchor,
      "font-family": mono ? FONT.mono : undefined,
      "font-size": size,
      "font-weight": weight === REGULAR_WEIGHT ? undefined : weight,
      fill: color,
      opacity,
    },
    text,
  );
}

/** A circle. */
export function dot(at: Point, radius: number, look: { fill?: string; opacity?: number } = {}): Shape {
  return shape("circle", { cx: at.x, cy: at.y, r: radius, fill: look.fill ?? COLOR.accent, opacity: look.opacity });
}

/** A line along a path (`d`, as SVG writes one: "M0 0 C…"). Its length counts as 1, whatever it measures, so
    `loop.draw` can draw any line; one with `dashes` of its own can't be drawn that way. */
export function line(
  d: string,
  look: { color?: string; width?: number; opacity?: number; dashes?: string } = {},
): Shape {
  const { color = COLOR.accent, width = 4, opacity, dashes } = look;
  return shape("path", {
    d,
    fill: "none",
    stroke: color,
    "stroke-width": width,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-dasharray": dashes,
    pathLength: dashes ? undefined : 1,
    opacity,
  });
}

/** How long an arrowhead is, from its tip back: an arrow's line stops that far short of where its head points. */
export const ARROWHEAD_LENGTH = 16;
const ARROWHEAD_HALF_WIDTH = 9.92;
const ARROWHEAD_OUTLINE = 4;

/** An arrowhead whose tip is at `tip`, pointing along `degrees` (0 is to the right, 90 is down). */
export function arrowhead(tip: Point, degrees: number, color: string = COLOR.accent): Shape {
  return shape("path", {
    d: `M0 0 L-${ARROWHEAD_LENGTH} -${ARROWHEAD_HALF_WIDTH} L-${ARROWHEAD_LENGTH} ${ARROWHEAD_HALF_WIDTH}Z`,
    fill: color,
    stroke: color,
    "stroke-width": ARROWHEAD_OUTLINE,
    "stroke-linejoin": "round",
    transform: `translate(${rounded(tip.x)} ${rounded(tip.y)}) rotate(${rounded(degrees)})`,
  });
}

/** A field of dots from rows of text, a dot wherever a row has an "o": a map, a texture. One path, however
    many dots. */
export function dots(
  rows: readonly string[],
  at: Point & { step: number },
  look: { radius?: number; color?: string } = {},
): Shape {
  const { radius = 3.4, color = COLOR.faint } = look;
  const places = rows.flatMap((row, r) =>
    [...row].flatMap((mark, c) =>
      mark === "o" ? [`M${rounded(at.x + c * at.step)} ${rounded(at.y + r * at.step)}h0`] : [],
    ),
  );
  return shape("path", {
    d: places.join(""),
    fill: "none",
    stroke: color,
    "stroke-width": radius * 2,
    "stroke-linecap": "round",
  });
}
