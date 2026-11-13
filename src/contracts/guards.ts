/* Checks for values whose shape isn't known yet (JSON from a request or a
   reply, what's in storage, the page's own data, a model's output), shared
   by the browser code and the Worker. */

/** A check that narrows `unknown` to a type. */
export type Guard<T> = (value: unknown) => value is T;

/** An object (or array): something whose properties can be read. */
export const isRecord: Guard<Record<string, unknown>> = (value): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** A string. */
export const isString: Guard<string> = (value): value is string => typeof value === "string";

/** Absent, or a string. */
export const isOptionalString: Guard<string | undefined> = (value): value is string | undefined =>
  value === undefined || isString(value);

/** Absent, or true or false. */
export const isOptionalBoolean: Guard<boolean | undefined> = (value): value is boolean | undefined =>
  value === undefined || typeof value === "boolean";

/** A whole number, 0 or more. */
export const isCount: Guard<number> = (value): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/** An array, every item of which passes `check`. */
export const isArrayOf = <T>(value: unknown, check: Guard<T>): value is T[] =>
  Array.isArray(value) && value.every(check);
