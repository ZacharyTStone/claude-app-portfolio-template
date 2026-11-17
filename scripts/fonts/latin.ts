/* The Latin serif, Source Serif 4, which sets a few large titles: the greeting, the name atop the sidebar, a
   chat's name, the clocks. What it shows comes from the config and the clock, and changes from build to build,
   so it's cut to a fixed set of characters, not to what the pages use today: no greeting or time can then need
   a glyph it was cut without. The set is the same on every site, so the font is shared, and an update brings
   it. src/styles/fonts.css gives it the same set as its unicode-range, so a browser never asks it for a
   character it hasn't: tests/scripts/fonts/latin.test.ts holds the two together. */
import { SOURCE_SERIF_4, type SourceFont } from "./source.ts";
import type { Cut } from "./subset.ts";

/** The set, as each range's first and last code point: Basic Latin, Latin-1, the few other letters and marks
    of Western European languages, and the spaces, punctuation and signs, as far as Source Serif 4 has them,
    of Google Fonts' "latin" subset. No combining mark: an accent typed on its own shows in the system's
    serif, as a letter outside the set does (docs/languages.md). */
export const LATIN_SERIF_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007e],
  [0x00a0, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02bb, 0x02bc],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x2002, 0x2007],
  [0x2009, 0x200b],
  [0x2010, 0x2010],
  [0x2012, 0x2015],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2020, 0x2022],
  [0x2025, 0x2026],
  [0x202f, 0x2030],
  [0x2032, 0x2033],
  [0x2039, 0x203a],
  [0x203c, 0x203c],
  [0x2044, 0x2044],
  [0x2047, 0x2049],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
];

const codePointsOf = ([first, last]: readonly [number, number]): number[] =>
  Array.from({ length: last - first + 1 }, (_, nth) => first + nth);

/** Every character of the set, in order. */
export const LATIN_SERIF_CHARACTERS: string[] = LATIN_SERIF_RANGES.flatMap(codePointsOf).map((codePoint) =>
  String.fromCodePoint(codePoint),
);

/** The font: where it's kept, what it's cut from, and how. */
export const LATIN_SERIF: { file: string; source: SourceFont; cut: Cut } = {
  file: "public/assets/fonts/source-serif-4.woff2",
  source: SOURCE_SERIF_4,
  cut: {
    axes: {
      // From 400, the lightest weight the stylesheets set it in, to the font's heaviest. Each end is one the
      // font is drawn at, so 500, the name's, is drawn as it was before the cut: a range that ends between
      // them has its outlines worked out again, and their edges come out a shade different.
      wght: { min: 400, max: 900 },
      // Its optical sizes from 20 px, its smallest use, up: the greeting's fine display cut at 44 px, the
      // sturdier text cut of the name at 20 px. Set smaller, it keeps the 20 px cut.
      opsz: { min: 20, max: 60 },
    },
    // Kerning, the fi and fl ligatures, and a language's own forms: what a browser turns on by itself.
    features: ["kern", "liga", "locl"],
  },
};
