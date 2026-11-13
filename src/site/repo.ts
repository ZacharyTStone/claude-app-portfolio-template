/* Where the repo's own folders are, for the build, the scripts and the tests. */

import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Where Astro builds the site, from the repo's root: the host serves this
    folder and nothing else. */
export const OUTPUT = "dist";
