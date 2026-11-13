import { arrivingOver, type Arriving } from "./loop/arriving.ts";
import { linesOver, type Lines } from "./loop/lines.ts";
import { momentsOver, type Moments } from "./loop/moments.ts";
import { passingOver, type Passing } from "./loop/passing.ts";
import { stayingOver, type Staying } from "./loop/staying.ts";
import { valuesOver, type Values } from "./loop/values.ts";

/** The motion of one loop: every method returns a shape to put inside the one it moves (`moving(target, …)`),
    or a finished shape of its own. */
export type Loop = Values & Lines & Passing & Moments & Staying & Arriving;

/** The motion for a picture that repeats every `seconds`. A loop that tells a story clears between
    `clears.from` and `clears.to` (seconds), or just before it ends. */
export function loopOf(seconds: number, clears?: { from: number; to: number }): Loop {
  const values = valuesOver(seconds);
  const lines = linesOver(values);
  const staying = stayingOver(values, clears);
  return {
    ...values,
    ...lines,
    ...passingOver({ ...values, ...lines }),
    ...momentsOver(values),
    ...staying,
    ...arrivingOver({ ...values, ...lines, ...staying }),
  };
}
