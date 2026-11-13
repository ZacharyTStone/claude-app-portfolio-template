import type { Point } from "./places.ts";
import { rounded } from "./svg.ts";

/** A curve from one point to another that leaves and arrives level, as an arrow between two boxes side by side
    does. */
export function levelCurve(from: Point, to: Point): string {
  const middle = (from.x + to.x) / 2;
  return `M${rounded(from.x)} ${rounded(from.y)} C${rounded(middle)} ${rounded(from.y)} ${rounded(middle)} ${rounded(to.y)} ${rounded(to.x)} ${rounded(to.y)}`;
}

/** An arc from one point to another, lifted in the middle by `lift` times its length: the line a flight draws
    on a map. */
export function arc(from: Point, to: Point, lift = 0.22): string {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - length * lift };
  return `M${rounded(from.x)} ${rounded(from.y)} Q${rounded(middle.x)} ${rounded(middle.y)} ${rounded(to.x)} ${rounded(to.y)}`;
}
