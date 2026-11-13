/* The template's own docs stay true of the template: its README and the
   files in .github/ run only npm scripts that exist, name only files that
   exist, and link only to what is there. A site made from the template
   replaces those docs, and can delete this file with them. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { brokenLinks, isMissing, missingNpmScripts, pathsNamedIn } from "./docs/references.ts";

const OWN_DOCS = ["README.md", ".github/CONTRIBUTING.md", ".github/SECURITY.md", ".github/pull_request_template.md"];

for (const doc of OWN_DOCS.filter((doc) => !isMissing(doc))) {
  test(`${doc} runs only npm scripts that package.json has`, () => {
    assert.deepEqual(missingNpmScripts(doc), []);
  });

  test(`${doc} names only files that exist`, () => {
    assert.deepEqual(pathsNamedIn(doc).filter(isMissing), []);
  });

  test(`${doc} links only to files and headings that exist`, () => {
    assert.deepEqual(brokenLinks(doc), []);
  });
}
