import assert from "node:assert/strict";
import { test } from "node:test";
import { clockNote, hoursOwnerIsAhead, timeIn, type ClockWording, type TimeInZone } from "../../src/app/clock.ts";
import { SEPARATOR } from "../../src/app/constants.ts";

const WORDING: ClockWording = {
  same: "Same time",
  ahead: "{n}h ahead",
  behind: "{n}h behind",
  moods: { morning: "coffee", day: "working", evening: "cooking", late: "asleep" },
};

const MID_JANUARY = new Date("2026-01-15T12:00:00Z");
const MID_JULY = new Date("2026-07-15T12:00:00Z");

const UTC_MINUTES = 0;
const NEW_YORK_WINTER_MINUTES = -300;

const at = (hour: number, minutesAheadOfUtc = 0): TimeInZone => ({ hour, minutesAheadOfUtc });

test("a zone ahead of UTC is ahead by its whole offset", () => {
  assert.equal(timeIn("Asia/Tokyo", MID_JANUARY).minutesAheadOfUtc, 540);
});

test("a zone behind UTC is behind, as a negative number", () => {
  assert.equal(timeIn("America/New_York", MID_JANUARY).minutesAheadOfUtc, -300);
});

test("a zone's offset follows its summer time", () => {
  assert.equal(timeIn("America/New_York", MID_JULY).minutesAheadOfUtc, -240);
});

test("a zone can be a half hour from UTC", () => {
  assert.equal(timeIn("Asia/Kolkata", MID_JANUARY).minutesAheadOfUtc, 330);
});

test("a zone can be a quarter hour from UTC", () => {
  assert.equal(timeIn("Asia/Kathmandu", MID_JANUARY).minutesAheadOfUtc, 345);
});

test("the seconds of the time read don't move the offset", () => {
  const lastSecondOfTheMinute = new Date("2026-01-15T12:00:59.999Z");
  assert.equal(timeIn("Asia/Tokyo", lastSecondOfTheMinute).minutesAheadOfUtc, 540);
});

test("the hour is the zone's own", () => {
  assert.equal(timeIn("Asia/Tokyo", MID_JANUARY).hour, 21);
});

test("midnight is hour 0", () => {
  assert.equal(timeIn("UTC", new Date("2026-01-15T00:10:00Z")).hour, 0);
});

test("the owner is ahead by the hours between the two offsets", () => {
  assert.equal(hoursOwnerIsAhead(timeIn("Asia/Tokyo", MID_JANUARY), NEW_YORK_WINTER_MINUTES), 14);
});

test("the owner is behind by a negative number of hours", () => {
  assert.equal(hoursOwnerIsAhead(timeIn("America/New_York", MID_JANUARY), UTC_MINUTES), -5);
});

test("the hours between follow each zone's own summer time", () => {
  // The United States has changed its clocks by then, and Britain hasn't.
  const midMarch = new Date("2026-03-15T12:00:00Z");
  const newYork = timeIn("America/New_York", midMarch);
  assert.equal(hoursOwnerIsAhead(timeIn("Europe/London", midMarch), newYork.minutesAheadOfUtc), 4);
});

test("the note says the two times are the same when they are", () => {
  assert.equal(clockNote(WORDING, at(12), UTC_MINUTES), `Same time${SEPARATOR}working`);
});

test("the note puts the hours the owner is ahead into the wording", () => {
  assert.equal(clockNote(WORDING, at(12, 540), UTC_MINUTES), `9h ahead${SEPARATOR}working`);
});

test("the note puts the hours the owner is behind into the wording, without a minus", () => {
  assert.equal(clockNote(WORDING, at(12, -300), UTC_MINUTES), `5h behind${SEPARATOR}working`);
});

test("the note says a half hour as it is", () => {
  assert.equal(clockNote(WORDING, at(12, 330), UTC_MINUTES), `5.5h ahead${SEPARATOR}working`);
});

for (const [hour, mood] of [
  [4, "asleep"],
  [5, "coffee"],
  [9, "coffee"],
  [10, "working"],
  [17, "working"],
  [18, "cooking"],
  [22, "cooking"],
  [23, "asleep"],
  [0, "asleep"],
] as const) {
  test(`at ${hour}:00 where the owner is, the note's mood is the one for that part of their day`, () => {
    assert.equal(clockNote(WORDING, at(hour), UTC_MINUTES), `Same time${SEPARATOR}${mood}`);
  });
}
