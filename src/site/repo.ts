/* The repo's folders, for what reads its files: the build, the scripts
   and the tests. */

import { fileURLToPath } from "node:url";

/** The repo. */
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Where Astro builds the site, from the repo's root: the host serves
    this folder and nothing else. */
export const OUTPUT = "dist";
