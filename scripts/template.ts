/* The template every site is made from, and the files a site shares with it byte for byte:
   `npm run update-template` replaces a site's with the template's.

   This file imports only Node's own modules, and has to stay that way: a site's older copy of the update imports
   the template's copy of it from a fresh clone, where nothing is installed. */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATE = "https://github.com/ZacharyTStone/claude-app-portfolio-template";

/** Where a repo lists what it shares, from its root. The list is data: an update reads the template's, and
    runs nothing of the template's to get it. */
export const SHARED_LIST_FILE = "scripts/shared-files.json";

/** What a repo shares, as its list has it. Paths are from the repo's root, with "/" between folders. */
export type SharedList = {
  /** The files and folders that are the same in every site made from the template. A folder is mirrored: a
      file the template doesn't have in it is deleted from a site's. Everything else (site.config.ts,
      README.md, wrangler.jsonc, diagrams/, images…) is each site's own. */
  shared: string[];
  /** What was shared once and has since been deleted or moved. A site made before then still has it, and an
      update deletes it there, as it deletes any shared file the template no longer has. A shared path that
      goes is added here, and never taken out. */
  retired: string[];
  /** Inside a shared folder, but each site's own: the styles a site adds, and the Japanese fonts, cut down to
      the characters each site's text uses. */
  own: string[];
};

/** The list of the repo at `root`, read as data. */
export function sharedListOf(root: string): SharedList {
  const file = join(root, SHARED_LIST_FILE);
  if (!existsSync(file)) throw new Error(`${file} isn't there, so there's no saying what this template shares.`);
  const lists: unknown = JSON.parse(readFileSync(file, "utf8"));
  return { shared: pathsIn(lists, "shared"), retired: pathsIn(lists, "retired"), own: pathsIn(lists, "own") };
}

function pathsIn(lists: unknown, name: keyof SharedList): string[] {
  const paths: unknown = isRecord(lists) ? lists[name] : undefined;
  if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string"))
    throw new Error(`${SHARED_LIST_FILE} has no list of paths called "${name}".`);
  return paths;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** This repo's own list, under the two names a site's older copy of the update reads when it imports the
    template's copy of this file: every path an update makes the same as the template's, and each site's own. */
const thisRepos = sharedListOf(fileURLToPath(new URL("..", import.meta.url)));
export const SHARED: readonly string[] = [...thisRepos.shared, ...thisRepos.retired];
export const OWN: readonly string[] = thisRepos.own;

/** What copying one repo's shared files over another's would do to the other. A file is in one list at most. */
export type SharedFileChanges = {
  /** Files the other repo doesn't have, to copy into it. */
  added: string[];
  /** Files the other repo has with different contents, to overwrite. */
  changed: string[];
  /** Files only the other repo has, to delete from it. */
  removed: string[];
};

/** Every shared file in the repo at `root`: the files the list names and those in its folders, less each
    site's own. */
export function sharedFiles(root: string, { shared, retired, own }: SharedList): string[] {
  const ownFiles = new Set(own);
  return [...shared, ...retired]
    .flatMap((sharedPath) => filesAt(root, sharedPath))
    .map(withForwardSlashes)
    .filter((file) => !ownFiles.has(file));
}

/** The files a shared path stands for: the file itself, every file in and under a folder, or none when the
    repo has nothing there. */
function filesAt(root: string, sharedPath: string): string[] {
  const fullPath = join(root, sharedPath);
  if (!existsSync(fullPath)) return [];
  if (!statSync(fullPath).isDirectory()) return [sharedPath];
  return readdirSync(fullPath, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

/** A path as the lists write it, whatever the system's separator: on Windows, "src\app\main.ts" becomes
    "src/app/main.ts". */
function withForwardSlashes(path: string): string {
  return path.split(sep).join("/");
}

/** What would make the shared files in `targetRoot` the same as those in `sourceRoot`. The `list` is the
    source's: what it shares is what's copied, and what's deleted from the target's shared folders. */
export function changesBetween(sourceRoot: string, targetRoot: string, list: SharedList): SharedFileChanges {
  const sourceFiles = new Set(sharedFiles(sourceRoot, list));
  const targetFiles = new Set(sharedFiles(targetRoot, list));
  const inSourceOnly = [...sourceFiles].filter((file) => !targetFiles.has(file));
  const inTargetOnly = [...targetFiles].filter((file) => !sourceFiles.has(file));
  const inBoth = [...sourceFiles].filter((file) => targetFiles.has(file));
  return {
    added: [...inSourceOnly, ...ownFilesToStartFrom(sourceRoot, targetRoot, list)],
    changed: inBoth.filter((file) => !hasSameContents(join(sourceRoot, file), join(targetRoot, file))),
    removed: inTargetOnly,
  };
}

function hasSameContents(fileA: string, fileB: string): boolean {
  return readFileSync(fileA).equals(readFileSync(fileB));
}

/** The `own` files the target doesn't have yet. A site's own file is never overwritten, but one it lacks (a new
    one, which the shared code may need: the stylesheet imports `site.css`) starts as the source's copy. */
function ownFilesToStartFrom(sourceRoot: string, targetRoot: string, { own }: SharedList): string[] {
  return own.filter((file) => existsSync(join(sourceRoot, file)) && !existsSync(join(targetRoot, file)));
}

export function applyChanges(sourceRoot: string, targetRoot: string, changes: SharedFileChanges): void {
  for (const file of [...changes.added, ...changes.changed]) {
    mkdirSync(dirname(join(targetRoot, file)), { recursive: true });
    cpSync(join(sourceRoot, file), join(targetRoot, file));
  }
  for (const file of changes.removed) rmSync(join(targetRoot, file));
}

/** The changes as the update prints them, a line a file: "changed  src/app/main.ts". */
export function describeChanges({ added, changed, removed }: SharedFileChanges): string[] {
  return [
    ...added.map((file) => `new      ${file}`),
    ...changed.map((file) => `changed  ${file}`),
    ...removed.map((file) => `removed  ${file}`),
  ];
}
