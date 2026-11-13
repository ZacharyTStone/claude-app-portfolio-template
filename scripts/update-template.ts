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
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { applyChanges, changesBetween, describeChanges, TEMPLATE, type SharedList } from "./template.ts";

const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url));

async function main(): Promise<void> {
  const templateSource = templateSourceFrom(process.argv.slice(2));
  refuseUncommittedChanges();

  const templateClone = mkdtempSync(join(tmpdir(), "template-"));
  try {
    runGit(["clone", "--quiet", "--depth", "1", templateSource, templateClone], SITE_ROOT);
    await takeSharedFilesFrom(templateClone);
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

async function takeSharedFilesFrom(templateClone: string): Promise<void> {
  const templateCommit = runGit(["log", "-1", "--format=%h %s"], templateClone);
  const changes = changesBetween(templateClone, SITE_ROOT, await sharedListOf(templateClone));
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

/** The template's own SHARED and OWN, not this site's: its list may name files this site's older copy doesn't
    yet. Importing the template's file runs it, which asks for no more trust than the update does: the
    template's code is about to replace this site's. */
function sharedListOf(templateClone: string): Promise<SharedList> {
  return import(pathToFileURL(join(templateClone, "scripts", "template.ts")).href);
}

/** What git printed, trimmed. Throws with git's own message if it fails, or with the system's if there's no
    git to run. */
function runGit(args: string[], cwd: string): string {
  const { status, stdout, stderr, error } = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (error) throw new Error(`git ${args.join(" ")} failed:\n${error.message}`);
  if (status !== 0) throw new Error(`git ${args.join(" ")} failed:\n${stderr.trim()}`);
  return stdout.trim();
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
