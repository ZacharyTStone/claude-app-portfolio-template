import { arc } from "../paths.ts";
import type { Point } from "../places.ts";
import { group, moving, placed } from "../shapes.ts";
import type { Shape } from "../svg.ts";
import type { Lines } from "./lines.ts";
import type { Staying } from "./staying.ts";
import type { Values } from "./values.ts";

/** How a shape comes into a story's loop. It then stays until the loop clears, and rests in its place in the
    still picture. */
export type Arriving = {
  /** A shape drawn around (0, 0), put at `at`, that pops into being at `when`: from nothing to a little more
      than its size, and back. */
  popping(what: Shape, at: Point, when: number): Shape;
  /** A shape that comes at `when` by rising `by` into its place. */
  rising(what: Shape, when: number, by?: number): Shape;
  /** A shape drawn around (0, 0) that rests at `to`, having glided there from `from` between `moves.from` and
      `moves.to` (seconds), along a slight curve (`lift`, as `arc` has it). It comes at `moves.comes`, or as it
      sets off. */
  gliding(
    what: Shape,
    from: Point,
    to: Point,
    moves: { comes?: number; from: number; to: number },
    lift?: number,
  ): Shape;
};

/** Popping in: how long a shape takes to swell past its size, how far past, when it has settled, and how fast
    it fades in as it starts. */
const POP = { swells: 0.24, to: 1.16, settles: 0.42, fade: 0.12 } as const;
const RISE_SECONDS = 0.45;
const ORIGIN = { x: 0, y: 0 };

export function arrivingOver({ transform, along, since }: Pick<Values, "transform"> & Lines & Staying): Arriving {
  const popping: Arriving["popping"] = (what, at, when) => {
    const swelling = transform("scale", [
      [when, 0],
      [when + POP.swells, POP.to],
      [when + POP.settles, 1],
    ]);
    return placed(at, moving(group({}, what), swelling, since(when, POP.fade)));
  };

  const rising: Arriving["rising"] = (what, when, by = 16) => {
    const settling = transform("translate", [
      [when, `0 ${by}`],
      [when + RISE_SECONDS, "0 0"],
    ]);
    return moving(group({}, what), settling, since(when));
  };

  // eslint-disable-next-line max-params -- The kit's public call, which every site's diagrams make: the shape, from where, to where, when, and how curved.
  const gliding: Arriving["gliding"] = (what, from, to, moves, lift = 0.12) => {
    // The path is written from where it ends, so that the shape rests there when nothing moves it: in the still.
    const path = arc({ x: from.x - to.x, y: from.y - to.y }, ORIGIN, lift);
    return placed(to, moving(group({}, what), along(path, moves.from, moves.to), since(moves.comes ?? moves.from)));
  };

  return { popping, rising, gliding };
}
