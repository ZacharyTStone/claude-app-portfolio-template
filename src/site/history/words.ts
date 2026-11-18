/* The history's numbers, days and months as a page's language writes them,
   from the platform's own (Intl), so no string of the config's says any of
   it. GitHub's days are UTC days, and are written as such wherever the
   page is read. `code` is the page's language: "en", "ja". */

/** A day as the medium date style has it, in UTC. */
const DAY = { dateStyle: "medium", timeZone: "UTC" } as const;

/** Each formatter, made once for a language and a style: a calendar
    writes hundreds of days a page, and making a formatter costs far more
    than using one. */
const madeFormats = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function made<Format extends Intl.DateTimeFormat | Intl.NumberFormat>(key: string, make: () => Format): Format {
  const format = (madeFormats.get(key) as Format | undefined) ?? make();
  madeFormats.set(key, format);
  return format;
}

const dateFormat = (code: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  made(`date ${code} ${JSON.stringify(options)}`, () => new Intl.DateTimeFormat(code, options));

const numberFormat = (code: string, options: Intl.NumberFormatOptions = {}): Intl.NumberFormat =>
  made(`number ${code} ${JSON.stringify(options)}`, () => new Intl.NumberFormat(code, options));

/** "4,812" in English, "4 812" in French. */
export const writtenNumber = (code: string, count: number): string => numberFormat(code).format(count);

/** "38%"; "0.4%" for a share too small to be a whole one. */
export const writtenShare = (code: string, share: number): string =>
  numberFormat(code, { style: "percent", maximumFractionDigits: share > 0 && share < 0.01 ? 1 : 0 }).format(share);

/** "Mar 14, 2023" in English, "2023/03/14" in Japanese. */
export const writtenDay = (code: string, day: string): string => dateFormat(code, DAY).format(Date.parse(day));

/** Two days as one span: "Mar 2 – 24, 2023". */
export const writtenSpan = (code: string, from: string, to: string): string =>
  dateFormat(code, DAY).formatRange(Date.parse(from), Date.parse(to));

/** A month, "2022-04", as "April 2022". */
export const writtenMonth = (code: string, month: string): string =>
  dateFormat(code, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${month}-01`));

/** A piece of a number written with its unit: the figures, or the words. */
export type WrittenPart = { text: string; isNumber: boolean };

const PARTS_OF_A_NUMBER = new Set(["integer", "group", "decimal", "fraction", "minusSign"]);

/** A count of days in pieces, so that the figures can be drawn larger than
    the word: "23", " ", "days" in English, "23", " ", "日" in Japanese. */
export const daysInPieces = (code: string, days: number): WrittenPart[] =>
  numberFormat(code, { style: "unit", unit: "day", unitDisplay: "long" })
    .formatToParts(days)
    .map(({ type, value }) => ({ text: value, isNumber: PARTS_OF_A_NUMBER.has(type) }));

/** What Intl.Locale tells of a language's week, where the platform has it. */
type WithWeekInfo = { getWeekInfo?: () => { firstDay: number } };

/** Monday, as Date numbers it: where a week starts in a language the
    platform can't say for. */
const MONDAY = 1;

/** The day a language's week starts on, as Date numbers it (0 for Sunday):
    Sunday in English and Japanese, Monday in French. */
export function firstDayOfWeek(code: string): number {
  const firstDay = (new Intl.Locale(code) as Intl.Locale & WithWeekInfo).getWeekInfo?.().firstDay;
  // Intl counts from Monday as 1 to Sunday as 7.
  return firstDay === undefined ? MONDAY : firstDay % 7;
}

/** January 1, 2023 was a Sunday: the day a weekday's name is read from. */
const A_SUNDAY = Date.UTC(2023, 0, 1);
const MS_A_DAY = 86_400_000;

/** The name of a day of the week (0 for Sunday): "Mon", "月". */
export const weekdayName = (code: string, weekday: number, width: "short" | "long" = "short"): string =>
  dateFormat(code, { weekday: width, timeZone: "UTC" }).format(A_SUNDAY + weekday * MS_A_DAY);

/** The days of the week as Date numbers them, in the order the language's
    week has them. */
export const weekInOrder = (code: string): number[] =>
  Array.from({ length: 7 }, (_, place) => (firstDayOfWeek(code) + place) % 7);
