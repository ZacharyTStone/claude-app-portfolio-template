/* Cutting a font down to the characters a site uses, and reading which characters a cut font has. */
import fontverter from "fontverter";
import { Blob, Face } from "harfbuzzjs";
import subsetFont from "subset-font";

/** The weights a font is cut to: one (which leaves it not variable at all), or the two ends of a variable
    font's range. */
export type Weights = number | { min: number; max: number };

/** What a cut keeps of a font, besides the glyphs asked for. The same settings cut the same file from the
    same font: change one, and every site's fonts change when next rebuilt. */
const KEPT = {
  /** Kerning, and the spacing of Japanese punctuation and kana: palt, which the stylesheet turns on
      (src/styles/japanese.css), and halt. No other OpenType feature. */
  features: ["kern", "palt", "halt"],
  /** The names a font can't do without, and the licence's address (14). */
  nameIds: [0, 1, 2, 3, 4, 5, 6, 14],
} as const;
/** The tables for text set top to bottom, which the site never does. */
const DROPPED_TABLES = ["vhea", "vmtx", "VORG"];

/** The font as a WOFF2 file with these characters and no others, in these weights. */
export function cutFont(font: Buffer, characters: string[], weights: Weights): Promise<Buffer> {
  return subsetFont(font, characters.join(""), {
    targetFormat: "woff2",
    keepFeatures: [...KEPT.features],
    preserveNameIds: [...KEPT.nameIds],
    dropTables: DROPPED_TABLES,
    // No instructions for fitting glyphs to a coarse pixel grid.
    noHinting: true,
    variationAxes: { wght: weights },
  });
}

/** The characters a font file has a glyph for. */
export async function charactersIn(font: Buffer): Promise<Set<string>> {
  // HarfBuzz reads TrueType, and the site's fonts are WOFF2.
  const face = new Face(new Blob(await fontverter.convert(font, "truetype")));
  return new Set(Array.from(face.collectUnicodes(), (codePoint) => String.fromCodePoint(codePoint)));
}
