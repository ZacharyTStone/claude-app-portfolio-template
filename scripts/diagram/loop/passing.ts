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
  carried: (
    what: Shape | Shape[],
    d: string,
    from: number,
    to: number,
    look?: { back?: boolean; pace?: "smooth" | "even"; fade?: number; fadesBefore?: number },
  ) => Shape;
  /** A dot that travels a path between `from` and `to`, with a soft glow. */
  traveller: (d: string, from: number, to: number, look?: { color?: string; radius?: number; back?: boolean }) => Shape;
};

const ORIGIN = { x: 0, y: 0 };
/** A traveller's glow: how many times its radius, how faint, and how fast the traveller comes and goes. */
const TRAVELLER = { glowReach: 2.2, glowOpacity: 0.22, fade: 0.12 } as const;

export function passingOver({ seconds, track, along }: Pick<Values, "seconds" | "track"> & Lines): Passing {
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
    return carried([glow, dot(ORIGIN, radius, { fill: color })], d, from, to, { back, fade: TRAVELLER.fade });
  };

  return { carried, traveller };
}
