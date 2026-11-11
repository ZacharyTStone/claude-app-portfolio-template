/* Reading values whose shape isn't known yet (a model's reply, a request's
   JSON) one step at a time. The checks themselves are in
   src/shared/guards.ts. */
import { isRecord } from "../../shared/guards.ts";

/** The value at `path` (`get(reply, "choices", 0)` is `reply.choices[0]`),
    or undefined where a step isn't there. Only a value's own properties
    count, so nothing comes from a prototype. */
export function get(value: unknown, ...path: (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current) || !Object.hasOwn(current, key)) return undefined;
    current = current[key];
  }
  return current;
}

/** The value if it's an array, else an empty one. */
export const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The number a setting or a query says, if it's one above 0 (and not
    Infinity); else null. */
export function positiveNumber(text: string | null | undefined): number | null {
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}
