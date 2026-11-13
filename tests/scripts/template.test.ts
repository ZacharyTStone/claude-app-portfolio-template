import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  applyChanges,
  changesBetween,
  describeChanges,
  OWN,
  RETIRED,
  SHARED,
  sharedFiles,
} from "../../scripts/template.ts";
import { ROOT } from "../../src/site/repo.ts";
import { readText, scratchFolders } from "./scratch-folders.ts";

const folderOf = scratchFolders("template-test-");

/** A short list to test with: a shared folder, a shared file, and one file in the folder that's each site's
    own. */
const SMALL_LIST = { SHARED: ["src", "package.json"], OWN: ["src/own.txt"] };
const NO_CHANGES = { added: [], changed: [], removed: [] };

test("the shared files are the files in each shared path, less each site's own", () => {
  const root = folderOf("list", {
    "src/a.ts": "a",
    "src/deep/b.ts": "b",
    "src/own.txt": "mine",
    "package.json": "{}",
    "site.config.ts": "mine",
  });
  assert.deepEqual(sharedFiles(root, SMALL_LIST).sort(), ["package.json", "src/a.ts", "src/deep/b.ts"]);
});

const thisRepoShares = sharedFiles(ROOT, { SHARED, OWN });

test("this repo's list names its shared files", () => {
  for (const file of ["scripts/template.ts", "scripts/update-template.ts", "package.json", "src/shared/config.ts"])
    assert.ok(thisRepoShares.includes(file), file);
});

test("a site's own files aren't among this repo's shared files", () => {
  for (const file of ["site.config.ts", "README.md", "wrangler.jsonc", ...OWN])
    assert.ok(!thisRepoShares.includes(file), file);
});

test("the template scripts import only Node's own modules and each other", () => {
  const imported = /\bfrom "([^"]+)"/g;
  for (const script of ["scripts/template.ts", "scripts/update-template.ts"]) {
    for (const [, module = ""] of readText(ROOT, script).matchAll(imported))
      assert.match(module, /^node:|^\.\/template\.ts$/, `${script} imports ${module}`);
  }
});

const source = folderOf("source", {
  "src/a.ts": "new a",
  "src/c.ts": "c",
  "package.json": "{}",
  "README.md": "theirs",
});
const target = folderOf("target", {
  "src/a.ts": "old a",
  "src/b.ts": "b",
  "src/own.txt": "mine",
  "package.json": "{}",
  "README.md": "mine",
});
const changes = changesBetween(source, target, SMALL_LIST);
applyChanges(source, target, changes);

test("what would change is the shared files that are new, different or gone", () => {
  assert.deepEqual(changes, { added: ["src/c.ts"], changed: ["src/a.ts"], removed: ["src/b.ts"] });
});

test("applying the changes copies what's new and what's different", () => {
  assert.equal(readText(target, "src/c.ts"), "c");
  assert.equal(readText(target, "src/a.ts"), "new a");
});

test("applying the changes deletes what's gone", () => {
  assert.ok(!existsSync(join(target, "src/b.ts")));
});

test("applying the changes leaves a site's own file, and what isn't shared, as they were", () => {
  assert.equal(readText(target, "src/own.txt"), "mine");
  assert.equal(readText(target, "README.md"), "mine");
});

test("once the changes are applied, nothing is left to change", () => {
  assert.deepEqual(changesBetween(source, target, SMALL_LIST), NO_CHANGES);
});

test("a shared path the source no longer has is deleted from a target that still has it", () => {
  const withoutThem = folderOf("retired-source", { "src/a.ts": "a" });
  const withThem = folderOf("retired-target", { "src/a.ts": "a", "old-tool.py": "old", "old-tests/a.test.ts": "old" });
  const list = { SHARED: ["src", "old-tool.py", "old-tests"], OWN: [] };
  assert.deepEqual(changesBetween(withoutThem, withThem, list).removed.sort(), ["old-tests/a.test.ts", "old-tool.py"]);
});

test("every retired path is still listed as shared, so that an update deletes it", () => {
  for (const path of RETIRED) assert.ok(SHARED.includes(path), path);
});

test("no retired path is in this repo", () => {
  for (const path of RETIRED) assert.ok(!existsSync(join(ROOT, path)), path);
});

const ownSource = folderOf("own-source", { "src/a.ts": "a", "src/own.txt": "the template's" });
const ownTarget = folderOf("own-target", { "src/a.ts": "a" });
const startingItsOwn = changesBetween(ownSource, ownTarget, SMALL_LIST);

test("one of a site's own files that it doesn't have yet starts as the other's", () => {
  assert.deepEqual(startingItsOwn, { added: ["src/own.txt"], changed: [], removed: [] });
});

test("once a site has its own file and changes it, the file is left alone", () => {
  applyChanges(ownSource, ownTarget, startingItsOwn);
  writeFileSync(join(ownTarget, "src/own.txt"), "mine");
  assert.deepEqual(changesBetween(ownSource, ownTarget, SMALL_LIST), NO_CHANGES);
});

test("the changes are described a line a file, what happens to it first", () => {
  const described = describeChanges({
    added: ["src/c.ts"],
    changed: ["src/a.ts", "package.json"],
    removed: ["src/b.ts"],
  });
  assert.deepEqual(described, ["new      src/c.ts", "changed  src/a.ts", "changed  package.json", "removed  src/b.ts"]);
});

test("no changes are described with no lines", () => {
  assert.deepEqual(describeChanges(NO_CHANGES), []);
});
