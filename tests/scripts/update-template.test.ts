/* `npm run update-template`, run in throwaway git repos: a template, and a site made from it with "Use this
   template", so with no history in common. The repos have no node_modules, as a fresh clone has none. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { SHARED_LIST_FILE } from "../../scripts/template.ts";
import { ROOT } from "../../src/site/repo.ts";
import { readText, scratchFolders, type Files } from "./scratch-folders.ts";

const folderOf = scratchFolders("update-template-test-");

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

/** Makes the folder a git repo of its own, with everything in it committed. */
function committed(root: string): string {
  runGit(root, "init", "-q");
  runGit(root, "add", "-A");
  runGit(root, "commit", "-qm", "First");
  return root;
}

const repoOf = (name: string, files: Files): string => committed(folderOf(name, files));

/** What a template shares: more than a site's older list knows of (docs/), and a tool it has since retired. */
const TEMPLATE_LIST = {
  shared: ["src", "docs"],
  retired: ["old-tool.py"],
  own: ["public/assets/fonts/noto-sans-jp.woff2"],
};
const TEMPLATE_FILES = {
  [SHARED_LIST_FILE]: JSON.stringify(TEMPLATE_LIST),
  "src/app.ts": "new",
  "src/added.ts": "added",
  "docs/guide.md": "guide",
  "public/assets/fonts/noto-sans-jp.woff2": "the template's subset",
  "site.config.ts": "the template's config",
  "README.md": "the template's README",
};
const templateRepo = (name: string) => repoOf(name, TEMPLATE_FILES);

/** A site's own files, which an update leaves alone. */
const SITE_OWN_FILES = {
  "public/assets/fonts/noto-sans-jp.woff2": "my subset",
  "site.config.ts": "my config",
  "README.md": "my README",
  "wrangler.jsonc": "my wrangler",
};
/** The two scripts the update runs, as this repo has them, and the site's own, older list. */
const UPDATE_SCRIPTS = {
  "scripts/template.ts": readText(ROOT, "scripts/template.ts"),
  "scripts/update-template.ts": readText(ROOT, "scripts/update-template.ts"),
  [SHARED_LIST_FILE]: JSON.stringify({ shared: ["src"], retired: [], own: ["public/assets/fonts/noto-sans-jp.woff2"] }),
};

/** A site made from an older template: no history in common with it. */
const siteRepo = (name: string) =>
  repoOf(name, {
    ...SITE_OWN_FILES,
    ...UPDATE_SCRIPTS,
    "src/app.ts": "old",
    "src/gone.ts": "gone",
    "old-tool.py": "old",
  });

/** Runs a site's own copy of the update, as `npm run update-template -- <template>` does, taking the template
    from a folder: never from the network. `flags` go after the template; `env` stands in for GIT_ENV. */
function runUpdate(site: string, template: string, options: { flags?: string[]; env?: NodeJS.ProcessEnv } = {}) {
  const { flags = [], env = GIT_ENV } = options;
  const script = join(site, "scripts/update-template.ts");
  return spawnSync(process.execPath, [script, pathToFileURL(template).href, ...flags], {
    cwd: site,
    env,
    encoding: "utf8",
  });
}

const site = siteRepo("site");
const update = runUpdate(site, templateRepo("template"));

test("an update of a site made from an older template succeeds", () => {
  assert.equal(update.status, 0, update.stderr);
});

test("an update takes the template's version of a shared file", () => {
  assert.equal(readText(site, "src/app.ts"), "new");
});

test("an update adds a shared file the site doesn't have", () => {
  assert.equal(readText(site, "src/added.ts"), "added");
});

test("an update goes by the template's list, which shares more than the site's older one", () => {
  assert.equal(readText(site, "docs/guide.md"), "guide");
});

test("an update deletes a shared file the template no longer has", () => {
  assert.ok(!existsSync(join(site, "src/gone.ts")));
});

test("an update deletes what the template has retired", () => {
  assert.ok(!existsSync(join(site, "old-tool.py")));
});

test("an update leaves a site's own files alone", () => {
  for (const [file, text] of Object.entries(SITE_OWN_FILES)) assert.equal(readText(site, file), text, file);
});

test("an update says what it did to each file", () => {
  assert.match(update.stdout, /changed +src\/app\.ts/);
  assert.match(update.stdout, /removed +src\/gone\.ts/);
});

test("an update says what to do next", () => {
  assert.match(update.stdout, /npm ci/);
  assert.match(update.stdout, /npm run verify/);
});

test("an update says so when there's nothing to take", () => {
  const upToDate = repoOf("site-same", { ...UPDATE_SCRIPTS, ...TEMPLATE_FILES });
  const result = runUpdate(upToDate, templateRepo("template-same"));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Up to date/);
});

test("an update won't run on uncommitted changes, and leaves them as they are", () => {
  const dirty = siteRepo("site-dirty");
  writeFileSync(join(dirty, "src/app.ts"), "edited");
  const result = runUpdate(dirty, templateRepo("template-dirty"));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Commit or stash/);
  assert.equal(readText(dirty, "src/app.ts"), "edited");
});

test("an update says which git command failed when there's no git to run, and changes nothing", () => {
  const withoutGit = siteRepo("site-no-git");
  const emptyFolder = folderOf("no-git-on-this-path", {});
  const result = runUpdate(withoutGit, templateRepo("template-no-git"), { env: { PATH: emptyFolder } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^git status --porcelain failed:\n.*ENOENT/);
  assert.equal(readText(withoutGit, "src/app.ts"), "old");
});

test("an update takes the template's address and no flags, and changes nothing when given one", () => {
  const flagged = siteRepo("site-flag");
  const result = runUpdate(flagged, templateRepo("template-flag"), { flags: ["--force"] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option '--force'/);
  assert.equal(readText(flagged, "src/app.ts"), "old");
});

/** The audit's proof A: a template whose scripts/template.ts leaves a mark when it's run. */
test("an update runs nothing of the template's: code in its scripts/template.ts stays unrun", () => {
  const mark = join(folderOf("mark", {}), "ran-on-import.txt");
  const leavesAMark = `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(mark)}, "ran");\n`;
  const withCode = repoOf("template-code", { ...TEMPLATE_FILES, "scripts/template.ts": leavesAMark });
  const result = runUpdate(siteRepo("site-code"), withCode);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!existsSync(mark), "the template's code ran");
});

/** A template that shares what `TEMPLATE_LIST` does, and these paths too. */
const templateSharing = (name: string, paths: string[], files: Files = {}) =>
  repoOf(name, {
    ...TEMPLATE_FILES,
    ...files,
    [SHARED_LIST_FILE]: JSON.stringify({ ...TEMPLATE_LIST, shared: [...TEMPLATE_LIST.shared, ...paths] }),
  });

/** The audit's proof B, in part: the list mirrors a folder beside the site, so what's there is deleted. */
test("an update refuses a list that reaches outside the site, and changes nothing", () => {
  const reached = siteRepo("site-reached");
  const beside = folderOf("beside-the-site", { "thesis.txt": "the owner's other work" });
  const result = runUpdate(reached, templateSharing("template-reaching", ["../beside-the-site"]));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /"\.\.\/beside-the-site" isn't a plain path inside the repo/);
  assert.equal(readText(beside, "thesis.txt"), "the owner's other work");
  assert.equal(readText(reached, "src/app.ts"), "old");
});

/** The audit's proof B, in part: the list names the files the README calls yours alone. */
for (const yours of ["site.config.ts", "wrangler.jsonc"]) {
  test(`an update refuses a list that shares ${yours}, and leaves the site's as it was`, () => {
    const mine = siteRepo(`site-keeps-${yours}`);
    const result = runUpdate(mine, templateSharing(`template-takes-${yours}`, [yours], { [yours]: "the template's" }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /is each site's own/);
    assert.equal(readText(mine, yours), SITE_OWN_FILES[yours as keyof typeof SITE_OWN_FILES]);
  });
}

test("a file this site's list calls its own stays its own when the template's list stops saying so", () => {
  const mine = siteRepo("site-keeps-font");
  const noLongerOwn = repoOf("template-drops-own", {
    ...TEMPLATE_FILES,
    [SHARED_LIST_FILE]: JSON.stringify({ shared: ["src", "public/assets/fonts"], retired: [], own: [] }),
  });
  const result = runUpdate(mine, noLongerOwn);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readText(mine, "public/assets/fonts/noto-sans-jp.woff2"), "my subset");
});

/** The audit's proof C: the template tracks a link at a shared path, to a folder elsewhere on the machine. */
test("an update refuses a template with a link at a shared path, and copies nothing it points at", () => {
  const elsewhere = folderOf("victim-home", { credentials: "a private key" });
  const linked = folderOf("template-link", {
    ...TEMPLATE_FILES,
    [SHARED_LIST_FILE]: JSON.stringify({ shared: ["src", "more-docs"], retired: [], own: [] }),
  });
  symlinkSync(elsewhere, join(linked, "more-docs"));
  const mine = siteRepo("site-link");
  const result = runUpdate(mine, committed(linked));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /more-docs is a link to somewhere else/);
  assert.ok(!existsSync(join(mine, "more-docs")));
  assert.equal(readText(mine, "src/app.ts"), "old");
});
