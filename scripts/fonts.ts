/* The Japanese fonts, for a site with a Japanese page: cut down to the characters the page uses.

     npm run fonts          rebuild both from the built pages' text, and write them over those in public/
     npm run fonts:check    fail if the built pages use a character their font doesn't have

   Both read the built pages, so run `npm run build` first, and again after a rebuild. Only the rebuild
   downloads anything (scripts/fonts/source.ts). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import config from "../site.config.ts";
import { OUTPUT, ROOT } from "../src/site/repo.ts";
import {
  builtPagesIn,
  isJapaneseLanguage,
  sansCharacters,
  serifCharacters,
  type BuiltPages,
} from "./fonts/characters.ts";
import { downloaded, NOTO_SANS_JP, NOTO_SERIF_JP, sourceFont, type SourceFont } from "./fonts/source.ts";
import { charactersIn, cutFont, type Weights } from "./fonts/subset.ts";

/** One of the two font files, and what it's cut from. */
type JapaneseFont = {
  /** Where the cut-down font is kept, from the repo's root. */
  file: string;
  source: SourceFont;
  /** The weights its @font-face rule gives it (src/styles/fonts.css). */
  weights: Weights;
  /** The characters it has to have, of all the built pages show. */
  characters: (pages: BuiltPages) => string[];
  /** What it sets, as the check's lines say it. */
  usedBy: string;
};

const FONTS_FOLDER = "public/assets/fonts";
const FONTS: JapaneseFont[] = [
  {
    file: `${FONTS_FOLDER}/noto-sans-jp.woff2`,
    source: NOTO_SANS_JP,
    weights: { min: 300, max: 900 },
    characters: sansCharacters,
    usedBy: "the Japanese text",
  },
  {
    file: `${FONTS_FOLDER}/noto-serif-jp.woff2`,
    source: NOTO_SERIF_JP,
    weights: 400,
    characters: serifCharacters,
    usedBy: "the Japanese in the serif",
  },
];

/** Inside node_modules, which every site ignores and `npm ci` empties. */
const SOURCE_FONTS_KEPT_IN = join(ROOT, "node_modules", ".cache", "japanese-fonts");

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { check: { type: "boolean", default: false } } });
  const siteHasJapanesePage = Object.keys(config.languages).some(isJapaneseLanguage);
  if (!siteHasJapanesePage) {
    console.log("No Japanese page, so no Japanese fonts: nothing to do.");
    return;
  }
  const pages = builtJapanesePages();
  for (const font of FONTS) {
    if (values.check) await check(font, pages);
    else await rebuild(font, pages);
  }
}

function builtJapanesePages(): BuiltPages {
  const outputFolder = join(ROOT, OUTPUT);
  const pages = existsSync(outputFolder) ? builtPagesIn(outputFolder) : undefined;
  if (!pages) throw new Error(`The Japanese page isn't in ${OUTPUT}/ yet: run \`npm run build\` first.`);
  return pages;
}

/** Cuts the font from its source and writes it over its file. */
async function rebuild(font: JapaneseFont, pages: BuiltPages): Promise<void> {
  const characters = font.characters(pages);
  const whole = await sourceFont(font.source, { cacheFolder: SOURCE_FONTS_KEPT_IN, download: downloaded });
  const cut = await cutFont(whole, characters, font.weights);
  writeFileSync(join(ROOT, font.file), cut);
  console.log(`${font.file}: ${characters.length} characters, ${cut.byteLength.toLocaleString("en-US")} bytes`);
}

/** Says whether the font's file has a glyph for every character it needs, and fails the run if it doesn't. */
async function check(font: JapaneseFont, pages: BuiltPages): Promise<void> {
  const needed = font.characters(pages);
  const inFont = await charactersIn(readFileSync(join(ROOT, font.file)));
  const missing = needed.filter((character) => !inFont.has(character));
  if (missing.length === 0) {
    console.log(`${font.file} has all ${needed.length} characters used by ${font.usedBy}`);
    return;
  }
  console.log(`${font.file} is missing ${missing.join("")} — run \`npm run fonts\``);
  process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
