import { rounded, shape, type Shape } from "../svg.ts";
import { EASE, lasting, LINEAR, type Values } from "./values.ts";

/** A line that draws itself, and movement along one. */
export type Lines = {
  /** A line drawn from its start to its end between `from` and `to`. */
  draw: (from: number, to: number) => Shape[];
  /** Movement along a path between `from` and `to`: at the path's start before, at its end after. `back` goes
      from the end to the start. It sets off and arrives gently, or keeps one speed ("even"): for a long way with
      something to pass on it, since it has then covered a third of the way a third of the way through. */
  along: (d: string, from: number, to: number, how?: { back?: boolean; pace?: "smooth" | "even" }) => Shape;
};

export function linesOver({ seconds, track }: Pick<Values, "seconds" | "track">): Lines {
  const draw: Lines["draw"] = (from, to) => [
    shape("set", { attributeName: "stroke-dasharray", to: "1" }),
    track("stroke-dashoffset", [
      [from, 1],
      [to, 0],
    ]),
  ];

  const along: Lines["along"] = (d, from, to, how = {}) => {
    const { back = false, pace = "smooth" } = how;
    const [start, end] = back ? [1, 0] : [0, 1];
    const isEased = pace === "smooth";
    return shape("animateMotion", {
      path: d,
      ...lasting(seconds),
      calcMode: isEased ? "spline" : "linear",
      keyPoints: `${start};${start};${end};${end}`,
      keyTimes: `0;${rounded(from / seconds, 4)};${rounded(to / seconds, 4)};1`,
      keySplines: isEased ? `${LINEAR};${EASE};${LINEAR}` : undefined,
    });
  };

  return { draw, along };
}
