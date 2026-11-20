import { COLOR } from "../palette.ts";
import { arc } from "../paths.ts";
import type { Point } from "../places.ts";
import { dot, group, moving, onlyWhenMoving, placed } from "../shapes.ts";
import { rounded, type Shape } from "../svg.ts";
import type { Lines } from "./lines.ts";
import type { Staying } from "./staying.ts";
import type { Values } from "./values.ts";

/** How a shape comes into a story's loop. It then stays until the loop clears, and rests in its place in the
    still picture. */
export type Arriving = {
  /** A shape drawn around (0, 0), put at `at`, that pops into being at `when`: from nothing to a little more
      than its size, a little under it, and its size, as a spring settles. A small one of the accent's colour
      (a tick's disc, a marker) throws a ring of sparks as it lands, which fly out and fade. */
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

/** Popping in: how long a shape takes to swell past its size and how far past, when it has dipped under its
    size and how far under, when it has settled, and how fast it fades in as it starts. */
const POP = { swells: 0.24, to: 1.18, dips: 0.34, under: 0.95, settles: 0.5, fade: 0.12 } as const;
/** The sparks: how many, how far past the pop's edge they start and fly, how big, how soon after the pop starts
    they set off, how long they last and how soon they're brightest (seconds). A pop throws them only if nothing
    in it is wider than `upTo`. */
const SPARKS = { count: 6, starts: 4, reach: 34, radius: 4.5, after: 0.14, lasts: 0.55, brightest: 0.08, upTo: 64 };
/** What the sparks come from: a shape filled with the accent. */
const ACCENTS = new Set<string>([COLOR.accent, COLOR.accentBright]);
const RISE_SECONDS = 0.45;
const ORIGIN = { x: 0, y: 0 };

export function arrivingOver({
  seconds,
  track,
  transform,
  along,
  since,
}: Pick<Values, "seconds" | "track" | "transform"> & Lines & Staying): Arriving {
  /** The sparks a pop of `what` at `when` throws, or none: it's too big, or not the accent's, or the loop would
      end before they'd gone. */
  const sparksOf = (what: Shape, when: number): Shape[] => {
    const from = when + SPARKS.after;
    if (widest(what) > SPARKS.upTo || !hasAccent(what) || from + SPARKS.lasts > seconds) return [];
    const edge = widest(what) / 2 + SPARKS.starts;
    const turn = (2 * Math.PI) / SPARKS.count;
    return Array.from({ length: SPARKS.count }, (_, i) => {
      const along = (distance: number) => pointAt(turn * (i + 0.5), distance);
      const flying = transform("translate", [
        [from, along(edge)],
        [from + SPARKS.lasts, along(edge + SPARKS.reach)],
      ]);
      const glinting = track("opacity", [
        [from, 0],
        [from + SPARKS.brightest, 1],
        [from + SPARKS.lasts, 0],
      ]);
      return onlyWhenMoving(
        moving(dot(ORIGIN, SPARKS.radius, { fill: COLOR.accentBright, opacity: 0 }), flying, glinting),
      );
    });
  };
  const popping: Arriving["popping"] = (what, at, when) => {
    const swelling = transform("scale", [
      [when, 0],
      [when + POP.swells, POP.to],
      [when + POP.dips, POP.under],
      [when + POP.settles, 1],
    ]);
    return placed(at, moving(group({}, what), swelling, since(when, POP.fade)), ...sparksOf(what, when));
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

/** How wide the widest thing in a shape is: a circle across, a box's width. */
function widest(what: Shape): number {
  const own = what.tag === "circle" ? Number(what.attributes.r) * 2 : Number(what.attributes.width ?? 0);
  const inside = what.children.filter((child): child is Shape => typeof child !== "string").map(widest);
  return Math.max(own, ...inside);
}

/** Whether a shape, or anything in it, is filled with the accent: what the picture is about. */
function hasAccent(what: Shape): boolean {
  if (ACCENTS.has(String(what.attributes.fill))) return true;
  return what.children.some((child) => typeof child !== "string" && hasAccent(child));
}

/** The point `distance` from (0, 0) at `angle` (radians), as a translate writes it: "12 -5". */
const pointAt = (angle: number, distance: number): string =>
  `${rounded(Math.cos(angle) * distance)} ${rounded(Math.sin(angle) * distance)}`;
