/* `npm run update-template` replaces this site's shared files (scripts/template.ts lists them) with the
   template's latest, and leaves the rest (your config, README, pictures, Japanese fonts) as it is.

     npm run update-template
     npm run update-template -- <the template's address or folder, if not the usual one>

   It needs git, and a working tree with nothing uncommitted. It commits nothing: `git diff` shows what it did.

   It imports only Node's own modules and scripts/template.ts, so that it runs where no package is installed:
   `npm ci` is what it tells you to run next. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { applyChanges, changesBetween, describeChanges, sharedListOf, TEMPLATE, type SharedList } from "./template.ts";

const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url));

function main(): void {
  const templateSource = templateSourceFrom(process.argv.slice(2));
  refuseUncommittedChanges();

  const templateClone = mkdtempSync(join(tmpdir(), "template-"));
  try {
    runGit(["clone", "--quiet", "--depth", "1", templateSource, templateClone], SITE_ROOT);
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

function takeSharedFilesFrom(templateClone: string): void {
  const templateCommit = runGit(["log", "-1", "--format=%h %s"], templateClone);
  const changes = changesBetween(templateClone, SITE_ROOT, listToFollow(templateClone));
  const changeLines = describeChanges(changes);
  if (changeLines.length === 0) {
    console.log(`Up to date with the template (${templateCommit}).`);
    return;
  }
  applyChanges(templateClone, SITE_ROOT, changes);
  console.log(`${changeLines.join("\n")}\n`);
  console.log(`${changeLines.length} shared files now match the template, as of ${templateCommit}.`);
  console.log("Next: `npm ci`, then `npm run verify`. `git diff` shows what changed; commit it once it passes.");
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
