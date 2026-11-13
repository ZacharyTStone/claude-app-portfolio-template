/* The parts of the day the page has words for: it carries the words for
   each, and the browser code shows the ones for the hour. */

import type { Greeting } from "../config/home.ts";
import type { ClockMood } from "../config/language.ts";

/** The hour (0–23) each part starts at: in the visitor's time for the
    greeting, in the owner's for the clock's mood. "Late" runs to the next
    morning. */
export const HOURS = {
  greeting: { morning: 5, afternoon: 12, evening: 18, late: 23 },
  mood: { morning: 5, day: 10, evening: 18, late: 23 },
} as const satisfies {
  greeting: Record<Exclude<keyof Greeting, "default">, number>;
  mood: Record<ClockMood, number>;
};

export type GreetingPart = keyof typeof HOURS.greeting;

/** Before the first part starts, it's still the last: with HOURS.greeting,
    4 is "late" and 5 is "morning". */
export function partOfDay<Part extends string>(hour: number, starts: Record<Part, number>): Part {
  const partsFromEarliest = (Object.keys(starts) as Part[]).sort((one, other) => starts[one] - starts[other]);
  return partsFromEarliest.findLast((part) => starts[part] <= hour) ?? (partsFromEarliest.at(-1) as Part);
}
