/* The files a site shares with the template (scripts/template.ts), and
   `npm run update-template` in throwaway git repos: a template, and a site
   made from it with "Use this template", so with no history in common. */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import { applyChanges, changesBetween, OWN, SHARED, sharedFiles } from "../scripts/template.ts";
import { ROOT } from "../src/site/constants.ts";

const SCRATCH = mkdtempSync(join(tmpdir(), "template-test-"));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));

/** A folder with these files in it. */
function folder(name: string, files: Record<string, string>): string {
  const root = join(SCRATCH, name);
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}

const read = (root: string, file: string) => readFileSync(join(root, file), "utf8");
const LIST = { SHARED: ["src", "package.json"], OWN: ["src/own.txt"] };

test("the shared files are the files in each shared path, less each site's own", () => {
  const root = folder("list", {
    "src/a.ts": "a",
    "src/deep/b.ts": "b",
    "src/own.txt": "mine",
    "package.json": "{}",
    "site.config.ts": "mine",
  });
  assert.deepEqual(sharedFiles(root, LIST).sort(), ["package.json", "src/a.ts", "src/deep/b.ts"]);
});

test("the list names this repo's shared files, and its own files aren't among them", () => {
  const files = sharedFiles(ROOT, { SHARED, OWN });
  for (const file of ["scripts/template.ts", "scripts/update-template.ts", "package.json", "src/shared/config.ts"])
    assert.ok(files.includes(file), file);
  for (const file of ["site.config.ts", "README.md", "wrangler.jsonc", ...OWN]) assert.ok(!files.includes(file), file);
});

test("copying shared files adds, changes and removes only shared files", () => {
  const from = folder("from", { "src/a.ts": "new a", "src/c.ts": "c", "package.json": "{}", "README.md": "theirs" });
  const to = folder("to", {
    "src/a.ts": "old a",
    "src/b.ts": "b",
    "src/own.txt": "mine",
    "package.json": "{}",
    "README.md": "mine",
  });
  const changes = changesBetween(from, to, LIST);
  assert.deepEqual(changes, { added: ["src/c.ts"], changed: ["src/a.ts"], removed: ["src/b.ts"] });
  applyChanges(from, to, changes);
  assert.equal(read(to, "src/a.ts"), "new a");
  assert.equal(read(to, "src/c.ts"), "c");
  assert.ok(!existsSync(join(to, "src/b.ts")));
  assert.equal(read(to, "src/own.txt"), "mine");
  assert.equal(read(to, "README.md"), "mine");
  assert.deepEqual(changesBetween(from, to, LIST), { added: [], changed: [], removed: [] });
});

test("one of a site's own files that it doesn't have yet starts as the other's, and is then left alone", () => {
  const from = folder("own-from", { "src/a.ts": "a", "src/own.txt": "the template's" });
  const to = folder("own-to", { "src/a.ts": "a" });
  const changes = changesBetween(from, to, LIST);
  assert.deepEqual(changes, { added: ["src/own.txt"], changed: [], removed: [] });
  applyChanges(from, to, changes);
  writeFileSync(join(to, "src/own.txt"), "mine");
  assert.deepEqual(changesBetween(from, to, LIST), { added: [], changed: [], removed: [] });
});

// ---- npm run update-template ----------------------------------------------------------------------

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function git(cwd: string, ...args: string[]): void {
  const { status, stderr } = spawnSync("git", ["-c", "commit.gpgsign=false", ...args], { cwd, env: GIT_ENV });
  assert.equal(status, 0, `git ${args.join(" ")}: ${stderr}`);
}

/** A folder as a git repo of its own, with everything committed. */
function repo(name: string, files: Record<string, string>): string {
  const root = folder(name, files);
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "First");
  return root;
}

/** The repo with this repo's copies of the two scripts the update runs. */
function withScripts(files: Record<string, string>): Record<string, string> {
  const script = (file: string) => readFileSync(join(ROOT, file), "utf8");
  return {
    ...files,
    "scripts/template.ts": script("scripts/template.ts"),
    "scripts/update-template.ts": script("scripts/update-template.ts"),
  };
}

const update = (site: string, template: string) =>
  spawnSync(process.execPath, [join(site, "scripts/update-template.ts"), pathToFileURL(template).href], {
    cwd: site,
    env: GIT_ENV,
    encoding: "utf8",
  });

/** A template's files: its list also shares docs/, which a site's older list doesn't. */
function templateFiles(): Record<string, string> {
  const files = withScripts({
    "src/app.ts": "new",
    "src/added.ts": "added",
    "docs/guide.md": "guide",
    "public/assets/fonts/noto-sans-jp.woff2": "the template's subset",
    "site.config.ts": "the template's config",
    "README.md": "the template's README",
  });
  files["scripts/template.ts"] = (files["scripts/template.ts"] ?? "").replace('"src",', '"src",\n  "docs",');
  return files;
}
const template = (name: string) => repo(name, templateFiles());

/** A site's own files, which an update leaves alone. */
const MINE = {
  "public/assets/fonts/noto-sans-jp.woff2": "my subset",
  "site.config.ts": "my config",
  "README.md": "my README",
  "wrangler.jsonc": "my wrangler",
};

/** A site made from an older template: no history in common with it. */
const site = (name: string) => repo(name, withScripts({ ...MINE, "src/app.ts": "old", "src/gone.ts": "gone" }));

test("npm run update-template replaces exactly the shared files, by the template's list, and says what's next", () => {
  const mine = site("site");
  const result = update(mine, template("template"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(read(mine, "src/app.ts"), "new");
  assert.equal(read(mine, "src/added.ts"), "added");
  assert.equal(read(mine, "docs/guide.md"), "guide");
  assert.ok(!existsSync(join(mine, "src/gone.ts")));
  for (const [file, text] of Object.entries(MINE)) assert.equal(read(mine, file), text, file);
  assert.match(result.stdout, /changed +src\/app\.ts/);
  assert.match(result.stdout, /removed +src\/gone\.ts/);
  assert.match(result.stdout, /npm ci/);
  assert.match(result.stdout, /npm run verify/);
});

test("npm run update-template says so when there's nothing to take", () => {
  const mine = repo("site-same", templateFiles());
  const result = update(mine, template("template-same"));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Up to date/);
});

test("npm run update-template won't run on uncommitted changes", () => {
  const mine = site("site-dirty");
  writeFileSync(join(mine, "src/app.ts"), "edited");
  const result = update(mine, template("template-dirty"));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Commit or stash/);
  assert.equal(read(mine, "src/app.ts"), "edited");
});

test("npm run update-template won't run in the site the template is made from", () => {
  const source = site("source");
  writeFileSync(join(source, "scripts/sync-template.ts"), "");
  git(source, "add", "-A");
  git(source, "commit", "-qm", "The source site");
  const result = update(source, template("template-source"));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /the template is made from/);
  assert.equal(read(source, "src/app.ts"), "old");
});
