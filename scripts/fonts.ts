/* The fonts the site ships cut down: the Latin serif to a fixed set of characters (scripts/fonts/latin.ts),
   and, for a site with a Japanese page, the Japanese fonts to the characters the page uses.

     npm run fonts          cut each from its source, and write it over the one in public/
     npm run fonts:check    fail if a font lacks a character it has to have

   For the Japanese fonts both read the built pages, so run `npm run build` first, and again after a rebuild.
   Only the rebuild downloads anything (scripts/fonts/source.ts). The Latin serif is the same on every site, so
   a site never needs to cut it: the template does, and an update brings it. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import config from "../site.config.ts";
import { ACTIVITY_STRING_NAMES, EMPTY_WRITING_STRING_NAMES, WRITING_STRING_NAMES } from "../src/config/strings.ts";
import { OUTPUT, ROOT } from "../src/site/repo.ts";
import { makeSite } from "../src/site/site.ts";
import {
  builtPagesIn,
  isJapaneseLanguage,
  sansCharacters,
  serifCharacters,
  type BuiltPages,
} from "./fonts/characters.ts";
import { LATIN_SERIF, LATIN_SERIF_CHARACTERS } from "./fonts/latin.ts";
import { downloaded, NOTO_SANS_JP, NOTO_SERIF_JP, sourceFont, type SourceFont } from "./fonts/source.ts";
import { charactersIn, cutFont, type Cut } from "./fonts/subset.ts";

/** One of the font files, and what it's cut from. */
type CutFont = {
  /** Where the cut-down font is kept, from the repo's root. */
  file: string;
  source: SourceFont;
  /** Its weights match its @font-face rule's (src/styles/fonts.css). */
  cut: Cut;
  /** The characters it has to have. */
  characters: string[];
  /** Which they are, as the check's lines say it: "used by the Japanese text". */
  charactersAre: string;
};

/** Kerning, and the spacing of Japanese punctuation and kana: palt, which the stylesheet turns on
    (src/styles/japanese.css), and halt. */
const JAPANESE_FEATURES = ["kern", "palt", "halt"];

const FONTS_FOLDER = "public/assets/fonts";

/** Inside node_modules, which every site ignores and `npm ci` empties. */
const SOURCE_FONTS_KEPT_IN = join(ROOT, "node_modules", ".cache", "fonts");

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { check: { type: "boolean", default: false } } });
  const latinSerif: CutFont = { ...LATIN_SERIF, characters: LATIN_SERIF_CHARACTERS, charactersAre: "of its set" };
  const cutOrCheck = values.check ? check : rebuild;
  await cutOrCheck(latinSerif);
  for (const font of japaneseFonts()) await cutOrCheck(font);
}

/** The Japanese fonts, with the characters the built Japanese page needs of each: none on a site without one. */
function japaneseFonts(): CutFont[] {
  const siteHasJapanesePage = Object.keys(config.languages).some(isJapaneseLanguage);
  if (!siteHasJapanesePage) {
    console.log("No Japanese page, so no Japanese fonts.");
    return [];
  }
  const pages = builtJapanesePages();
  return [
    {
      file: `${FONTS_FOLDER}/noto-sans-jp.woff2`,
      source: NOTO_SANS_JP,
      cut: { axes: { wght: { min: 300, max: 900 } }, features: JAPANESE_FEATURES },
      characters: sansCharacters(pages, wordingNotShownYet()),
      charactersAre: "used by the Japanese text",
    },
    {
      file: `${FONTS_FOLDER}/noto-serif-jp.woff2`,
      source: NOTO_SERIF_JP,
      cut: { axes: { wght: 400 }, features: JAPANESE_FEATURES },
      characters: serifCharacters(pages),
      charactersAre: "used by the Japanese in the serif",
    },
  ];
}

/** The Japanese wording of the parts a build leaves out while they have nothing to show: the Writing tab
    before the first post, the panel's activity before the first repo. A later build shows them, a daily
    rebuild without anyone at hand among them, so the fonts are cut for them now, and the check asks for them. */
function wordingNotShownYet(): string {
  const site = makeSite(config);
  const names = [
    ...(site.config.writing ? [...WRITING_STRING_NAMES, ...EMPTY_WRITING_STRING_NAMES] : []),
    ...(site.config.activity ? ACTIVITY_STRING_NAMES : []),
  ];
  const japaneseCodes = site.codes.filter(isJapaneseLanguage);
  return japaneseCodes.flatMap((code) => names.map((name) => site.language(code).strings[name] ?? "")).join(" ");
}

function builtJapanesePages(): BuiltPages {
  const outputFolder = join(ROOT, OUTPUT);
  const pages = existsSync(outputFolder) ? builtPagesIn(outputFolder) : undefined;
  if (!pages) throw new Error(`The Japanese page isn't in ${OUTPUT}/ yet: run \`npm run build\` first.`);
  return pages;
}

/** Cuts the font from its source and writes it over its file. */
async function rebuild(font: CutFont): Promise<void> {
  const whole = await sourceFont(font.source, { cacheFolder: SOURCE_FONTS_KEPT_IN, download: downloaded });
  const cut = await cutFont(whole, font.characters, font.cut);
  writeFileSync(join(ROOT, font.file), cut);
  console.log(`${font.file}: ${font.characters.length} characters, ${cut.byteLength.toLocaleString("en-US")} bytes`);
}

/** Says whether the font's file has a glyph for every character it needs, and fails the run if it doesn't. */
async function check(font: CutFont): Promise<void> {
  const inFont = await charactersIn(readFileSync(join(ROOT, font.file)));
  const missing = font.characters.filter((character) => !inFont.has(character));
  if (missing.length === 0) {
    console.log(`${font.file} has all ${font.characters.length} characters ${font.charactersAre}`);
    return;
  }
  console.log(`${font.file} is missing ${missing.join("")} — run \`npm run fonts\``);
  process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
