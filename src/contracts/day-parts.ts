/* The parts of the day the page has words for, and when each starts: the
   page (Home.astro, Account.astro) writes the words for each, and the
   browser code shows the ones for the hour. */

import type { ClockMood, Greeting } from "../config/language.ts";

/** The hour (0–23) each part of the day starts at: in the visitor's time
    for the home screen's greeting, and in the owner's for the clock's mood.
    "Late" runs to the next morning. */
export const HOURS = {
  greeting: { morning: 5, afternoon: 12, evening: 18, late: 23 },
  mood: { morning: 5, day: 10, evening: 18, late: 23 },
} as const satisfies {
  greeting: Record<Exclude<keyof Greeting, "default">, number>;
  mood: Record<ClockMood, number>;
};

/** A part of the visitor's day that has a greeting of its own. */
export type GreetingPart = keyof typeof HOURS.greeting;

/** The part of the day `hour` is in, by the hour each part starts (one of
    HOURS). Before the first, it's still the last: with HOURS.greeting, 4
    is "late" and 5 is "morning". */
export function partOfDay<Part extends string>(hour: number, starts: Record<Part, number>): Part {
  const partsFromEarliest = (Object.keys(starts) as Part[]).sort((one, other) => starts[one] - starts[other]);
  return partsFromEarliest.findLast((part) => starts[part] <= hour) ?? (partsFromEarliest.at(-1) as Part);
}
