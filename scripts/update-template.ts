/* `npm run update-template` replaces this site's shared files (scripts/template.ts lists them) with the
   template's latest, and leaves the rest (your config, README, pictures, Japanese fonts) as it is.

     npm run update-template
     npm run update-template -- <the template's address or folder, if not the usual one>

   It needs git, and a working tree with nothing uncommitted. It commits nothing: `git diff` shows what it did.

   It imports only Node's own modules and scripts/template.ts, so that it runs where no package is installed:
   `npm ci` is what it tells you to run next, once you've read what it changed. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  applyChanges,
  changesBetween,
  describeChanges,
  sharedListOf,
  TEMPLATE,
  type SharedFileChanges,
  type SharedList,
} from "./template.ts";

const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url));

function main(): void {
  const templateSource = templateSourceFrom(process.argv.slice(2));
  refuseUncommittedChanges();

  const templateClone = mkdtempSync(join(tmpdir(), "template-"));
  try {
    // After "--", git reads the address as an address, whatever it starts with.
    runGit(["clone", "--quiet", "--depth", "1", "--", templateSource, templateClone], SITE_ROOT);
    console.log(whatIsApplied(templateSource, templateClone));
    takeSharedFilesFrom(templateClone);
  } finally {
    rmSync(templateClone, { recursive: true, force: true });
  }
}

/** The one argument, an address or a folder, or the usual template when there's none. */
function templateSourceFrom(args: string[]): string {
  const { positionals } = parseArgs({ args, allowPositionals: true });
  return positionals[0] ?? TEMPLATE;
}

/** `git diff` is how a person reads what the update did, so it has to show the template's changes and no
    others. */
function refuseUncommittedChanges(): void {
  const uncommittedChanges = runGit(["status", "--porcelain"], SITE_ROOT);
  if (uncommittedChanges)
    throw new Error("Commit or stash your changes first, so that `git diff` then shows only the template's.");
}

/** Where the template came from and the exact commit that's applied, to say before anything is changed. Git's
    own settings can send an address elsewhere (`url.….insteadOf`): then both are said. */
function whatIsApplied(askedFor: string, templateClone: string): string {
  const fetchedFrom = runGit(["remote", "get-url", "origin"], templateClone);
  const address = fetchedFrom === askedFor ? askedFor : `${askedFor}, which git fetched from ${fetchedFrom}`;
  const commit = runGit(["log", "-1", "--format=%H %s"], templateClone);
  return `Template: ${address}\nCommit:   ${commit}\n`;
}

/** Says what the update will add, change and remove, then does it. */
function takeSharedFilesFrom(templateClone: string): void {
  const changes = changesBetween(templateClone, SITE_ROOT, listToFollow(templateClone));
  const changeLines = describeChanges(changes);
  if (changeLines.length === 0) {
    console.log("Up to date with the template.");
    return;
  }
  console.log(`${changeLines.join("\n")}\n`);
  applyChanges(templateClone, SITE_ROOT, changes);
  console.log(`${changeLines.length} shared files now match the template.`);
  for (const line of [...whatToReadFirst(changes), WHAT_IS_NEXT]) console.log(line);
}

/** The review comes before `npm ci`, which runs whatever the new package.json says to. */
const WHAT_IS_NEXT =
  "Next: read what changed before you run any of it (`git status` lists the new files, `git diff` shows the " +
  "rest). Then `npm ci` and `npm run verify`, and commit once it passes.";

const PACKAGE_FILES = ["package.json", "package-lock.json"];
const WORKFLOWS_FOLDER = ".github/workflows/";

/** Names the files of an update that run with more than the site's pages do, when it touches any. */
function whatToReadFirst({ added, changed, removed }: SharedFileChanges): string[] {
  const touched = [...added, ...changed, ...removed];
  const packageFiles = touched.filter((file) => PACKAGE_FILES.includes(file));
  const workflows = touched.filter((file) => file.startsWith(WORKFLOWS_FOLDER));
  if (packageFiles.length + workflows.length === 0) return [];
  return [
    `Read these first: ${[...packageFiles, ...workflows].join(", ")}. ` +
      "`npm ci` runs what package.json says to, and a workflow runs with your repository's secrets.",
  ];
}

/** The template's list, not this site's: it may share files this site's older list doesn't know of. But what
    this site's list calls its own stays its own, whatever the template's now says. */
function listToFollow(templateClone: string): SharedList {
  const templates = sharedListOf(templateClone);
  const thisSites = sharedListOf(SITE_ROOT);
  return { ...templates, own: [...new Set([...templates.own, ...thisSites.own])] };
}

/** What git printed, trimmed. Throws with git's own message if it fails, or with the system's if there's no
    git to run. */
function runGit(args: string[], cwd: string): string {
  const { status, stdout, stderr, error } = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (error) throw new Error(`git ${args.join(" ")} failed:\n${error.message}`);
  if (status !== 0) throw new Error(`git ${args.join(" ")} failed:\n${stderr.trim()}`);
  return stdout.trim();
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
