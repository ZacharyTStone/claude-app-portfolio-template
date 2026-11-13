import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  applyChanges,
  changesBetween,
  describeChanges,
  OWN,
  SHARED,
  SHARED_LIST_FILE,
  sharedFiles,
  sharedListOf,
} from "../../scripts/template.ts";
import { ROOT } from "../../src/site/repo.ts";
import { readText, scratchFolders } from "./scratch-folders.ts";

const folderOf = scratchFolders("template-test-");

/** A short list to test with: a shared folder, a shared file, and one file in the folder that's each site's
    own. */
const SMALL_LIST = { shared: ["src", "package.json"], retired: [], own: ["src/own.txt"] };
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

const thisRepos = sharedListOf(ROOT);
const thisRepoShares = sharedFiles(ROOT, thisRepos);

test("this repo's list names its shared files", () => {
  for (const file of ["scripts/template.ts", "scripts/update-template.ts", "package.json", "src/shared/config.ts"])
    assert.ok(thisRepoShares.includes(file), file);
});

test("a site's own files aren't among this repo's shared files", () => {
  for (const file of ["site.config.ts", "README.md", "wrangler.jsonc", ...thisRepos.own])
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
  const list = { shared: ["src"], retired: ["old-tool.py", "old-tests"], own: [] };
  assert.deepEqual(changesBetween(withoutThem, withThem, list).removed.sort(), ["old-tests/a.test.ts", "old-tool.py"]);
});

test("no retired path is in this repo", () => {
  for (const path of thisRepos.retired) assert.ok(!existsSync(join(ROOT, path)), path);
});

test("no path is listed twice", () => {
  const listed = [...thisRepos.shared, ...thisRepos.retired, ...thisRepos.own];
  assert.deepEqual(listed, [...new Set(listed)]);
});

test("a list that isn't three lists of paths is refused", () => {
  const withoutOwn = folderOf("no-own", { [SHARED_LIST_FILE]: JSON.stringify({ shared: ["src"], retired: [] }) });
  const notPaths = folderOf("not-paths", { [SHARED_LIST_FILE]: JSON.stringify({ shared: [1], retired: [], own: [] }) });
  assert.throws(() => sharedListOf(withoutOwn), /no list of paths called "own"/);
  assert.throws(() => sharedListOf(notPaths), /no list of paths called "shared"/);
});

test("a repo with no list is refused, and told which file is missing", () => {
  assert.throws(() => sharedListOf(folderOf("no-list", { "README.md": "" })), /shared-files\.json isn't there/);
});

/** What a site's older copy of the update does: it imports the template's copy of this file from a fresh clone,
    where nothing is installed, and reads the two names. */
test("an older site's update still finds SHARED and OWN in this file, read from the list beside it", async () => {
  const clone = folderOf("clone", {
    "scripts/template.ts": readText(ROOT, "scripts/template.ts"),
    [SHARED_LIST_FILE]: JSON.stringify({ shared: ["src"], retired: ["old.py"], own: ["src/mine.css"] }),
  });
  const imported: { SHARED: unknown; OWN: unknown } = await import(
    pathToFileURL(join(clone, "scripts/template.ts")).href
  );
  assert.deepEqual([imported.SHARED, imported.OWN], [["src", "old.py"], ["src/mine.css"]]);
});

test("this repo's SHARED and OWN are its list's", () => {
  assert.deepEqual([SHARED, OWN], [[...thisRepos.shared, ...thisRepos.retired], thisRepos.own]);
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

/** A list that shares `path`, and nothing else. */
const sharing = (path: string) => ({ shared: [path], retired: [], own: [] });
const NOT_PLAIN = /isn't a plain path inside the repo/;

for (const path of [
  "../beside-the-site",
  "src/../../beside",
  "/etc/passwd",
  "C:/Users",
  "src\\..\\..",
  "",
  ".",
  "src//a",
]) {
  test(`a list that names ${JSON.stringify(path)} is refused: it isn't a plain path inside the repo`, () => {
    assert.throws(() => sharedFiles(folderOf("plain", {}), sharing(path)), NOT_PLAIN);
  });
}

test("a retired path, or one of a site's own, is held to the repo as a shared one is", () => {
  const root = folderOf("plain-lists", {});
  assert.throws(() => sharedFiles(root, { shared: [], retired: ["../gone"], own: [] }), NOT_PLAIN);
  assert.throws(() => sharedFiles(root, { shared: [], retired: [], own: ["../mine"] }), NOT_PLAIN);
});

for (const path of [".git", ".git/config", "src/.git/hooks", ".GIT/config", ".git./config", "GIT~1/config"]) {
  test(`a list that names ${JSON.stringify(path)} is refused: an update never touches a .git`, () => {
    assert.throws(() => sharedFiles(folderOf("git", {}), sharing(path)), /\.git, which an update never touches/);
  });
}

/** The audit's proof B, in part: a list that mirrors a folder beside the site would delete what's there. */
test("nothing outside the two repos is read or deleted through a path with ..", () => {
  const beside = folderOf("beside-the-site", { "thesis.txt": "the owner's other work" });
  const template = folderOf("reaching-template", { "src/a.ts": "a" });
  const reachedSite = folderOf("reached-site", { "src/a.ts": "a" });
  const list = { shared: ["src", "../beside-the-site"], retired: [], own: [] };
  assert.throws(() => changesBetween(template, reachedSite, list), NOT_PLAIN);
  assert.equal(readText(beside, "thesis.txt"), "the owner's other work");
});

test("changes made by hand are held to the repo too, when they're applied", () => {
  const from = folderOf("by-hand-source", { "a.txt": "a" });
  const to = folderOf("by-hand-target", {});
  folderOf("by-hand-beside", { "thesis.txt": "kept" });
  assert.throws(
    () => applyChanges(from, to, { added: [], changed: [], removed: ["../by-hand-beside/thesis.txt"] }),
    NOT_PLAIN,
  );
});

const A_SITES_OWN = /is each site's own, or holds what is: an update leaves it alone/;

for (const path of ["site.config.ts", "wrangler.jsonc", "README.md", "diagrams", "tests/ask-questions.json"]) {
  test(`a list that shares ${path} is refused: it's each site's own`, () => {
    assert.throws(() => sharedFiles(folderOf("own", {}), sharing(path)), A_SITES_OWN);
  });
}

test("a list that shares a file inside a site's own folder, or a folder that holds a site's own, is refused", () => {
  const root = folderOf("own-reach", {});
  assert.throws(() => sharedFiles(root, sharing("diagrams/parts/arrows.ts")), A_SITES_OWN);
  assert.throws(() => sharedFiles(root, sharing("tests")), A_SITES_OWN);
});

test("a site's own is known whatever case its name is written in", () => {
  assert.throws(() => sharedFiles(folderOf("own-case", {}), sharing("SITE.CONFIG.TS")), A_SITES_OWN);
});

test("a list that shares one of the files it calls a site's own is refused", () => {
  const list = { shared: ["src", "src/styles/site.css"], retired: [], own: ["src/styles/site.css"] };
  assert.throws(() => sharedFiles(folderOf("own-listed", {}), list), A_SITES_OWN);
});

test("a retired path can't be a site's own either: it would be deleted", () => {
  const list = { shared: [], retired: ["wrangler.jsonc"], own: [] };
  assert.throws(() => sharedFiles(folderOf("own-retired", {}), list), A_SITES_OWN);
});

test("this repo's own list is one an update would follow", () => {
  assert.doesNotThrow(() => sharedFiles(ROOT, thisRepos));
});
