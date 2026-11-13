import { timeIn } from "../../src/app/clock.ts";

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

// Any day does. This one is in winter, when no time zone's clocks are about to change.
const A_DAY_UTC = Date.UTC(2026, 0, 15);

/** A moment half an hour into `hour` (0 to 23) of a day where `timeZone`
    is: for a check to stop the page's clock at. */
export function halfPast(hour: number, timeZone: string): Date {
  const zoneAheadOfUtc = timeIn(timeZone, new Date(A_DAY_UTC)).minutesAheadOfUtc * MINUTE_MS;
  return new Date(A_DAY_UTC + (hour + 0.5) * HOUR_MS - zoneAheadOfUtc);
}
