/** A character outside the Latin alphabets and general punctuation: kana and kanji, drawn a full square wide. */
const FULL_WIDTH = /[^\u0000-\u024F\u2000-\u206F]/;
const NARROW = /[ilj.,:;'’|!]/;
const WIDE = /[mwMW]/;
const CAPITAL_OR_DIGIT = /[A-Z0-9]/;

/** How wide Inter draws a character, in sizes. */
function widthInInter(character: string): number {
  if (character === " ") return 0.28;
  if (NARROW.test(character)) return 0.27;
  if (WIDE.test(character)) return 0.85;
  if (CAPITAL_OR_DIGIT.test(character)) return 0.66;
  return 0.55;
}

const WIDTH_IN_MONO = 0.6;
/** How much wider than regular text semibold and bold text is drawn, and the `weight` it's bold from. A
    monospaced font's bold letters are as wide as its regular ones. */
const BOLD = { from: 600, isWider: 1.07 } as const;

/** About how wide a line of text is drawn, to size a box around it. The picture is drawn in whatever font the
    visitor's computer has, so leave room: this is an estimate for Inter (a little more at a `weight` of 600 or
    over), and a full square for kana and kanji. */
export function textWidth(text: string, size: number, mono = false, weight = 400): number {
  const widthOf = (character: string) => {
    if (FULL_WIDTH.test(character)) return 1;
    return mono ? WIDTH_IN_MONO : widthInInter(character);
  };
  const wider = !mono && weight >= BOLD.from ? BOLD.isWider : 1;
  return [...text].reduce((width, character) => width + widthOf(character), 0) * size * wider;
}

/** The size a text is written at to fit a width: `size`, or as much smaller as it takes. `look` is the `mono`
    and `weight` its label has. */
export function sizeToFit(
  text: string,
  width: number,
  size: number,
  look: { mono?: boolean; weight?: number } = {},
): number {
  return Math.min(size, Math.floor((size * width) / textWidth(text, size, look.mono, look.weight)));
}

/** How far below its middle a line of text's baseline is, in sizes. */
const BASELINE_BELOW_MIDDLE = 0.35;

/** The baseline that centres a line of text of `size` on the height `y`. */
export const baselineAround = (y: number, size: number): number => y + size * BASELINE_BELOW_MIDDLE;
