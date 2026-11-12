/* `npm run update-template`: replaces this site's shared files (listed in
   scripts/template.ts) with the template's latest, and leaves the rest
   (your config, README, pictures, Japanese fonts) as it is.

     npm run update-template
     npm run update-template -- <the template's address or folder, if not the usual one>

   It needs git, and a working tree with nothing uncommitted. It clones the
   template into a temporary folder, copies across what differs, prints a
   line for each file and what to do next, and deletes the clone. It commits
   nothing: `git diff` shows what it did.

   Like scripts/template.ts, this file imports only Node's own modules (and
   that file), so that it runs where no package is installed: `npm ci` is
   what it tells you to run next. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { applyChanges, changesBetween, describeChanges, TEMPLATE, type SharedList } from "./template.ts";

/** This site's repo: the folder above scripts/. */
const SITE_ROOT = fileURLToPath(new URL("..", import.meta.url));

async function main(): Promise<void> {
  const templateSource = templateSourceFrom(process.argv.slice(2));
  refuseInTheSourceSite();
  refuseUncommittedChanges();

  const templateClone = mkdtempSync(join(tmpdir(), "template-"));
  try {
    runGit(["clone", "--quiet", "--depth", "1", templateSource, templateClone], SITE_ROOT);
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
  } finally {
    rmSync(templateClone, { recursive: true, force: true });
  }
}

/** Where to clone the template from: the one argument, an address or a
    folder, or the usual template when there's none. */
function templateSourceFrom(args: string[]): string {
  const { positionals } = parseArgs({ args, allowPositionals: true });
  return positionals[0] ?? TEMPLATE;
}

/** In the site the template is made from, an update would put the
    template's older copy of the shared code over the newer one. Only that
    site has scripts/sync-template.ts, which is how it's told apart. */
function refuseInTheSourceSite(): void {
  const isSourceSite = existsSync(join(SITE_ROOT, "scripts", "sync-template.ts"));
  if (isSourceSite)
    throw new Error(
      "This is the site the template is made from: its shared files go the other way (scripts/sync-template.ts).",
    );
}

/** The update commits nothing: `git diff` is how a person reads what it
    did, so it has to show the template's changes and no others. */
function refuseUncommittedChanges(): void {
  const uncommittedChanges = runGit(["status", "--porcelain"], SITE_ROOT);
  if (uncommittedChanges)
    throw new Error("Commit or stash your changes first, so that `git diff` then shows only the template's.");
}

/** The template's own SHARED and OWN, from the scripts/template.ts in its
    clone: its list, not this site's, because it may name files this site's
    older copy doesn't yet. Importing the file runs it, which asks for no
    more trust than the update does: the template's code is about to replace
    this site's. */
function sharedListOf(templateClone: string): Promise<SharedList> {
  return import(pathToFileURL(join(templateClone, "scripts", "template.ts")).href);
}

/** Runs git in `cwd` and returns what it printed, trimmed. Throws, with
    git's own message, if it fails, or with the system's if there's no git
    to run (git then printed nothing: `stderr` is undefined). */
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
