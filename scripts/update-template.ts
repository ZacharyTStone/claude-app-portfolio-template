/* `npm run update-template`: replaces this site's shared files (listed in
   scripts/template.ts) with the template's latest, and leaves the rest
   (your config, README, pictures, Japanese fonts) as it is. */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyChanges, changesBetween, describe, TEMPLATE, type SharedList } from "./template.ts";

const HERE = fileURLToPath(new URL("..", import.meta.url));

function git(args: string[], cwd: string): string {
  const { status, stdout, stderr } = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (status !== 0) throw new Error(`git ${args.join(" ")} failed:\n${stderr.trim()}`);
  return stdout.trim();
}

// npm run update-template [-- <the template's address or folder, if not the usual one>]
async function main(): Promise<void> {
  const source = process.argv[2] ?? TEMPLATE;
  if (existsSync(join(HERE, "scripts", "sync-template.ts")))
    throw new Error(
      "This is the site the template is made from: its shared files go the other way (scripts/sync-template.ts).",
    );
  if (git(["status", "--porcelain"], HERE))
    throw new Error("Commit or stash your changes first, so that `git diff` then shows only the template's.");

  const template = mkdtempSync(join(tmpdir(), "template-"));
  try {
    git(["clone", "--quiet", "--depth", "1", source, template], HERE);
    const commit = git(["log", "-1", "--format=%h %s"], template);
    // The template's own list, which may name files this site's doesn't yet.
    const list = (await import(pathToFileURL(join(template, "scripts", "template.ts")).href)) as SharedList;
    const changes = changesBetween(template, HERE, list);
    const lines = describe(changes);
    if (!lines.length) {
      console.log(`Up to date with the template (${commit}).`);
      return;
    }
    applyChanges(template, HERE, changes);
    console.log(`${lines.join("\n")}\n`);
    console.log(`${lines.length} shared files now match the template, as of ${commit}.`);
    console.log("Next: `npm ci`, then `npm run verify`. `git diff` shows what changed; commit it once it passes.");
  } finally {
    rmSync(template, { recursive: true, force: true });
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
