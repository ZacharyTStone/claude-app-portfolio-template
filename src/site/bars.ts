/* How long a bar is drawn in a bars figure (src/components/Bars.astro). */

/** How much of the drawing's width the longest bar takes, in percent: the
    rest is room for its value, written at its tip. */
const LONGEST = 70;

/** A bar's length as a percentage of the drawing's width, to two places. */
export function barLength(amount: number, most: number): number {
  return Math.round((amount / most) * LONGEST * 100) / 100;
}
