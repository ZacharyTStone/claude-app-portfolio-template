/* Reading values whose shape isn't known yet, one step at a time: a model's
   reply comes in one of several shapes, and each part of it is taken only
   if it's there. (A value with one known shape, like a request's body or
   /ask.json, is checked whole against a valibot schema instead.) */
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
export const arrayOrEmpty = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The number a setting or a query says, if it's one above 0 (and not
    Infinity); else null. */
export function positiveNumber(text: string | null | undefined): number | null {
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : null;
}
