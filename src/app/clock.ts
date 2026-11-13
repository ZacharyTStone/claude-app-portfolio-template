/* The account menu's clock, worked out: the time where the owner is, how
   far that is from the visitor's, and the note that says so. It needs no
   page, so the unit tests and the browser checks use it as it is. */
import type { ClockMood } from "../config/language.ts";
import { HOURS, partOfDay } from "../contracts/day-parts.ts";
import { SEPARATOR } from "./constants.ts";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
/** Every time zone is a whole number of quarter hours from UTC. */
const QUARTER_HOUR_MINUTES = 15;

export type TimeInZone = {
  /** 0 to 23. */
  hour: number;
  /** Negative for a zone behind UTC. */
  minutesAheadOfUtc: number;
};

export function timeIn(timeZone: string, now: Date): TimeInZone {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(now);
  const numberOf = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  // Midnight is hour 0, even from a browser that writes it as 24.
  const hour = numberOf("hour") % 24;
  // The zone's date and time, read as if they were UTC's: how far that is
  // from the real time is how far the zone is from UTC. To the nearest
  // quarter hour, as the zone's time was read without its seconds.
  const zoneTimeAsUtc = Date.UTC(numberOf("year"), numberOf("month") - 1, numberOf("day"), hour, numberOf("minute"));
  const minutesAhead = (zoneTimeAsUtc - now.getTime()) / MS_PER_MINUTE;
  return { hour, minutesAheadOfUtc: Math.round(minutesAhead / QUARTER_HOUR_MINUTES) * QUARTER_HOUR_MINUTES };
}

/** The clock's wording, as the page carries it (the config's
    account.clock). */
export type ClockWording = {
  same: string;
  /** With {n} for the hours between. */
  ahead: string;
  behind: string;
  moods: Record<ClockMood, string>;
};

/** Negative when the owner's clock is behind the visitor's, and not always
    whole: India is five and a half hours ahead of UTC. */
export const hoursOwnerIsAhead = (owner: TimeInZone, visitorMinutesAheadOfUtc: number): number =>
  (owner.minutesAheadOfUtc - visitorMinutesAheadOfUtc) / MINUTES_PER_HOUR;

function hoursApartNote(wording: ClockWording, hoursAhead: number): string {
  if (hoursAhead === 0) return wording.same;
  const template = hoursAhead > 0 ? wording.ahead : wording.behind;
  return template.replace("{n}", String(Math.abs(hoursAhead)));
}

/** The line under the clock's two times: how far apart they are, then what
    the owner is likely doing at their hour. */
export function clockNote(wording: ClockWording, owner: TimeInZone, visitorMinutesAheadOfUtc: number): string {
  const apart = hoursApartNote(wording, hoursOwnerIsAhead(owner, visitorMinutesAheadOfUtc));
  const mood = wording.moods[partOfDay(owner.hour, HOURS.mood)];
  return `${apart}${SEPARATOR}${mood}`;
}
