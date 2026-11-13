/* The files a site shares with the template (scripts/template.ts), and
   `npm run update-template` in throwaway git repos: a template, and a site
   made from it with "Use this template", so with no history in common.

   The throwaway repos have no node_modules, as a fresh clone has none: the
   update tests pass only while scripts/template.ts and
   scripts/update-template.ts import nothing but Node's own modules. */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import { applyChanges, changesBetween, describeChanges, OWN, SHARED, sharedFiles } from "../scripts/template.ts";
import { ROOT } from "../src/site/repo.ts";

const SCRATCH = mkdtempSync(join(tmpdir(), "template-test-"));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

/** A file's text, by its path from the folder's root. */
type Files = Record<string, string>;

/** Makes a folder with these files in it, and returns its path. */
function folderOf(name: string, files: Files): string {
  const root = join(SCRATCH, name);
  mkdirSync(root, { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const readText = (root: string, file: string) => readFileSync(join(root, file), "utf8");

/** A short list to test with: a shared folder, a shared file, and one file
    in the folder that's each site's own. */
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

test("the list names this repo's shared files, and its own files aren't among them", () => {
  const files = sharedFiles(ROOT, { SHARED, OWN });
  for (const file of ["scripts/template.ts", "scripts/update-template.ts", "package.json", "src/shared/config.ts"])
    assert.ok(files.includes(file), file);
  for (const file of ["site.config.ts", "README.md", "wrangler.jsonc", ...OWN]) assert.ok(!files.includes(file), file);
});

test("copying shared files adds, changes and removes only shared files", () => {
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
  assert.deepEqual(changes, { added: ["src/c.ts"], changed: ["src/a.ts"], removed: ["src/b.ts"] });
  applyChanges(source, target, changes);
  assert.equal(readText(target, "src/a.ts"), "new a");
  assert.equal(readText(target, "src/c.ts"), "c");
  assert.ok(!existsSync(join(target, "src/b.ts")));
  assert.equal(readText(target, "src/own.txt"), "mine");
  assert.equal(readText(target, "README.md"), "mine");
  assert.deepEqual(changesBetween(source, target, SMALL_LIST), NO_CHANGES);
});

test("one of a site's own files that it doesn't have yet starts as the other's, and is then left alone", () => {
  const source = folderOf("own-source", { "src/a.ts": "a", "src/own.txt": "the template's" });
  const target = folderOf("own-target", { "src/a.ts": "a" });
  const changes = changesBetween(source, target, SMALL_LIST);
  assert.deepEqual(changes, { added: ["src/own.txt"], changed: [], removed: [] });
  applyChanges(source, target, changes);
  writeFileSync(join(target, "src/own.txt"), "mine");
  assert.deepEqual(changesBetween(source, target, SMALL_LIST), NO_CHANGES);
});

test("the changes are described a line a file, what happens to it first, or with no lines for none", () => {
  const changes = { added: ["src/c.ts"], changed: ["src/a.ts", "package.json"], removed: ["src/b.ts"] };
  assert.deepEqual(describeChanges(changes), [
    "new      src/c.ts",
    "changed  src/a.ts",
    "changed  package.json",
    "removed  src/b.ts",
  ]);
  assert.deepEqual(describeChanges(NO_CHANGES), []);
});

// ---- npm run update-template ----------------------------------------------------------------------

/** An author for the throwaway commits, on a machine where git has none. */
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function runGit(cwd: string, ...args: string[]): void {
  const { status, stderr } = spawnSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, env: GIT_ENV });
  assert.equal(status, 0, `git ${args.join(" ")}: ${stderr}`);
}

/** Makes a folder with these files that is a git repo of its own, with
    everything committed, and returns its path. */
function repoOf(name: string, files: Files): string {
  const root = folderOf(name, files);
  runGit(root, "init", "-q");
  runGit(root, "add", "-A");
  runGit(root, "commit", "-qm", "First");
  return root;
}

/** The files, and this repo's copies of the two scripts the update runs. */
function withUpdateScripts(files: Files): Files {
  return {
    ...files,
    "scripts/template.ts": readText(ROOT, "scripts/template.ts"),
    "scripts/update-template.ts": readText(ROOT, "scripts/update-template.ts"),
  };
}

/** Runs a site's own copy of the update, as `npm run update-template --
    <template>` does, taking the template from a folder: never from the
    network. `flags` go after the template; `env` stands in for GIT_ENV. */
function runUpdate(site: string, template: string, options: { flags?: string[]; env?: NodeJS.ProcessEnv } = {}) {
  const { flags = [], env = GIT_ENV } = options;
  const script = join(site, "scripts/update-template.ts");
  return spawnSync(process.execPath, [script, pathToFileURL(template).href, ...flags], {
    cwd: site,
    env,
    encoding: "utf8",
  });
}

/** A template's files. Its list also shares docs/, which a site's older
    list doesn't: "docs" is written into its copy of scripts/template.ts,
    after the "src" that starts SHARED. */
function templateFiles(): Files {
  const files = withUpdateScripts({
    "src/app.ts": "new",
    "src/added.ts": "added",
    "docs/guide.md": "guide",
    "public/assets/fonts/noto-sans-jp.woff2": "the template's subset",
    "site.config.ts": "the template's config",
    "README.md": "the template's README",
  });
  const listWithDocs = (files["scripts/template.ts"] ?? "").replace('"src",', '"src",\n  "docs",');
  assert.match(listWithDocs, /"docs",/, 'SHARED no longer starts with "src",');
  return { ...files, "scripts/template.ts": listWithDocs };
}
const templateRepo = (name: string) => repoOf(name, templateFiles());

/** A site's own files, which an update leaves alone. */
const SITE_OWN_FILES = {
  "public/assets/fonts/noto-sans-jp.woff2": "my subset",
  "site.config.ts": "my config",
  "README.md": "my README",
  "wrangler.jsonc": "my wrangler",
};

/** A site made from an older template: no history in common with it. */
const siteRepo = (name: string) =>
  repoOf(name, withUpdateScripts({ ...SITE_OWN_FILES, "src/app.ts": "old", "src/gone.ts": "gone" }));

test("npm run update-template replaces exactly the shared files, by the template's list, and says what's next", () => {
  const site = siteRepo("site");
  const result = runUpdate(site, templateRepo("template"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readText(site, "src/app.ts"), "new");
  assert.equal(readText(site, "src/added.ts"), "added");
  assert.equal(readText(site, "docs/guide.md"), "guide");
  assert.ok(!existsSync(join(site, "src/gone.ts")));
  for (const [file, text] of Object.entries(SITE_OWN_FILES)) assert.equal(readText(site, file), text, file);
  assert.match(result.stdout, /changed +src\/app\.ts/);
  assert.match(result.stdout, /removed +src\/gone\.ts/);
  assert.match(result.stdout, /npm ci/);
  assert.match(result.stdout, /npm run verify/);
});

test("npm run update-template says so when there's nothing to take", () => {
  const site = repoOf("site-same", templateFiles());
  const result = runUpdate(site, templateRepo("template-same"));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Up to date/);
});

test("npm run update-template won't run on uncommitted changes", () => {
  const site = siteRepo("site-dirty");
  writeFileSync(join(site, "src/app.ts"), "edited");
  const result = runUpdate(site, templateRepo("template-dirty"));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Commit or stash/);
  assert.equal(readText(site, "src/app.ts"), "edited");
});

test("npm run update-template won't run in the site the template is made from", () => {
  const sourceSite = siteRepo("source-site");
  writeFileSync(join(sourceSite, "scripts/sync-template.ts"), "");
  runGit(sourceSite, "add", "-A");
  runGit(sourceSite, "commit", "-qm", "The source site");
  const result = runUpdate(sourceSite, templateRepo("template-source"));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /the template is made from/);
  assert.equal(readText(sourceSite, "src/app.ts"), "old");
});

test("npm run update-template says which git command failed when there's no git to run", () => {
  const site = siteRepo("site-no-git");
  const emptyFolder = folderOf("no-git-on-this-path", {});
  const result = runUpdate(site, templateRepo("template-no-git"), { env: { PATH: emptyFolder } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^git status --porcelain failed:\n.*ENOENT/);
  assert.equal(readText(site, "src/app.ts"), "old");
});

test("npm run update-template takes the template's address and no flags", () => {
  const site = siteRepo("site-flag");
  const result = runUpdate(site, templateRepo("template-flag"), { flags: ["--force"] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option '--force'/);
  assert.equal(readText(site, "src/app.ts"), "old");
});
