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

   In three parts: shapes, and where they go; motion over a loop
   (`loopOf`); and, among a loop's motion, a story's loop: what comes at a
   moment and stays until the loop clears, for a picture that follows one
   thing from its start to its end and then starts again.

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

/** A rectangle in the picture: its top left corner and its size. */
export type Place = Point & { width: number; height: number };

/** A rectangle's middle. */
export const centreOf = (place: Place): Point => ({ x: place.x + place.width / 2, y: place.y + place.height / 2 });

/** How far across the picture a rectangle's right edge is. */
export const rightOf = (place: Place): number => place.x + place.width;

/** A rectangle of a size around (0, 0), for a shape that's scaled, turned
    or carried about its own middle (`placed` puts it where it goes). */
export const aroundOrigin = (width: number, height: number): Place => ({
  x: -width / 2,
  y: -height / 2,
  width,
  height,
});

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

/** Shapes drawn around (0, 0), put at a point. What's scaled or turned
    is scaled or turned about (0, 0): draw it there, and place it. */
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

/** A rounded box. */
export function box(
  at: Place,
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

/** A bar that stands for words: writing too small to read, or that
    doesn't matter. It's rounded at both ends, and `at` is its top left. */
export function bar(
  at: Point & { width: number },
  look: { height?: number; color?: string; opacity?: number } = {},
): Shape {
  const { height = 22, color = COLOR.mark, opacity } = look;
  return box({ ...at, height }, { radius: height / 2, fill: color, line: "none", opacity });
}

/** A line of text. `at` is where its baseline starts, ends or is centred,
    by `anchor` (`baselineAround` finds the baseline for a height). */
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

/** How long an arrowhead is, from its tip back: an arrow's line stops
    that far short of where its head points. */
export const ARROWHEAD_LENGTH = 16;
/** How far each side of its line an arrowhead's base reaches. */
const ARROWHEAD_HALF_WIDTH = 9.92;

/** An arrowhead whose tip is at `tip`, pointing along `degrees` (0 is to
    the right, 90 is down). */
export function arrowhead(tip: Point, degrees: number, color: string = COLOR.accent): Shape {
  return shape("path", {
    d: `M0 0 L-${ARROWHEAD_LENGTH} -${ARROWHEAD_HALF_WIDTH} L-${ARROWHEAD_LENGTH} ${ARROWHEAD_HALF_WIDTH}Z`,
    fill: color,
    stroke: color,
    "stroke-width": 4,
    "stroke-linejoin": "round",
    transform: `translate(${rounded(tip.x)} ${rounded(tip.y)}) rotate(${rounded(degrees)})`,
  });
}

/** A curve from one point to another that leaves and arrives level, as an
    arrow between two boxes side by side does. */
export function levelCurve(from: Point, to: Point): string {
  const middle = (from.x + to.x) / 2;
  return `M${rounded(from.x)} ${rounded(from.y)} C${rounded(middle)} ${rounded(from.y)} ${rounded(middle)} ${rounded(to.y)} ${rounded(to.x)} ${rounded(to.y)}`;
}

/** An arc from one point to another, lifted in the middle by `lift` times
    its length: the line a flight draws on a map. */
export function arc(from: Point, to: Point, lift = 0.22): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - length * lift };
  return `M${rounded(from.x)} ${rounded(from.y)} Q${rounded(middle.x)} ${rounded(middle.y)} ${rounded(to.x)} ${rounded(to.y)}`;
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

/** How much wider than regular text semibold and bold text is drawn. */
const BOLD_IS_WIDER = 1.07;
/** The `weight` a text counts as bold from. */
const BOLD_FROM = 600;

/** About how wide a line of text is drawn, to size a box around it. The
    picture is drawn in whatever font the visitor's computer has, so leave
    room: this is an estimate for Inter (a little more at a `weight` of 600
    or over), and a full square for kana and kanji. */
export function textWidth(text: string, size: number, mono = false, weight = 400): number {
  const widthOf = (character: string) => {
    if (/[^\u0000-ɏ -⁯]/.test(character)) return 1;
    if (mono) return 0.6;
    if (character === " ") return 0.28;
    if (/[ilj.,:;'’|!]/.test(character)) return 0.27;
    if (/[mwMW]/.test(character)) return 0.85;
    if (/[A-Z0-9]/.test(character)) return 0.66;
    return 0.55;
  };
  // A monospaced font's bold letters are as wide as its regular ones.
  const wider = !mono && weight >= BOLD_FROM ? BOLD_IS_WIDER : 1;
  return [...text].reduce((width, character) => width + widthOf(character), 0) * size * wider;
}

/** The size a text is written at to fit a width: `size`, or as much
    smaller as it takes. `look` is the `mono` and `weight` its label has. */
export function sizeToFit(
  text: string,
  width: number,
  size: number,
  look: { mono?: boolean; weight?: number } = {},
): number {
  return Math.min(size, Math.floor((size * width) / textWidth(text, size, look.mono, look.weight)));
}

/** How far below its middle a line of text's baseline is, in sizes. */
const BASELINE_BELOW_MIDDLE = 0.35;

/** The baseline that centres a line of text of `size` on the height `y`. */
export const baselineAround = (y: number, size: number): number => y + size * BASELINE_BELOW_MIDDLE;

// ---- Motion --------------------------------------------------------------------

/** A value at a time: [seconds into the loop, the value then]. */
export type Frame = [seconds: number, value: number | string];

/** How a value gets from one frame to the next: eased ("smooth"), at an
    even pace ("even"), or all at once when the frame comes ("steps"). */
export type Pace = "smooth" | "even" | "steps";

/** The motion of one loop: every method returns a shape to put inside the
    one it moves (`moving(target, …)`), or a finished shape of its own. */
export type Loop = ReturnType<typeof loopOf>;

/** When a loop clears, if it isn't told: it starts this long before the
    loop ends, and takes this long. What's left of the loop is its start. */
const CLEARS = { before: 0.9, takes: 0.45 } as const;

/** The motion for a picture that repeats every `seconds`. A loop that
    tells a story clears between `clears.from` and `clears.to` (seconds):
    see "A story's loop", below. */
export function loopOf(seconds: number, clears?: { from: number; to: number }) {
  const timing = { dur: `${rounded(seconds)}s`, repeatCount: "indefinite" };
  const clearsFrom = clears?.from ?? Math.max(0, seconds - CLEARS.before);
  const clearsTo = clears?.to ?? Math.min(seconds, clearsFrom + CLEARS.takes);
  if (clearsFrom < 0 || clearsTo < clearsFrom || clearsTo > seconds)
    throw new Error(`A loop of ${seconds} s can't clear from ${clearsFrom} s to ${clearsTo} s: that's outside it`);

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
      values: whole.map(([, value]) => (typeof value === "number" ? rounded(value) : value)).join(";"),
      keyTimes: whole.map(([at]) => rounded(at / seconds, 4)).join(";"),
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
      shape's own (0, 0): draw it around there, in a group moved into place
      (`placed`). */
  function transform(kind: "scale" | "translate" | "rotate", frames: Frame[], pace: Pace = "smooth"): Shape {
    return shape("animateTransform", { attributeName: "transform", type: kind, ...timing, ...keyed(frames, pace) });
  }

  /** Movement along a path between `from` and `to`: at the path's start
      before, at its end after. `back` goes from the end to the start. It
      sets off and arrives gently, or keeps one speed ("even"): for a long
      way with something to pass on it, since it has then covered a third of
      the way a third of the way through. */
  function along(d: string, from: number, to: number, back = false, pace: "smooth" | "even" = "smooth"): Shape {
    const [start, end] = back ? [1, 0] : [0, 1];
    return shape("animateMotion", {
      path: d,
      ...timing,
      calcMode: pace === "smooth" ? "spline" : "linear",
      keyPoints: `${start};${start};${end};${end}`,
      keyTimes: `0;${rounded(from / seconds, 4)};${rounded(to / seconds, 4)};1`,
      keySplines: pace === "smooth" ? `${LINEAR};${EASE};${LINEAR}` : undefined,
    });
  }

  /** A shape, or several, carried along a path between `from` and `to`, and
      there only while it's carried: a file on its way, a page, a question.
      Draw it around (0, 0). `back` and `pace` are `along`'s. It comes and
      goes over `fade` seconds, and starts to go `fadesBefore` it arrives. */
  function carried(
    what: Shape | Shape[],
    d: string,
    from: number,
    to: number,
    look: { back?: boolean; pace?: "smooth" | "even"; fade?: number; fadesBefore?: number } = {},
  ): Shape {
    const { back = false, pace = "smooth", fade = 0.15, fadesBefore = 0.05 } = look;
    return onlyWhenMoving(
      moving(
        group({ opacity: 0 }, ...[what].flat()),
        track(
          "opacity",
          [
            [Math.max(0, from - 0.001), 0],
            [from + fade, 1],
            [to - fadesBefore, 1],
            [Math.min(seconds, to + fade), 0],
          ],
          "even",
        ),
        along(d, from, to, back, pace),
      ),
    );
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
    const glow = dot({ x: 0, y: 0 }, radius * 2.2, { fill: color, opacity: 0.22 });
    return carried([glow, dot({ x: 0, y: 0 }, radius, { fill: color })], d, from, to, { back, fade: 0.12 });
  }

  /** Refuses times too close together for one shape to show them all: a
      flash or a ripple can't start again before it's over. */
  function eachAfterTheLast(what: string, times: number[], lasts: number, instead: string): void {
    times.forEach((time, i) => {
      const next = times[i + 1];
      if (next !== undefined && Math.max(0, next - 0.001) < Math.min(seconds, time + lasts))
        throw new Error(
          `The ${what} at ${next} s starts before the one at ${time} s is over (it lasts ${lasts} s): ${instead}`,
        );
    });
  }

  /** A ring that spreads from a point and fades, starting at each of
      `times`: something happened here. One ring can't start again before
      it has gone: give each of two that overlap a ripple of its own. */
  function ripple(at: Point, times: number[], look: { color?: string; reach?: number } = {}): Shape {
    const { color = COLOR.accent, reach = 46 } = look;
    const last = 0.9;
    const ring = onlyWhenMoving(
      shape("circle", { cx: at.x, cy: at.y, r: 6, fill: "none", stroke: color, "stroke-width": 3, opacity: 0 }),
    );
    if (times.length === 0) return ring;
    eachAfterTheLast("ripple", times, last, "give each a ripple of its own");
    return moving(
      ring,
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
    );
  }

  /** Opacity that jumps to `peak` at each of `times` and falls away over
      `fall` seconds: a flash on whatever it's put on (resting at 0). With
      no times, it never flashes. */
  function flash(times: number[], look: { peak?: number; fall?: number } = {}): Shape {
    const { peak = 1, fall = 0.7 } = look;
    if (times.length === 0) return track("opacity", [[0, 0]], "even");
    eachAfterTheLast("flash", times, fall, "give it a shorter `fall`, or each a shape of its own");
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

  /** A light that comes on over something at each of `times` and falls
      away, there only while the picture moves. `overlay` is the lit look,
      drawn over what it lights; `look` is `flash`'s. */
  function light(overlay: Shape, times: number[], look: { peak?: number; fall?: number } = {}): Shape {
    return onlyWhenMoving(
      moving({ ...overlay, attributes: { ...overlay.attributes, opacity: 0 } }, flash(times, look)),
    );
  }

  /** The edge of a box lighting at each of `times`, as something arrives,
      and fading over `fall` seconds. `radius` is the box's. */
  function edgeLight(at: Place, times: number[], look: { radius?: number; fall?: number } = {}): Shape {
    const { radius, fall = 0.9 } = look;
    return light(box(at, { radius, fill: "none", line: COLOR.accentBright, lineWidth: 9 }), times, { peak: 0.9, fall });
  }

  /** One text after another in the same place: `first` until the first
      change, then each [seconds, text] from its time on. `write` draws a
      text where it goes. The still picture shows `first`, or the last of
      them if the picture `rests` on that. */
  function changing(
    first: string,
    changes: Array<[seconds: number, text: string]>,
    write: (text: string) => Shape,
    rests: "first" | "last" = "first",
  ): Shape {
    const texts: Array<[seconds: number, text: string]> = [[0, first], ...changes];
    const atRest = rests === "first" ? 0 : texts.length - 1;
    return group(
      {},
      ...texts.map(([from, text], i) => {
        const isFirst = i === 0;
        const until = texts[i + 1]?.[0];
        const frames: Frame[] = [[0, isFirst ? 1 : 0]];
        if (!isFirst) frames.push([from, 1]);
        if (until !== undefined) frames.push([until, 0]);
        const written = write(text);
        const resting = { ...written, attributes: { ...written.attributes, opacity: i === atRest ? undefined : 0 } };
        const one = moving(resting, track("opacity", frames, "steps"));
        return i === atRest ? one : onlyWhenMoving(one);
      }),
    );
  }

  // ---- A story's loop ----------------------------------------------------------
  // A picture that follows one thing builds its scene up as the loop goes:
  // each thing comes at its moment and stays, so the picture ends as its
  // still. Then the loop clears: what it built up fades together (`clears`),
  // and what has to go back to how it started does it while out of sight.

  /** Opacity for what comes at `at` and stays until the loop clears. Put
      it on a shape that rests shown, as the still picture has it. */
  function since(at: number, fade = 0.3): Shape {
    if (at > clearsFrom)
      throw new Error(`What comes at ${at} s comes after the loop has started to clear, at ${clearsFrom} s`);
    return track("opacity", [
      [at, 0],
      // What comes last is there, at the latest, as the loop starts to clear.
      [Math.min(at + fade, clearsFrom), 1],
      [clearsFrom, 1],
      [clearsTo, 0],
    ]);
  }

  /** Opacity for what the loop starts with and changes (a queue in its
      first order, a count): it comes as the loop starts, as fast as the
      loop clears, and goes when it does. */
  function fromTheStart(): Shape {
    return since(0, clearsTo - clearsFrom);
  }

  /** Opacity for what something else brings in (a line that draws itself,
      text typed a letter at a time): there until the loop clears. */
  function untilClear(): Shape {
    return track("opacity", [
      [clearsFrom, 1],
      [clearsTo, 0],
    ]);
  }

  /** A shape drawn around (0, 0), put at `at`, that pops into being at
      `when`: from nothing to a little more than its size, and back. It
      stays until the loop clears. */
  function popping(what: Shape, at: Point, when: number): Shape {
    return placed(
      at,
      moving(
        group({}, what),
        transform("scale", [
          [when, 0],
          [when + POP.swells, POP.to],
          [when + POP.settles, 1],
        ]),
        since(when, POP.fade),
      ),
    );
  }

  /** A shape that comes at `when` by rising `by` into its place, and stays
      until the loop clears. */
  function rising(what: Shape, when: number, by = 16): Shape {
    return moving(
      group({}, what),
      transform("translate", [
        [when, `0 ${by}`],
        [when + RISE_SECONDS, "0 0"],
      ]),
      since(when),
    );
  }

  /** A shape drawn around (0, 0) that rests at `to`, having glided there
      from `from` between `moves.from` and `moves.to` (seconds), along a
      slight curve (`lift`, as `arc` has it). It comes at `moves.comes`, or
      as it sets off, and stays until the loop clears. */
  function gliding(
    what: Shape,
    from: Point,
    to: Point,
    moves: { comes?: number; from: number; to: number },
    lift = 0.12,
  ): Shape {
    // The path is written from where it ends, so that the shape rests there
    // when nothing moves it: in the still picture.
    const path = arc({ x: from.x - to.x, y: from.y - to.y }, { x: 0, y: 0 }, lift);
    return placed(to, moving(group({}, what), along(path, moves.from, moves.to), since(moves.comes ?? moves.from)));
  }

  return {
    seconds,
    /** When the loop clears, in seconds: what a story built up fades from
        `from`, and is gone by `to`. */
    clears: { from: clearsFrom, to: clearsTo },
    track,
    shown,
    draw,
    transform,
    along,
    carried,
    traveller,
    ripple,
    flash,
    light,
    edgeLight,
    changing,
    since,
    fromTheStart,
    untilClear,
    popping,
    rising,
    gliding,
  };
}

/** The easing every smooth move has, as SVG's `keySplines` writes a cubic
    Bézier curve; and none. */
export const EASE = "0.4 0 0.2 1";
const LINEAR = "0 0 1 1";

/** Popping in: how long a shape takes to swell past its size, how far
    past, when it has settled, and how fast it fades in as it starts. */
const POP = { swells: 0.24, to: 1.16, settles: 0.42, fade: 0.12 } as const;
/** How long rising into place takes. */
const RISE_SECONDS = 0.45;

// ---- A finished picture --------------------------------------------------------

/** A picture: its size in its own units (the `width` and `height` an
    `image` in the config gives), and its shapes, back to front.

    With `plays`, it's a picture a visitor plays: the page shows it still,
    with a button, and once that's pressed shows it moving for that many
    seconds, then still again. So `plays` is the moment the moving picture
    looks as the still one does: for a story's loop, when it starts to
    clear (`loop.clears.from`). Without `plays` the page shows the picture
    moving all the time, which suits one where little moves (a marker
    that pulses). */
export type Drawing = { width: number; height: number; plays?: number; shapes: Shape[] };

/** Where a moving picture's file says how long it plays, on its <svg>:
    the page reads it there (src/site/pictures.ts, which has the same
    name, as this file imports nothing; tests/diagrams.test.ts holds the
    two together). */
export const PLAYS_ATTRIBUTE = "data-plays";

/** The tags that are motion: the still picture leaves them out. */
const MOTION_TAGS = new Set(["animate", "animateTransform", "animateMotion", "set"]);

/** The picture as an SVG file's text: as it moves, or still. */
export function svgOf({ width, height, plays, shapes }: Drawing, how: "moving" | "still"): string {
  const write = (one: Shape | string): string => {
    if (typeof one === "string") return escaped(one);
    if (how === "still" && (one.onlyWhenMoving || MOTION_TAGS.has(one.tag))) return "";
    const attributes = Object.entries(one.attributes)
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => ` ${name}="${escaped(typeof value === "number" ? rounded(value) : String(value))}"`)
      .join("");
    const inside = one.children.map(write).join("");
    return inside === "" ? `<${one.tag}${attributes}/>` : `<${one.tag}${attributes}>${inside}</${one.tag}>`;
  };
  const root = shape(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      "font-family": FONT.sans,
      [PLAYS_ATTRIBUTE]: how === "moving" ? plays : undefined,
    },
    shape("rect", { width, height, fill: COLOR.ground }),
    ...shapes,
  );
  // A line for each of the picture's top shapes, so a change reads in a diff.
  return `${write({ ...root, children: [] }).replace("/>", ">")}\n${root.children.map(write).filter(Boolean).join("\n")}\n</svg>\n`;
}

/** A number as a file writes it: rounded, without a trailing ".0". For a
    path or a transform a diagram writes out itself. */
export function rounded(value: number, places = 2): string {
  return String(Number(value.toFixed(places)));
}

function escaped(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
