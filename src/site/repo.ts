/* Where the repo's own folders are, for the build, the scripts and the tests. */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Where Astro builds the site, from the repo's root: the host serves this
    folder and nothing else. */
export const OUTPUT = "dist";

/** The files the site serves as they are, from the repo's root: each at its
    path in the folder ("/assets/og.png"). */
export const PUBLIC_FOLDER = "public";

/** What public/ has at its root, by name, in the repo at `root`: nothing if
    it has no public/. */
export function namesAtPublicRoot(root: string): string[] {
  const folder = join(root, PUBLIC_FOLDER);
  return existsSync(folder) ? readdirSync(folder) : [];
}
