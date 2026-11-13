/* The stylesheet can't import a name, so these tests hold its names to the ones the components, the pages and
   the browser code write, and its breakpoints and durations to the browser code's. */

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { SIZE, TIMING } from "../../src/app/constants.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { ROOT } from "../../src/site/repo.ts";

const MANIFEST = "src/styles/app.css";
/** Where a stylesheet may be: beside a component, or with what everything shares and what the script makes. */
const STYLESHEET_FOLDERS = ["src/components", "src/styles"];
/** Where a class is written into the page: by a component, a page, or the browser code. */
const MARKUP_FOLDERS = ["src/components", "src/pages", "src/app"];

/** Classes that are written with no rule on purpose: the browser code and the checks find an element by them. */
const HOOKS_WITHOUT_A_RULE = ["new-tab", "asked-question", "reply", "viewer-open", "viewer-close"];

const filesIn = (folder: string, extensions: string[]): string[] =>
  readdirSync(join(ROOT, folder), { recursive: true, encoding: "utf8" })
    .filter((file) => extensions.some((extension) => file.endsWith(extension)))
    .map((file) => join(folder, file));

/** The stylesheets app.css lists, in its order, as paths from the repo's root. */
const listedStylesheets = [...readFileSync(join(ROOT, MANIFEST), "utf8").matchAll(/^@import "([^"]+)";$/gm)].map(
  ([, path = ""]) => relative(ROOT, join(ROOT, dirname(MANIFEST), path)),
);

/** A stylesheet without what can hold a dot that isn't a class's: comments, strings and url(…). */
const withoutTextAndAddresses = (css: string): string =>
  css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/url\([^)]*\)|"[^"]*"|'[^']*'/g, "");

const stylesheet = listedStylesheets.map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
const CLASS_IN_A_SELECTOR = /\.(-?[a-zA-Z_][\w-]*)/g;
const classesWithARule = new Set(
  [...withoutTextAndAddresses(stylesheet).matchAll(CLASS_IN_A_SELECTOR)].map(([, name = ""]) => name),
);

/** Where a class attribute's value starts: class="…", class={…}, class:list={…}, class: … in an object, and
    className = …. */
const CLASS_ATTRIBUTE = /\bclass(Name|:list)?\s*[=:]\s*/g;
const QUOTED = /"([^"]*)"|'([^']*)'|`([^`]*)`/g;
/** In class:list, an object's key is a class: { round, now: step.now }. */
const KEY_IN_A_CLASS_LIST = /[{,]\s*([a-z][\w-]*)\s*(?=[,:}])/g;
const A_CLASS = /^-?[a-zA-Z_][\w-]*$/;
const OPENS = "{([";
const CLOSES = "})]";
const QUOTED_HERE = /"[^"]*"|'[^']*'|`[^`]*`/y;

/** From a bracket at `from` to the one that closes it. */
function bracketedFrom(source: string, from: number): string {
  let depth = 0;
  for (let at = from; at < source.length; at++) {
    if (OPENS.includes(source.charAt(at))) depth++;
    if (CLOSES.includes(source.charAt(at)) && --depth === 0) return source.slice(from, at + 1);
  }
  return source.slice(from);
}

/** A property's value (class: …): up to the comma, the line's end or the closing bracket that ends it. */
function propertyValueFrom(source: string, from: number): string {
  let depth = 0;
  for (let at = from; at < source.length; at++) {
    const character = source.charAt(at);
    if (OPENS.includes(character)) depth++;
    if (CLOSES.includes(character)) depth--;
    if (depth < 0 || (depth === 0 && ",\n".includes(character))) return source.slice(from, at);
  }
  return source.slice(from);
}

/** An attribute's value (class="…", class={…}): one quoted or bracketed piece. */
function attributeValueFrom(source: string, from: number): string {
  QUOTED_HERE.lastIndex = from;
  return QUOTED_HERE.exec(source)?.[0] ?? bracketedFrom(source, from);
}

/** The classes a source file writes as literals. One made from a value (`i-${icon}`) isn't a literal. */
function literalClassesIn(source: string): string[] {
  return [...source.matchAll(CLASS_ATTRIBUTE)].flatMap((attribute) => {
    const from = attribute.index + attribute[0].length;
    const isAttribute = attribute[0].trimEnd().endsWith("=");
    const value = isAttribute ? attributeValueFrom(source, from) : propertyValueFrom(source, from);
    const quoted = [...value.matchAll(QUOTED)].flatMap(([, ...texts]) =>
      texts
        .join("")
        .replace(/\S*\$\{[^}]*\}\S*/g, " ")
        .split(/\s+/),
    );
    const keys = attribute[1] === ":list" ? [...value.matchAll(KEY_IN_A_CLASS_LIST)].map(([, key = ""]) => key) : [];
    return [...quoted, ...keys].filter((name) => A_CLASS.test(name));
  });
}

const literalClasses = new Set(
  MARKUP_FOLDERS.flatMap((folder) => filesIn(folder, [".astro", ".ts"])).flatMap((path) =>
    literalClassesIn(readFileSync(join(ROOT, path), "utf8")),
  ),
);
const namedClasses = new Set<string>(Object.values(PAGE_CLASSES));
/** An icon's class is made from its name in the config (`i-about`): the stylesheet's .i-* rules are the list. */
const isAnIcon = (name: string): boolean => name.startsWith("i-");

test("app.css lists every stylesheet, and every stylesheet it lists is there", () => {
  const stylesheets = STYLESHEET_FOLDERS.flatMap((folder) => filesIn(folder, [".css"])).filter(
    (path) => path !== MANIFEST,
  );
  assert.deepEqual([...listedStylesheets].sort(), stylesheets.sort());
  assert.deepEqual(
    listedStylesheets.filter((path) => !existsSync(join(ROOT, path))),
    [],
  );
});

test("every class the stylesheet has a rule for is written by a component, a page or the browser code", () => {
  const neverWritten = [...classesWithARule].filter(
    (name) => !namedClasses.has(name) && !literalClasses.has(name) && !isAnIcon(name),
  );
  assert.deepEqual(neverWritten, [], "a rule for a class nothing writes (or one this test can't see being written)");
});

test("every class in the names map has a rule, or is listed as a hook without one", () => {
  const withoutARule = [...namedClasses].filter((name) => !classesWithARule.has(name));
  assert.deepEqual(withoutARule.sort(), [...HOOKS_WITHOUT_A_RULE].sort());
});

test("every class written as a literal has a rule", () => {
  const withoutARule = [...literalClasses].filter((name) => !classesWithARule.has(name) && !namedClasses.has(name));
  assert.deepEqual(withoutARule, [], "a class typed out in markup or the browser code that no rule styles");
});

test("the stylesheet's two breakpoints are the browser code's", () => {
  const screenWidths = (bound: "max" | "min"): number[] =>
    [...stylesheet.matchAll(new RegExp(String.raw`@media \(${bound}-width: (\d+)px\)`, "g"))].map(([, px]) =>
      Number(px),
    );
  assert.deepEqual([...new Set(screenWidths("min"))], [SIZE.wide], "from this width the sidebar is beside the tab");
  assert.deepEqual(
    [...new Set(screenWidths("max"))].sort((one, other) => one - other),
    [SIZE.wide - 1, SIZE.viewerBeside - 1],
    "below these widths the sidebar is a drawer, and the panel and the viewer have no room beside the tab",
  );
});

test("a played picture fades for as long as the browser code waits", () => {
  assert.match(stylesheet, new RegExp(String.raw`--play-fade: ${TIMING.playFade}ms;`));
});
