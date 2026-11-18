/* When a post was posted, by its owner's clock. Qiita gives each post's
   time with its author's offset, but Zenn, DEV and most feeds give it in
   UTC or their own zone, and a post written late in the evening in Tokyo
   would show the day before. So the time is written again in the config's
   timezone, with that zone's offset, which is what a Post's `posted` is. */

/** The parts of a moment in `timeZone`, by name: { year: "2026", … }. */
function partsIn(moment: number, timeZone: string): Map<string, string> {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "longOffset",
  });
  return new Map(format.formatToParts(moment).map(({ type, value }) => [type, value]));
}

/** "GMT+09:00" as "+09:00"; "GMT", which is how UTC is written, as "+00:00". */
const offsetOf = (zoneName: string): string => zoneName.replace("GMT", "") || "+00:00";

/** `moment` (milliseconds since 1970, UTC) in `timeZone`, to the second:
    "2026-10-01T23:30:00+09:00". */
export function inTimeZone(moment: number, timeZone: string): string {
  const part = partsIn(moment, timeZone);
  const day = `${part.get("year")}-${part.get("month")}-${part.get("day")}`;
  const time = `${part.get("hour")}:${part.get("minute")}:${part.get("second")}`;
  return `${day}T${time}${offsetOf(part.get("timeZoneName") ?? "")}`;
}

/** A time as a feed or an API writes it (ISO 8601, or RFC 822 in RSS:
    "Wed, 18 Nov 2026 12:00:00 +0900"), in `timeZone`; undefined if it
    isn't a time. */
export function postedIn(written: string, timeZone: string): string | undefined {
  const moment = Date.parse(written);
  return Number.isNaN(moment) ? undefined : inTimeZone(moment, timeZone);
}
