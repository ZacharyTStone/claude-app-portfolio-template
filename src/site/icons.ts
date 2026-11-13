/* Icons: the ones a config can name (the stylesheet's .i-* classes and the
   logos), and the ones every page has in its <head>. */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Paths on the site. The files are each site's own. */
export const FAVICONS = {
  svg: "/assets/favicon.svg",
  png: "/assets/favicon-32.png",
  appleTouch: "/assets/apple-touch-icon.png",
} as const;

/** The icon names that aren't the stylesheet's: a link card or a panel row
    can name one, and it's drawn as a lettered badge
    (src/components/Logo.astro). */
export const LOGO_NAMES: readonly string[] = ["github", "linkedin"];

/** From the repo's root. */
export const STYLES_FOLDER = "src/styles";

/** Every part of the stylesheet, as one text. */
export function readStylesheet(stylesFolder: string): string {
  return readdirSync(stylesFolder)
    .map((file) => readFileSync(join(stylesFolder, file), "utf8"))
    .join("\n");
}

/** ".i-about {", at the start of a line, is the icon "about". */
const ICON_RULE = /^\.i-([a-z-]+) \{/gm;

export function iconsIn(css: string): Set<string> {
  const names = [...css.matchAll(ICON_RULE)].map(([, name]) => name);
  return new Set(names.filter((name) => name !== undefined));
}
