/* Icons: the ones a config can name (the stylesheet's .i-* classes, read
   from its source), and the ones every page has in its <head>. */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The icons every page has, paths on the site (each site's own files). */
export const FAVICONS = {
  svg: "/assets/favicon.svg",
  png: "/assets/favicon-32.png",
  appleTouch: "/assets/apple-touch-icon.png",
} as const;

/** Where the stylesheet's parts are, from the repo's root. */
export const STYLES_FOLDER = "src/styles";

/** Every part of the stylesheet in the folder `stylesFolder`, as one text. */
export function readStylesheet(stylesFolder: string): string {
  return readdirSync(stylesFolder)
    .map((file) => readFileSync(join(stylesFolder, file), "utf8"))
    .join("\n");
}

/** An icon's rule, at the start of a line: ".i-about {" is the icon
    "about". */
const ICON_RULE = /^\.i-([a-z-]+) \{/gm;

/** The .i-* icons a stylesheet has: .i-about and so on. */
export function iconsIn(css: string): Set<string> {
  const names = [...css.matchAll(ICON_RULE)].map(([, name]) => name);
  return new Set(names.filter((name) => name !== undefined));
}
