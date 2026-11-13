import { round } from "es-toolkit";

/** How much of the drawing's width the longest bar takes, in percent: the
    rest is room for its value, written at its tip. */
const LONGEST_BAR_PERCENT = 70;

const LENGTH_DECIMAL_PLACES = 2;

/** A bar's length as a percentage of the drawing's width, in proportion to the figure's longest bar. */
export function barLength(amount: number, largestAmount: number): number {
  return round((amount / largestAmount) * LONGEST_BAR_PERCENT, LENGTH_DECIMAL_PLACES);
}
