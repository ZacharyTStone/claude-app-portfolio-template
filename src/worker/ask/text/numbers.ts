import { hasDigit } from "./words.ts";

/** The numbers a reply may write out, and each in digits. "One" isn't here:
    it's as often a pronoun ("the one he built"), and a reply shouldn't fail
    for that. Nor are "first" and "second", "once" and "twice", "half". */
const NUMBER_WORDS: ReadonlyMap<string, string> = new Map(
  Object.entries({
    zero: "0",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    thirteen: "13",
    fourteen: "14",
    fifteen: "15",
    sixteen: "16",
    seventeen: "17",
    eighteen: "18",
    nineteen: "19",
    twenty: "20",
    thirty: "30",
    forty: "40",
    fifty: "50",
    sixty: "60",
    seventy: "70",
    eighty: "80",
    ninety: "90",
    hundred: "100",
    thousand: "1000",
    million: "1000000",
    billion: "1000000000",
    dozen: "12",
  }),
);

// "2,350+" and "2350" are the same number.
const withoutCommasOrPlus = (digits: string): string => digits.replace(/,/g, "").replace(/\+$/, "");

/** The number a word says, as it's compared: "2,350+" is "2350", "Ten" and
    "tens" are "10", and "N2" (digits in a name) is "n2". Undefined for a
    word that says none. */
export function numberIn(word: string): string | undefined {
  const lowered = word.toLowerCase();
  if (hasDigit(lowered)) return withoutCommasOrPlus(lowered);
  return NUMBER_WORDS.get(lowered) ?? NUMBER_WORDS.get(lowered.replace(/s$/, ""));
}

// "385ms", "1.04s", "5k". The first group is the number.
const NUMBER_WITH_UNIT = /^(\p{Nd}[\p{Nd}.]*)\p{Ll}+$/u;

/** The number of one with its unit written on to it: "385" for "385ms".
    `number` is as it's compared (`numberIn`), so it has no commas and its
    unit is in lower case. Undefined for a number without a unit. */
export const numberBeforeUnit = (number: string): string | undefined => NUMBER_WITH_UNIT.exec(number)?.[1];

// "385 ms", "5 K": a number, a space, and letters after it.
const NUMBER_THEN_UNIT = /(?<![\p{L}\p{N}.,])(\p{Nd}(?:[.,]?\p{Nd})*) (\p{Script=Latin}+)(?![\p{L}\p{N}])/gu;

/** Each number a text writes with its unit after a space, as it's compared
    with the unit written on to it: "385ms" for "385 ms". */
export const numbersWithUnitApartIn = (text: string): string[] =>
  [...text.matchAll(NUMBER_THEN_UNIT)].flatMap(([, number = "", unit = ""]) => numberIn(number + unit) ?? []);
