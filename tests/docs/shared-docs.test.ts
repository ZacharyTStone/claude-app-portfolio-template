/* The docs every site shares stay true of the code every site shares:
   AGENTS.md and the guides in docs/ run only npm scripts that exist, name
   only shared files that exist, and link only to what is there.

   A site's own files (site.config.ts, its pictures) aren't asked for: a
   site may have removed one, and these tests run in every site. */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { OWN, SHARED } from "../../scripts/template.ts";
import { brokenLinks, isMissing, missingNpmScripts, pathsNamedIn } from "./references.ts";

const GUIDES_FOLDER = "docs";
const guides = readdirSync(new URL(`../../${GUIDES_FOLDER}`, import.meta.url))
  .filter((file) => file.endsWith(".md"))
  .map((file) => `${GUIDES_FOLDER}/${file}`);

const isAtOrUnder = (path: string, folder: string): boolean => path === folder || path.startsWith(`${folder}/`);

/** Whether an update keeps `path` as the template has it: a shared file, a
    file in a shared folder, or a folder with shared files in it. */
const isShared = (path: string): boolean =>
  !OWN.includes(path) && SHARED.some((shared) => isAtOrUnder(path, shared) || isAtOrUnder(shared, path));

for (const doc of ["AGENTS.md", ...guides]) {
  test(`${doc} runs only npm scripts that package.json has`, () => {
    assert.deepEqual(missingNpmScripts(doc), []);
  });

  test(`${doc} names only shared files that exist`, () => {
    assert.deepEqual(pathsNamedIn(doc).filter(isShared).filter(isMissing), []);
  });

  test(`${doc} links only to files and headings that exist`, () => {
    assert.deepEqual(brokenLinks(doc), []);
  });
}
