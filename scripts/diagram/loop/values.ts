import { group, moving, onlyWhenMoving, restingAt } from "../shapes.ts";
import { rounded, shape, type Attributes, type Shape } from "../svg.ts";

/** A value at a time: [seconds into the loop, the value then]. */
export type Frame = [seconds: number, value: number | string];

/** How a value gets from one frame to the next: eased ("smooth"), at an even pace ("even"), or all at once
    when the frame comes ("steps"). */
export type Pace = "smooth" | "even" | "steps";

/** A value changing over the loop. Each is a shape to put inside the one it changes: `moving(target, …)`. */
export type Values = {
  /** How long the loop is: every motion in it lasts that long, and repeats for ever. */
  seconds: number;
  /** An attribute's values over the loop: `track("opacity", [[1, 0], [1.4, 1]])`. */
  track: (attribute: string, frames: Frame[], pace?: Pace) => Shape;
  /** A transform's values over the loop: `transform("scale", [[2, 0], [2.3, 1]])`,
      `transform("translate", [[0, "0 0"], [1, "0 -40"]])`. A scale is about the shape's own (0, 0): draw it
      around there, in a group moved into place (`placed`). */
  transform: (kind: "scale" | "translate" | "rotate", frames: Frame[], pace?: Pace) => Shape;
  /** Shown from `from` to `to` (seconds), fading in and out over `fade`. The shape it's on should rest at
      opacity 0, or at 1 if it belongs in the still picture. */
  shown: (from: number, to: number, fade?: number) => Shape;
  /** One text after another in the same place: `first` until the first change, then each [seconds, text] from
      its time on. `write` draws a text where it goes. The still picture shows `first`, or the last of them if
      the picture `rests` on that. */
  changing: (
    first: string,
    changes: Array<[seconds: number, text: string]>,
    write: (text: string) => Shape,
    rests?: "first" | "last",
  ) => Shape;
};

/** The easing every smooth move has, as SVG's `keySplines` writes a cubic Bézier curve; and none. */
export const EASE = "0.4 0 0.2 1";
export const LINEAR = "0 0 1 1";

const AN_INSTANT = 0.001;

/** The moment just before one. A value held until then changes at the moment, all at once, where a frame at
    the moment alone would have it ease there from the frame before. */
export const justBefore = (seconds: number): number => Math.max(0, seconds - AN_INSTANT);

/** What makes a motion last the whole loop, and repeat for ever. */
export const lasting = (seconds: number): Attributes => ({ dur: `${rounded(seconds)}s`, repeatCount: "indefinite" });

const CALC_MODE: Record<Pace, string | undefined> = { smooth: "spline", even: undefined, steps: "discrete" };

export function valuesOver(seconds: number): Values {
  const track: Values["track"] = (attribute, frames, pace = "smooth") =>
    shape("animate", { attributeName: attribute, ...lasting(seconds), ...keyed(seconds, frames, pace) });

  const transform: Values["transform"] = (kind, frames, pace = "smooth") =>
    shape("animateTransform", {
      attributeName: "transform",
      type: kind,
      ...lasting(seconds),
      ...keyed(seconds, frames, pace),
    });

  const shown: Values["shown"] = (from, to, fade = 0.3) =>
    track("opacity", [
      [justBefore(from), 0],
      [Math.min(seconds, from + fade), 1],
      [Math.max(from + fade, to - fade), 1],
      [Math.min(seconds, to), 0],
    ]);

  const changing: Values["changing"] = (first, changes, write, rests = "first") => {
    const turns = turnsOf(first, changes);
    const atRest = rests === "first" ? 0 : turns.length - 1;
    const texts = turns.map(({ text, frames }, i) => {
      const rested = restingAt(write(text), i === atRest ? undefined : 0);
      const taking = moving(rested, track("opacity", frames, "steps"));
      return i === atRest ? taking : onlyWhenMoving(taking);
    });
    return group({}, ...texts);
  };

  return { seconds, track, transform, shown, changing };
}

/** The frames as SVG's `values` and `keyTimes`. */
function keyed(seconds: number, frames: Frame[], pace: Pace): Attributes {
  const whole = heldForTheWholeLoop(seconds, frames, pace);
  return {
    values: whole.map(([, value]) => (typeof value === "number" ? rounded(value) : value)).join(";"),
    keyTimes: whole.map(([at]) => rounded(at / seconds, 4)).join(";"),
    calcMode: CALC_MODE[pace],
    keySplines:
      pace === "smooth"
        ? whole
            .slice(1)
            .map(() => EASE)
            .join(";")
        : undefined,
  };
}

/** The frames, with the first value held from the loop's start and the last to its end. */
function heldForTheWholeLoop(seconds: number, frames: Frame[], pace: Pace): Frame[] {
  const first = frames[0];
  const last = frames.at(-1);
  if (!first || !last) throw new Error("A track needs at least one frame");
  refuseFramesOutOfPlace(seconds, frames);
  const fromTheStart: Frame[] = first[0] > 0 ? [[0, first[1]]] : [];
  // A value that steps is held until the loop ends without being told to.
  const toTheEnd: Frame[] = pace !== "steps" && last[0] < seconds ? [[seconds, last[1]]] : [];
  return [...fromTheStart, ...frames, ...toTheEnd];
}

function refuseFramesOutOfPlace(seconds: number, frames: Frame[]): void {
  frames.forEach(([at], i) => {
    const before = frames[i - 1];
    if (at < 0 || at > seconds) throw new Error(`A frame at ${at} s is outside the loop's ${seconds} s`);
    if (before && at < before[0]) throw new Error(`The frame at ${at} s comes before the one it follows`);
  });
}

/** Each text with its opacity's frames: there from its moment until the next one's. */
function turnsOf(
  first: string,
  changes: Array<[seconds: number, text: string]>,
): Array<{ text: string; frames: Frame[] }> {
  const texts: Array<[seconds: number, text: string]> = [[0, first], ...changes];
  return texts.map(([from, text], i) => {
    const next = texts[i + 1];
    const comes: Frame[] =
      i === 0
        ? [[0, 1]]
        : [
            [0, 0],
            [from, 1],
          ];
    const goes: Frame[] = next ? [[next[0], 0]] : [];
    return { text, frames: [...comes, ...goes] };
  });
}
