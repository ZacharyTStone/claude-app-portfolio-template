import { PLAYS_ATTRIBUTE } from "../../src/contracts/picture-files.ts";
import { FINISH_ID, LIGHT, RIMS, SHADOW } from "./finish.ts";
import { COLOR, FONT } from "./palette.ts";

/** One element of a picture: its SVG tag, attributes and what's inside. */
export type Shape = {
  tag: string;
  attributes: Attributes;
  children: Array<Shape | string>;
  /** Left out of the still picture: a dot that only travels, a ripple. */
  onlyWhenMoving?: boolean;
};

/** A shape's SVG attributes. One that's undefined isn't written. */
export type Attributes = Record<string, string | number | undefined>;

/** A shape of any tag. The named ones (`box`, `label`, `line`…) cover most of a diagram. */
export function shape(tag: string, attributes: Attributes = {}, ...children: Array<Shape | string>): Shape {
  return { tag, attributes, children };
}

/** A picture: its size in its own units (the `width` and `height` an `image` in the config gives), and its
    shapes, back to front. */
export type Drawing = {
  width: number;
  height: number;
  /** For how many seconds a visitor plays it: the page then shows it still, with a button, moving once by itself
      the first time it's scrolled to and then only when the button is pressed. Give the moment the moving
      picture looks as the still one does (a story's loop: `loop.clears.from`). Left out, the picture moves all
      the time, which suits one where little moves. */
  plays?: number;
  shapes: Shape[];
};

/** What a diagram's file exports by default. */
export type Diagram<Words> = {
  /** What its files are called, without ".svg". */
  name: string;
  /** Its wording, by language code. The first language's files have no code in their names. */
  words: Record<string, Words>;
  draw(words: Words): Drawing;
};

const MOTION_TAGS = new Set(["animate", "animateTransform", "animateMotion", "set"]);

/** The picture as an SVG file's text: as it moves, or still. */
export function svgOf({ width, height, plays, shapes }: Drawing, how: "moving" | "still"): string {
  const isMoving = how === "moving";
  const root = shape("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    "font-family": FONT.sans,
    [PLAYS_ATTRIBUTE]: isMoving ? plays : undefined,
  });
  const ground = [shape("rect", { width, height, fill: COLOR.ground }), finishDefinitions(), light(width, height)];
  const drawn = isMoving ? [...ground, ...shapes] : atRest([...ground, ...shapes]);
  // A line for each of the picture's top shapes, so a change reads in a diff.
  return `<svg${writtenAttributes(root.attributes)}>\n${drawn.map(written).join("\n")}\n</svg>\n`;
}

/** The finish's definitions (finish.ts), which a box's shadow and lit outline name: the light, the shadow, and
    the two rims. */
function finishDefinitions(): Shape {
  const rim = (id: keyof typeof RIMS) =>
    shape(
      "linearGradient",
      { id, x1: 0, y1: 0, x2: 0, y2: 1 },
      ...RIMS[id].map(([offset, colour]) => shape("stop", { offset, "stop-color": colour })),
    );
  return shape(
    "defs",
    {},
    shape(
      "radialGradient",
      { id: FINISH_ID.light, cx: "50%", cy: "0%", r: LIGHT.reach },
      shape("stop", { offset: "0", "stop-color": COLOR.accent, "stop-opacity": LIGHT.opacity }),
      shape("stop", { offset: "1", "stop-color": COLOR.accent, "stop-opacity": 0 }),
    ),
    shape(
      "filter",
      { id: FINISH_ID.lift, x: "-15%", y: "-20%", width: "130%", height: "160%" },
      shape("feDropShadow", {
        dx: 0,
        dy: SHADOW.down,
        stdDeviation: SHADOW.soft,
        "flood-color": "#000",
        "flood-opacity": SHADOW.opacity,
      }),
    ),
    rim(FINISH_ID.rim),
    rim(FINISH_ID.warmRim),
  );
}

/** The finish's light from the top, over the whole picture. */
const light = (width: number, height: number): Shape =>
  shape("rect", { width, height, fill: `url(#${FINISH_ID.light})` });

/** The shapes without their motion, and without those that are only there while the picture moves. */
function atRest(children: Array<Shape | string>): Array<Shape | string> {
  return children.flatMap((child): Array<Shape | string> => {
    if (typeof child === "string") return [child];
    if (child.onlyWhenMoving || MOTION_TAGS.has(child.tag)) return [];
    return [{ ...child, children: atRest(child.children) }];
  });
}

function written(one: Shape | string): string {
  if (typeof one === "string") return escaped(one);
  const opening = `<${one.tag}${writtenAttributes(one.attributes)}`;
  const inside = one.children.map(written).join("");
  return inside === "" ? `${opening}/>` : `${opening}>${inside}</${one.tag}>`;
}

function writtenAttributes(attributes: Attributes): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}="${escaped(typeof value === "number" ? rounded(value) : String(value))}"`)
    .join("");
}

/** A number as a file writes it: rounded, without a trailing ".0". For a path or a transform a diagram writes
    out itself. */
export function rounded(value: number, places = 2): string {
  return String(Number(value.toFixed(places)));
}

function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
