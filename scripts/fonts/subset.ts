/* Cutting a font down to the characters a site uses, and reading which characters a cut font has. */
import fontverter from "fontverter";
import { Blob, Face } from "harfbuzzjs";
import subsetFont from "subset-font";

/** A variable axis, cut to one value (which leaves the font without the axis) or to a range. */
type Axis = number | { min: number; max: number };

/** How a font is cut, besides its characters. The same cut of the same font is the same file: change one, and
    the fonts cut with it change when next rebuilt. */
export type Cut = {
  /** What's kept of each variable axis, by its tag: { wght: { min: 300, max: 900 } }. One left out is kept
      whole. */
  axes: Record<string, Axis>;
  /** The OpenType features kept, by tag. No other is. */
  features: readonly string[];
};

/** The names a font can't do without, and the licence's address (14): what every cut keeps of its name table. */
const NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 14];
/** The tables for text set top to bottom, which the site never does. */
const DROPPED_TABLES = ["vhea", "vmtx", "VORG"];

/** The font as a WOFF2 file with these characters and no others, cut as `cut` says. */
export function cutFont(font: Buffer, characters: string[], cut: Cut): Promise<Buffer> {
  return subsetFont(font, characters.join(""), {
    targetFormat: "woff2",
    keepFeatures: [...cut.features],
    preserveNameIds: NAME_IDS,
    dropTables: DROPPED_TABLES,
    // No instructions for fitting glyphs to a coarse pixel grid.
    noHinting: true,
    variationAxes: cut.axes,
  });
}

/** The characters a font file has a glyph for. */
export async function charactersIn(font: Buffer): Promise<Set<string>> {
  // HarfBuzz reads TrueType, and the site's fonts are WOFF2.
  const face = new Face(new Blob(await fontverter.convert(font, "truetype")));
  return new Set(Array.from(face.collectUnicodes(), (codePoint) => String.fromCodePoint(codePoint)));
}
