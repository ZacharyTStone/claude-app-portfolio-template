/* Checks for values whose shape isn't known yet: JSON from a request or a
   reply, what's in storage, a model's output. */

export type Guard<T> = (value: unknown) => value is T;

/** An array passes too: anything whose properties can be read. */
export const isRecord: Guard<Record<string, unknown>> = (value): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isString: Guard<string> = (value): value is string => typeof value === "string";

export const isOptionalString: Guard<string | undefined> = (value): value is string | undefined =>
  value === undefined || isString(value);

export const isCount: Guard<number> = (value): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

export const isArrayOf = <T>(value: unknown, check: Guard<T>): value is T[] =>
  Array.isArray(value) && value.every(check);
