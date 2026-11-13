import { COLOR } from "../palette.ts";
import type { Place, Point } from "../places.ts";
import { box, moving, onlyWhenMoving, restingAt } from "../shapes.ts";
import { shape, type Shape } from "../svg.ts";
import { justBefore, type Frame, type Values } from "./values.ts";

/** What marks a moment, at each of `times` (seconds into the loop), and fades. */
export type Moments = {
  /** A ring that spreads from a point and fades: something happened here. One ring can't start again before it
      has gone: give each of two that overlap a ripple of its own. */
  ripple: (at: Point, times: number[], look?: { color?: string; reach?: number }) => Shape;
  /** Opacity that jumps to `peak` and falls away over `fall` seconds: a flash on whatever it's put on (resting
      at 0). With no times, it never flashes. */
  flash: (times: number[], look?: { peak?: number; fall?: number }) => Shape;
  /** A light that comes on over something and falls away, there only while the picture moves. `overlay` is the
      lit look, drawn over what it lights; `look` is `flash`'s. */
  light: (overlay: Shape, times: number[], look?: { peak?: number; fall?: number }) => Shape;
  /** The edge of a box lighting as something arrives, and fading over `fall` seconds. `radius` is the box's. */
  edgeLight: (at: Place, times: number[], look?: { radius?: number; fall?: number }) => Shape;
};

/** A ripple's ring: how big it starts, how thick and how bright, and how long it takes to go. */
const RIPPLE = { startsAt: 6, lineWidth: 3, peak: 0.9, lasts: 0.9 } as const;
/** How long a flash takes to reach its peak. */
const FLASH_RISES = 0.08;
/** A box's edge, lit. */
const EDGE = { lineWidth: 9, peak: 0.9 } as const;

export function momentsOver({ seconds, track }: Pick<Values, "seconds" | "track">): Moments {
  const ripple: Moments["ripple"] = (at, times, look = {}) => {
    const { color = COLOR.accent, reach = 46 } = look;
    const ring = ringAt(at, color);
    if (times.length === 0) return ring;
    const rings = { seconds, times, lasts: RIPPLE.lasts };
    refuseOverlap(rings, "ripple", "give each a ripple of its own");
    return moving(
      ring,
      track("r", spreading(rings, reach), "even"),
      track("opacity", flashing(rings, { peak: RIPPLE.peak }), "even"),
    );
  };

  const flash: Moments["flash"] = (times, look = {}) => {
    const { peak = 1, fall = 0.7 } = look;
    if (times.length === 0) return track("opacity", [[0, 0]], "even");
    const flashes = { seconds, times, lasts: fall };
    refuseOverlap(flashes, "flash", "give it a shorter `fall`, or each a shape of its own");
    return track("opacity", flashing(flashes, { peak, rises: FLASH_RISES }), "even");
  };

  const light: Moments["light"] = (overlay, times, look = {}) =>
    onlyWhenMoving(moving(restingAt(overlay, 0), flash(times, look)));

  const edgeLight: Moments["edgeLight"] = (at, times, look = {}) => {
    const { radius, fall = 0.9 } = look;
    const litEdge = box(at, { radius, fill: "none", line: COLOR.accentBright, lineWidth: EDGE.lineWidth });
    return light(litEdge, times, { peak: EDGE.peak, fall });
  };

  return { ripple, flash, light, edgeLight };
}

/** What happens at each of `times` in a loop of `seconds`, and is over `lasts` seconds later. */
type Pulses = { seconds: number; times: number[]; lasts: number };

const overAt = ({ seconds, lasts }: Pulses, time: number): number => Math.min(seconds, time + lasts);

/** One shape can't show two at once: a flash or a ripple can't start again before it's over. */
function refuseOverlap(pulses: Pulses, what: string, instead: string): void {
  pulses.times.forEach((time, i) => {
    const next = pulses.times[i + 1];
    if (next !== undefined && justBefore(next) < overAt(pulses, time))
      throw new Error(
        `The ${what} at ${next} s starts before the one at ${time} s is over (it lasts ${pulses.lasts} s): ${instead}`,
      );
  });
}

/** Opacity that jumps to `peak` at each time, `rises` seconds after it if it takes any, and is gone when it's over. */
function flashing(pulses: Pulses, { peak, rises = 0 }: { peak: number; rises?: number }): Frame[] {
  return pulses.times.flatMap((time): Frame[] => [
    [justBefore(time), 0],
    [time + rises, peak],
    [overAt(pulses, time), 0],
  ]);
}

/** A ring's radius, growing to `reach` from each time until it's over. */
function spreading(rings: Pulses, reach: number): Frame[] {
  return rings.times.flatMap((time): Frame[] => [
    [time, RIPPLE.startsAt],
    [overAt(rings, time), reach],
  ]);
}

function ringAt(at: Point, color: string): Shape {
  return onlyWhenMoving(
    shape("circle", {
      cx: at.x,
      cy: at.y,
      r: RIPPLE.startsAt,
      fill: "none",
      stroke: color,
      "stroke-width": RIPPLE.lineWidth,
      opacity: 0,
    }),
  );
}
