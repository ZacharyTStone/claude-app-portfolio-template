import type { Shape } from "../svg.ts";
import type { Values } from "./values.ts";

/** A story's loop: a picture that follows one thing builds its scene up as the loop goes, so that it ends as
    its still. Then the loop clears: what it built up fades together, and what has to go back to how it started
    does it while out of sight. Each of these is opacity for a shape that rests shown, as the still has it. */
export type Staying = {
  /** When the loop clears, in seconds: what a story built up fades from `from`, and is gone by `to`. */
  clears: { from: number; to: number };
  /** For what comes at `at` and stays until the loop clears. */
  since: (at: number, fade?: number) => Shape;
  /** For what the loop starts with and changes (a queue in its first order, a count): it comes as the loop
      starts, as fast as the loop clears, and goes when it does. */
  fromTheStart: () => Shape;
  /** For what something else brings in (a line that draws itself, text typed a letter at a time): there until
      the loop clears. */
  untilClear: () => Shape;
};

/** When a loop clears, if it isn't told: it starts this long before the loop ends, and takes this long. */
const CLEARS = { before: 0.9, takes: 0.45 } as const;

export function stayingOver(
  { seconds, track }: Pick<Values, "seconds" | "track">,
  asked?: { from: number; to: number },
): Staying {
  const clears = clearingOf(seconds, asked);

  const since: Staying["since"] = (at, fade = 0.3) => {
    if (at > clears.from)
      throw new Error(`What comes at ${at} s comes after the loop has started to clear, at ${clears.from} s`);
    return track("opacity", [
      [at, 0],
      // What comes last is there, at the latest, as the loop starts to clear.
      [Math.min(at + fade, clears.from), 1],
      [clears.from, 1],
      [clears.to, 0],
    ]);
  };

  const fromTheStart: Staying["fromTheStart"] = () => since(0, clears.to - clears.from);

  const untilClear: Staying["untilClear"] = () =>
    track("opacity", [
      [clears.from, 1],
      [clears.to, 0],
    ]);

  return { clears, since, fromTheStart, untilClear };
}

function clearingOf(seconds: number, asked?: { from: number; to: number }): { from: number; to: number } {
  const from = asked?.from ?? Math.max(0, seconds - CLEARS.before);
  const to = asked?.to ?? Math.min(seconds, from + CLEARS.takes);
  if (from < 0 || to < from || to > seconds)
    throw new Error(`A loop of ${seconds} s can't clear from ${from} s to ${to} s: that's outside it`);
  return { from, to };
}
