/* Which characters each Japanese font needs, read from the built pages. Noto Sans JP gets every character the
   Japanese page and 404.html show in Japanese; Noto Serif JP only those of what the stylesheet sets in the
   serif. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HOURS, type GreetingPart } from "../../src/contracts/day-parts.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";

/** The built pages the fonts are cut for, each as its HTML: the Japanese page, and 404.html if the site has
    one. */
export type BuiltPages = { japanese: string; notFound?: string };

const HOME_PAGE = "index.html";
const NOT_FOUND_PAGE = "404.html";

/** What the stylesheet sets in var(--serif), by class, and the data-* attributes that hold what the browser
    code shows there: the greeting's other times of day, the goodbye's title. Which classes those are is the
    stylesheet's to say (src/styles), and it can't be imported: a class newly set in the serif has to be added
    here, or its Japanese shows in another font. */
const SERIF_CLASSES = [PAGE_CLASSES.hello, PAGE_CLASSES.wordmark, PAGE_CLASSES.clockTime, PAGE_CLASSES.printName];
const GREETING_PARTS = Object.keys(HOURS.greeting) as GreetingPart[];
const SERIF_DATA_ATTRIBUTES = [...GREETING_PARTS.map(DATA.greet), DATA.byeTitle];

/** A language code that means Japanese: "ja", or Japanese with a region or script ("ja-JP"), but not another
    language that starts the same ("jam"). */
const JAPANESE_CODE = "ja(?:-[\\w-]+)?";
const JAPANESE_LANG = `\\blang="${JAPANESE_CODE}"`;
// <html lang="ja" dir="ltr" …
const JAPANESE_HTML_TAG = new RegExp(`<html\\s[^>]*${JAPANESE_LANG}`, "i");
// An element marked as Japanese on a page that isn't, with its tag's name and what's in it:
// <p class="intro" lang="ja">このアドレスには何もありません。</p>
const JAPANESE_ELEMENT = new RegExp(`<(\\w+)\\b[^>]*${JAPANESE_LANG}[^>]*>(.*?)</\\1>`, "gis");
// An element with one of the serif's classes among its own (so not class="hello-wrap"), the same way:
// <h1 class="hello" id="hello">こんにちは。</h1>
const SERIF_ELEMENT = new RegExp(
  `<(\\w+)\\b[^>]*\\bclass="(?:[^"]*\\s)?(?:${SERIF_CLASSES.join("|")})(?:\\s[^"]*)?"[^>]*>(.*?)</\\1>`,
  "gis",
);
const ANY_TAG = /<[^>]+>/g;
const SCRIPT_ELEMENT = /<script\b.*?<\/script>/gis;
// A block of data for the page's script, with the JSON in it:
// <script type="application/json" id="questions">{"title": "…"}</script>
const JSON_DATA_BLOCK = /<script type="application\/json"[^>]*>(.*?)<\/script>/gis;
// A character written as its number: &#12354; or &#x3042;
const NUMBERED_CHARACTER = /&#(?:x([0-9a-f]+)|([0-9]+));?/gi;

/** "~", where printable ASCII ends. The Latin fonts have everything up to it. */
const LAST_PRINTABLE_ASCII = 0x7e;
/** Unicode's blocks of emoji, and the two invisible characters that go with them: the joiner that makes one
    emoji of several, and the selector that asks for a character's emoji form. */
const EMOJI = { first: 0x1f000, last: 0x1faff, joinerAndSelector: "\u200d\ufe0f" } as const;
const WHITE_SPACE = /\p{White_Space}/u;

const JAPANESE_LANGUAGE = new RegExp(`^${JAPANESE_CODE}$`, "i");

export const isJapaneseLanguage = (languageCode: string): boolean => JAPANESE_LANGUAGE.test(languageCode);

/** The pages the build wrote into `outputFolder`, or undefined if none of them is in Japanese. The Japanese
    page is the home page if that's Japanese, or else the first language's page that is, taking their folders
    in order of name. */
export function builtPagesIn(outputFolder: string): BuiltPages | undefined {
  const languageFolders = readdirSync(outputFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const japanese = [HOME_PAGE, ...languageFolders.map((folder) => join(folder, HOME_PAGE))]
    .map((page) => join(outputFolder, page))
    .filter((page) => existsSync(page))
    .map((page) => readFileSync(page, "utf8"))
    .find(isJapanesePage);
  if (japanese === undefined) return undefined;
  const notFoundPage = join(outputFolder, NOT_FOUND_PAGE);
  return { japanese, notFound: existsSync(notFoundPage) ? readFileSync(notFoundPage, "utf8") : undefined };
}

/** What Noto Sans JP needs, in order: all that the Japanese page shows, and the 404 page's Japanese. */
export function sansCharacters({ japanese, notFound }: BuiltPages): string[] {
  return inOrder(charactersNeedingAFont(`${shownOn(japanese)} ${japaneseOnNotFoundPage(notFound)}`));
}

/** What Noto Serif JP needs, in order: the text of the serif's elements on the Japanese page, and on 404.html
    if that's in Japanese too. */
export function serifCharacters({ japanese, notFound }: BuiltPages): string[] {
  const japanesePages = [japanese, notFound ?? ""].filter(isJapanesePage);
  return inOrder(charactersNeedingAFont(japanesePages.map(serifTextOn).join(" ")));
}

function isJapanesePage(html: string): boolean {
  return JAPANESE_HTML_TAG.test(html);
}

/** Everything a page puts on screen: its body's text, the wording its data-* attributes hold for the browser
    code to show, and the question card's data (a JSON block in the page). */
function shownOn(html: string): string {
  const bodyStarts = html.search(/<body[\s>]/);
  if (bodyStarts < 0) throw new Error("A built page has no <body>: is the folder a built site?");
  const body = html.slice(bodyStarts);
  return textOf(body.replace(SCRIPT_ELEMENT, "")) + dataAttributeText(html) + jsonBlockText(body);
}

/** The 404 page's Japanese: all of it, or the lines marked lang="ja". */
function japaneseOnNotFoundPage(html: string | undefined): string {
  if (html === undefined) return "";
  if (isJapanesePage(html)) return shownOn(html);
  return Array.from(html.matchAll(JAPANESE_ELEMENT), ([, , contents = ""]) => textOf(contents)).join(" ");
}

function serifTextOn(html: string): string {
  const inElements = Array.from(html.matchAll(SERIF_ELEMENT), ([, , contents = ""]) => textOf(contents));
  const inDataAttributes = SERIF_DATA_ATTRIBUTES.map((prefix) => dataAttributeText(html, prefix));
  return [...inElements, ...inDataAttributes].join(" ");
}

/** A piece of HTML as text: a space for each tag. */
function textOf(markup: string): string {
  return withNumberedCharacters(markup.replace(ANY_TAG, " "));
}

/** The text of every data-* attribute on a page, or of those whose name starts with `prefix`. */
function dataAttributeText(html: string, prefix = "data-"): string {
  const attribute = new RegExp(`\\b${prefix}[\\w-]*="([^"]*)"`, "g");
  return Array.from(html.matchAll(attribute), ([, value = ""]) => withNumberedCharacters(value)).join(" ");
}

/** Every string in a page's JSON data blocks, at any depth. */
function jsonBlockText(body: string): string {
  return Array.from(body.matchAll(JSON_DATA_BLOCK), ([, json = ""]) => stringsIn(JSON.parse(json)).join(" ")).join(" ");
}

/** A parsed JSON value's strings: itself, a list's items or an object's values. Not an object's keys, which
    the page doesn't show. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

/** Astro writes a page's text as itself. The one other way a Japanese character can be in a page is by its
    number, so that's the one kind of entity read here. */
function withNumberedCharacters(text: string): string {
  return text.replace(NUMBERED_CHARACTER, (_, hexadecimal?: string, decimal?: string) =>
    String.fromCodePoint(hexadecimal === undefined ? Number(decimal) : parseInt(hexadecimal, 16)),
  );
}

function charactersNeedingAFont(text: string): Set<string> {
  return new Set(Array.from(text).filter(needsAJapaneseFont));
}

/** A character after ASCII, unless it's a space, or an emoji (the system's emoji font draws those). */
function needsAJapaneseFont(character: string): boolean {
  const isAfterAscii = codePointOf(character) > LAST_PRINTABLE_ASCII;
  return isAfterAscii && !(WHITE_SPACE.test(character) || isEmoji(character));
}

function isEmoji(character: string): boolean {
  const codePoint = codePointOf(character);
  return (EMOJI.first <= codePoint && codePoint <= EMOJI.last) || EMOJI.joinerAndSelector.includes(character);
}

const codePointOf = (character: string): number => character.codePointAt(0) ?? 0;

const inOrder = (characters: Set<string>): string[] => [...characters].sort((a, b) => codePointOf(a) - codePointOf(b));
