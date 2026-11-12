/* The diagram kit: what a picture that moves is drawn with.

   A diagram (diagrams/*.ts) is a function that returns shapes: boxes,
   labels, lines, and the motion on them. `npm run diagrams` writes each as
   SVG files in public/assets, which an answer shows as any picture
   (`image` in site.config.ts).

   The motion is SVG's own animation elements (<animate>, <animateMotion>,
   <animateTransform>), which run in a picture a page shows with <img>: no
   script, no stylesheet, nothing the page's policy would have to allow.
   Every one of them lasts the whole loop and repeats for ever, so a
   picture's parts stay in step however long it's watched; when a part
   moves is written as seconds into the loop.

   Each diagram is written twice: as it moves, and still (`-still.svg`),
   for a visitor who has asked for less motion. The still one is the same
   shapes without their motion, so draw every shape the way it should rest:
   what a still picture shouldn't have (a dot on its way somewhere) is
   `onlyWhenMoving`.

   This file imports nothing: it runs on Node alone, like the other
   scripts. */

// ---- Shapes --------------------------------------------------------------------

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

/** A point in the picture, in its own units from the top left. */
export type Point = { x: number; y: number };

/** The colours the site's pictures are drawn in: its dark theme's, since a
    picture can't read the page's stylesheet. */
export const COLOR = {
  /** Behind everything. */
  ground: "#1f1f1f",
  /** A box, and the line around it. */
  box: "#2b2b2b",
  boxLine: "#3d3d3d",
  /** A panel that holds boxes. */
  panel: "#242424",
  /** Something drawn faintly, behind what matters: a map's dots. */
  faint: "#3b3b3b",
  /** A bar that stands for a line of text. */
  mark: "#4f4f4f",
  /** A line that isn't what the picture is about. */
  line: "#757575",
  /** Text, and text that's secondary. */
  text: "#ededed",
  quiet: "#a6a6a6",
  /** What the picture is about: its lines, and the one box it's about. */
  accent: "#d97757",
  accentBright: "#f0a184",
  accentBox: "#3a2a24",
  accentInner: "#2a201c",
  accentLine: "#6b4435",
  /** Something refused. */
  refused: "#8f8f8f",
} as const;

/** The fonts, as the site has them. A picture can't load the site's font
    files, so each list ends in what every computer has. */
export const FONT = {
  sans: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif",
  mono: "'Geist Mono', ui-monospace, Menlo, Consolas, 'Hiragino Sans', 'Yu Gothic', Meiryo, monospace",
} as const;

/** A shape of any tag. The named ones below cover most of a diagram. */
export function shape(tag: string, attributes: Attributes = {}, ...children: Array<Shape | string>): Shape {
  return { tag, attributes, children };
}

/** Shapes drawn together: moved, faded or shown as one. */
export function group(attributes: Attributes, ...children: Shape[]): Shape {
  return shape("g", attributes, ...children);
}

/** The same shape, with motion on it: `moving(box(…), loop.fade(…))`. */
export function moving(target: Shape, ...motions: Shape[]): Shape {
  return { ...target, children: [...target.children, ...motions] };
}

/** The same shape, left out of the still picture. */
export function onlyWhenMoving(target: Shape): Shape {
  return { ...target, onlyWhenMoving: true };
}

/** A rounded box. */
export function box(
  at: Point & { width: number; height: number },
  look: { radius?: number; fill?: string; line?: string; lineWidth?: number; dashed?: boolean; opacity?: number } = {},
): Shape {
  const { radius = 22, fill = COLOR.box, line = COLOR.boxLine, lineWidth = 2, dashed = false, opacity } = look;
  return shape("rect", {
    x: at.x,
    y: at.y,
    width: at.width,
    height: at.height,
    rx: radius,
    fill,
    stroke: line === "none" ? undefined : line,
    "stroke-width": line === "none" ? undefined : lineWidth,
    "stroke-dasharray": dashed ? "10 12" : undefined,
    opacity,
  });
}

/** A line of text. `at` is where its baseline starts, ends or is centred,
    by `anchor`. */
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
  const { size = 40, weight = 400, color = COLOR.text, anchor = "middle", mono = false, opacity } = look;
  return shape(
    "text",
    {
      x: at.x,
      y: at.y,
      "text-anchor": anchor === "start" ? undefined : anchor,
      "font-family": mono ? FONT.mono : undefined,
      "font-size": size,
      "font-weight": weight === 400 ? undefined : weight,
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

/** A line along a path (`d`, as SVG writes one: "M0 0 C…"). Its length
    counts as 1, whatever it measures, so `loop.draw` can draw any line. */
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

/** An arrowhead whose tip is at `tip`, pointing along `degrees` (0 is to
    the right, 90 is down). */
export function arrowhead(tip: Point, degrees: number, color: string = COLOR.accent): Shape {
  return shape("path", {
    d: "M0 0 L-16 -9.92 L-16 9.92Z",
    fill: color,
    stroke: color,
    "stroke-width": 4,
    "stroke-linejoin": "round",
    transform: `translate(${number(tip.x)} ${number(tip.y)}) rotate(${number(degrees)})`,
  });
}

/** A curve from one point to another that leaves and arrives level, as an
    arrow between two boxes side by side does. */
export function levelCurve(from: Point, to: Point): string {
  const middle = (from.x + to.x) / 2;
  return `M${number(from.x)} ${number(from.y)} C${number(middle)} ${number(from.y)} ${number(middle)} ${number(to.y)} ${number(to.x)} ${number(to.y)}`;
}

/** An arc from one point to another, lifted in the middle by `lift` times
    its length: the line a flight draws on a map. */
export function arc(from: Point, to: Point, lift = 0.22): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - length * lift };
  return `M${number(from.x)} ${number(from.y)} Q${number(middle.x)} ${number(middle.y)} ${number(to.x)} ${number(to.y)}`;
}

/** A field of dots from rows of text, a dot wherever a row has an "o":
    a map, a texture. One path, however many dots. */
export function dots(
  rows: readonly string[],
  at: Point & { step: number },
  look: { radius?: number; color?: string } = {},
): Shape {
  const { radius = 3.4, color = COLOR.faint } = look;
  const places = rows.flatMap((row, r) =>
    [...row].flatMap((mark, c) =>
      mark === "o" ? [`M${number(at.x + c * at.step)} ${number(at.y + r * at.step)}h0`] : [],
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

/** About how wide a line of text is drawn, to size a box around it. The
    picture is drawn in whatever font the visitor's computer has, so leave
    room: this is an estimate for Inter, and a full square for kana and
    kanji. */
export function textWidth(text: string, size: number, mono = false): number {
  const widthOf = (character: string) => {
    if (/[^\u0000-ɏ -⁯]/.test(character)) return 1;
    if (mono) return 0.6;
    if (character === " ") return 0.28;
    if (/[ilj.,:;'’|!]/.test(character)) return 0.27;
    if (/[mwMW]/.test(character)) return 0.85;
    if (/[A-Z0-9]/.test(character)) return 0.66;
    return 0.55;
  };
  return [...text].reduce((width, character) => width + widthOf(character), 0) * size;
}

// ---- Motion --------------------------------------------------------------------

/** A value at a time: [seconds into the loop, the value then]. */
export type Frame = [seconds: number, value: number | string];

/** How a value gets from one frame to the next: eased ("smooth"), at an
    even pace ("even"), or all at once when the frame comes ("steps"). */
export type Pace = "smooth" | "even" | "steps";

/** The motion of one loop: every method returns a shape to put inside the
    one it moves (`moving(target, …)`), or a finished shape of its own. */
export type Loop = ReturnType<typeof loopOf>;

/** The motion for a picture that repeats every `seconds`. */
export function loopOf(seconds: number) {
  const timing = { dur: `${number(seconds)}s`, repeatCount: "indefinite" };

  /** The frames as SVG's `values` and `keyTimes`, held from the loop's
      start to the first frame and from the last to the loop's end. */
  function keyed(frames: Frame[], pace: Pace): Attributes {
    if (frames.length === 0) throw new Error("A track needs at least one frame");
    frames.forEach(([at], i) => {
      if (at < 0 || at > seconds) throw new Error(`A frame at ${at} s is outside the loop's ${seconds} s`);
      if (i > 0 && at < frames[i - 1]![0]) throw new Error(`The frame at ${at} s comes before the one it follows`);
    });
    const whole: Frame[] = [...frames];
    if (whole[0]![0] > 0) whole.unshift([0, whole[0]![1]]);
    // A value that steps is held until the loop ends without being told to.
    if (pace !== "steps" && whole.at(-1)![0] < seconds) whole.push([seconds, whole.at(-1)![1]]);
    return {
      values: whole.map(([, value]) => (typeof value === "number" ? number(value) : value)).join(";"),
      keyTimes: whole.map(([at]) => number(at / seconds, 4)).join(";"),
      calcMode: pace === "smooth" ? "spline" : pace === "steps" ? "discrete" : undefined,
      keySplines:
        pace === "smooth"
          ? whole
              .slice(1)
              .map(() => EASE)
              .join(";")
          : undefined,
    };
  }

  /** An attribute's values over the loop: `track("opacity", [[1, 0], [1.4, 1]])`. */
  function track(attribute: string, frames: Frame[], pace: Pace = "smooth"): Shape {
    return shape("animate", { attributeName: attribute, ...timing, ...keyed(frames, pace) });
  }

  /** Shown from `from` to `to` (seconds), fading in and out over `fade`.
      The shape it's on should rest at opacity 0, or at 1 if it belongs in
      the still picture. */
  function shown(from: number, to: number, fade = 0.3): Shape {
    return track("opacity", [
      [Math.max(0, from - 0.001), 0],
      [Math.min(seconds, from + fade), 1],
      [Math.max(from + fade, to - fade), 1],
      [Math.min(seconds, to), 0],
    ]);
  }

  /** A line drawn from its start to its end between `from` and `to`. */
  function draw(from: number, to: number): Shape[] {
    return [
      shape("set", { attributeName: "stroke-dasharray", to: "1" }),
      track("stroke-dashoffset", [
        [from, 1],
        [to, 0],
      ]),
    ];
  }

  /** A transform's values over the loop: `transform("scale", [[2, 0], [2.3, 1]])`,
      `transform("translate", [[0, "0 0"], [1, "0 -40"]])`. A scale is about the
      shape's own (0, 0): draw it around there, in a group moved into place. */
  function transform(kind: "scale" | "translate" | "rotate", frames: Frame[], pace: Pace = "smooth"): Shape {
    return shape("animateTransform", { attributeName: "transform", type: kind, ...timing, ...keyed(frames, pace) });
  }

  /** Movement along a path between `from` and `to`: at the path's start
      before, at its end after. `back` goes from the end to the start. */
  function along(d: string, from: number, to: number, back = false): Shape {
    const [start, end] = back ? [1, 0] : [0, 1];
    return shape("animateMotion", {
      path: d,
      ...timing,
      calcMode: "spline",
      keyPoints: `${start};${start};${end};${end}`,
      keyTimes: `0;${number(from / seconds, 4)};${number(to / seconds, 4)};1`,
      keySplines: `${LINEAR};${EASE};${LINEAR}`,
    });
  }

  /** A dot that travels a path between `from` and `to`, with a soft glow,
      and is there only while it travels. */
  function traveller(
    d: string,
    from: number,
    to: number,
    look: { color?: string; radius?: number; back?: boolean } = {},
  ): Shape {
    const { color = COLOR.accentBright, radius = 10, back = false } = look;
    return onlyWhenMoving(
      moving(
        group(
          { opacity: 0 },
          dot({ x: 0, y: 0 }, radius * 2.2, { fill: color, opacity: 0.22 }),
          dot({ x: 0, y: 0 }, radius, { fill: color }),
        ),
        track(
          "opacity",
          [
            [Math.max(0, from - 0.001), 0],
            [from + 0.12, 1],
            [to - 0.05, 1],
            [Math.min(seconds, to + 0.12), 0],
          ],
          "even",
        ),
        along(d, from, to, back),
      ),
    );
  }

  /** A ring that spreads from a point and fades, starting at each of
      `times`: something happened here. */
  function ripple(at: Point, times: number[], look: { color?: string; reach?: number } = {}): Shape {
    const { color = COLOR.accent, reach = 46 } = look;
    const last = 0.9;
    return onlyWhenMoving(
      moving(
        shape("circle", { cx: at.x, cy: at.y, r: 6, fill: "none", stroke: color, "stroke-width": 3, opacity: 0 }),
        track(
          "r",
          times.flatMap((time): Frame[] => [
            [time, 6],
            [Math.min(seconds, time + last), reach],
          ]),
          "even",
        ),
        track(
          "opacity",
          times.flatMap((time): Frame[] => [
            [Math.max(0, time - 0.001), 0],
            [time, 0.9],
            [Math.min(seconds, time + last), 0],
          ]),
          "even",
        ),
      ),
    );
  }

  /** Opacity that jumps to `peak` at each of `times` and falls away over
      `fall` seconds: a flash on whatever it's put on (resting at 0). */
  function flash(times: number[], look: { peak?: number; fall?: number } = {}): Shape {
    const { peak = 1, fall = 0.7 } = look;
    return track(
      "opacity",
      times.flatMap((time): Frame[] => [
        [Math.max(0, time - 0.001), 0],
        [time + 0.08, peak],
        [Math.min(seconds, time + fall), 0],
      ]),
      "even",
    );
  }

  /** One text after another in the same place: `first` until the first
      change, then each [seconds, text] from its time on. `write` draws a
      text where it goes. The still picture shows `first`. */
  function changing(
    first: string,
    changes: Array<[seconds: number, text: string]>,
    write: (text: string) => Shape,
  ): Shape {
    const texts: Array<[seconds: number, text: string]> = [[0, first], ...changes];
    return group(
      {},
      ...texts.map(([from, text], i) => {
        const isFirst = i === 0;
        const until = texts[i + 1]?.[0];
        const frames: Frame[] = [[0, isFirst ? 1 : 0]];
        if (!isFirst) frames.push([from, 1]);
        if (until !== undefined) frames.push([until, 0]);
        const written = write(text);
        const resting = { ...written, attributes: { ...written.attributes, opacity: isFirst ? undefined : 0 } };
        const one = moving(resting, track("opacity", frames, "steps"));
        return isFirst ? one : onlyWhenMoving(one);
      }),
    );
  }

  return { seconds, track, shown, draw, transform, along, traveller, ripple, flash, changing };
}

/** The easing every smooth move has, and none. */
const EASE = "0.4 0 0.2 1";
const LINEAR = "0 0 1 1";

// ---- A finished picture --------------------------------------------------------

/** A picture: its size in its own units (the `width` and `height` an
    `image` in the config gives), and its shapes, back to front. */
export type Drawing = { width: number; height: number; shapes: Shape[] };

/** The tags that are motion: the still picture leaves them out. */
const MOTION_TAGS = new Set(["animate", "animateTransform", "animateMotion", "set"]);

/** The picture as an SVG file's text: as it moves, or still. */
export function svgOf({ width, height, shapes }: Drawing, how: "moving" | "still"): string {
  const write = (one: Shape | string): string => {
    if (typeof one === "string") return escaped(one);
    if (how === "still" && (one.onlyWhenMoving || MOTION_TAGS.has(one.tag))) return "";
    const attributes = Object.entries(one.attributes)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => ` ${name}="${escaped(typeof value === "number" ? number(value) : String(value))}"`)
      .join("");
    const inside = one.children.map(write).join("");
    return inside === "" ? `<${one.tag}${attributes}/>` : `<${one.tag}${attributes}>${inside}</${one.tag}>`;
  };
  const root = shape(
    "svg",
    { xmlns: "http://www.w3.org/2000/svg", viewBox: `0 0 ${width} ${height}`, width, height, "font-family": FONT.sans },
    shape("rect", { width, height, fill: COLOR.ground }),
    ...shapes,
  );
  // A line for each of the picture's top shapes, so a change reads in a diff.
  return `${write({ ...root, children: [] }).replace("/>", ">")}\n${root.children.map(write).filter(Boolean).join("\n")}\n</svg>\n`;
}

/** A number as a file writes it: rounded, without a trailing ".0". */
function number(value: number, places = 2): string {
  return String(Number(value.toFixed(places)));
}

function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
