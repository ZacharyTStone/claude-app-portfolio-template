/* Two packages that come without types. What's declared is what the fonts' scripts use of each, as its README
   has it. */

declare module "subset-font" {
  type SubsetOptions = {
    targetFormat: "woff2" | "truetype";
    /** The OpenType features to keep, by tag. Without it, all are kept. */
    keepFeatures?: string[];
    dropTables?: string[];
    noHinting?: boolean;
    /** The name table's records to keep, by id, besides those a font can't do without. */
    preserveNameIds?: number[];
    /** For a variable font's axis, by tag: the one value to fix it at, or the range to keep. */
    variationAxes?: Record<string, number | { min: number; max: number }>;
  };

  /** The font with only the glyphs `text` needs. */
  export default function subsetFont(font: Buffer, text: string, options: SubsetOptions): Promise<Buffer>;
}

declare module "fontverter" {
  const fontverter: {
    /** The font in another container: WOFF2 unpacked to TrueType, say. */
    convert(font: Buffer, targetFormat: "truetype" | "woff2"): Promise<Buffer>;
  };
  export default fontverter;
}
