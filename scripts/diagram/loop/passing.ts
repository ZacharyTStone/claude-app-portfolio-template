import { COLOR } from "../palette.ts";
import { dot, group, moving, onlyWhenMoving } from "../shapes.ts";
import type { Shape } from "../svg.ts";
import type { Lines } from "./lines.ts";
import { justBefore, type Values } from "./values.ts";

/** What passes along a path, and is there only while it does: the still picture leaves it out. */
export type Passing = {
  /** A shape, or several, carried along a path between `from` and `to`: a file on its way, a page, a question.
      Draw it around (0, 0). `back` and `pace` are `along`'s. It comes and goes over `fade` seconds, and starts
      to go `fadesBefore` it arrives. */
  carried(
    what: Shape | Shape[],
    d: string,
    from: number,
    to: number,
    look?: { back?: boolean; pace?: "smooth" | "even"; fade?: number; fadesBefore?: number },
  ): Shape;
  /** A dot that travels a path between `from` and `to`, with a soft glow, and a trail of smaller, fainter dots
      that follow it along the path, each a moment behind. */
  traveller(d: string, from: number, to: number, look?: { color?: string; radius?: number; back?: boolean }): Shape;
};

const ORIGIN = { x: 0, y: 0 };
/** A traveller's glow: how many times its radius, how faint, and how fast the traveller comes and goes. */
const TRAVELLER = { glowReach: 2.2, glowOpacity: 0.22, fade: 0.12 } as const;
/** A traveller's trail: each dot's lag behind it (seconds), and its size and opacity, as parts of the
    traveller's. A dot that would still be travelling as the loop ends is left out. */
const TRAIL = [
  { lag: 0.05, size: 0.8, opacity: 0.5 },
  { lag: 0.1, size: 0.62, opacity: 0.3 },
  { lag: 0.15, size: 0.45, opacity: 0.15 },
] as const;

export function passingOver({ seconds, track, along }: Pick<Values, "seconds" | "track"> & Lines): Passing {
  // eslint-disable-next-line max-params -- The kit's public call, which every site's diagrams make: the shapes, the path, from, to, and how.
  const carried: Passing["carried"] = (what, d, from, to, look = {}) => {
    const { back = false, pace = "smooth", fade = 0.15, fadesBefore = 0.05 } = look;
    const whileCarried = track(
      "opacity",
      [
        [justBefore(from), 0],
        [from + fade, 1],
        [to - fadesBefore, 1],
        [Math.min(seconds, to + fade), 0],
      ],
      "even",
    );
    return onlyWhenMoving(
      moving(group({ opacity: 0 }, ...[what].flat()), whileCarried, along(d, from, to, { back, pace })),
    );
  };

  const traveller: Passing["traveller"] = (d, from, to, look = {}) => {
    const { color = COLOR.accentBright, radius = 10, back = false } = look;
    const glow = dot(ORIGIN, radius * TRAVELLER.glowReach, { fill: color, opacity: TRAVELLER.glowOpacity });
    const trail = TRAIL.filter(({ lag }) => to + lag + TRAVELLER.fade <= seconds).map(({ lag, size, opacity }) =>
      carried(dot(ORIGIN, radius * size, { fill: color, opacity }), d, from + lag, to + lag, {
        back,
        fade: TRAVELLER.fade,
      }),
    );
    const traveller = carried([glow, dot(ORIGIN, radius, { fill: color })], d, from, to, {
      back,
      fade: TRAVELLER.fade,
    });
    // The faintest is drawn first, so each dot is over the one behind it.
    return onlyWhenMoving(group({}, ...trail.reverse(), traveller));
  };

  return { carried, traveller };
}
