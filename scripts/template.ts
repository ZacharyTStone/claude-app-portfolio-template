/* The template every site is made from, and the files a site shares with it byte for byte:
   `npm run update-template` replaces a site's with the template's.

   This file imports only Node's own modules, and has to stay that way: a site's older copy of the update imports
   the template's copy of it from a fresh clone, where nothing is installed. */
import { cpSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, posix, relative, sep, win32 } from "node:path";
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
  if (!isFileAt(root, SHARED_LIST_FILE))
    throw new Error(`${file} isn't there, so there's no saying what this template shares.`);
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
export function sharedFiles(root: string, list: SharedList): string[] {
  refuseUnsafeList(list);
  const ownFiles = new Set(list.own);
  return [...list.shared, ...list.retired]
    .flatMap((sharedPath) => filesAt(root, sharedPath))
    .filter((file) => !ownFiles.has(file));
}

/** What's each site's own outright: its words, its deploy settings, its README, its diagrams, and the questions
    its Ask is tested with. (A list's `own` files are a site's too, but sit inside shared folders.) */
const EVERY_SITES_OWN = ["site.config.ts", "wrangler.jsonc", "README.md", "diagrams", "tests/ask-questions.json"];

/** A list is the template's word for what an update may overwrite and delete, so it's held to the repo, and
    kept off what's a site's own: every path in it is a plain one, from the repo's root down, and none it
    shares is, holds or is inside a site's own. */
function refuseUnsafeList({ shared, retired, own }: SharedList): void {
  for (const path of [...shared, ...retired, ...own]) refuseUnlessPlain(path);
  for (const path of [...shared, ...retired]) refuseIfASitesOwn(path, own);
}

/** Whether a path is a folder or file, or inside the folder. Names are compared as a file system that ignores
    case would: on one, "SITE.CONFIG.TS" is the site's config. */
function isAtOrUnder(path: string, folder: string): boolean {
  const [lowerPath, lowerFolder] = [path.toLowerCase(), folder.toLowerCase()];
  return lowerPath === lowerFolder || lowerPath.startsWith(`${lowerFolder}/`);
}

function refuseIfASitesOwn(path: string, own: string[]): void {
  const isOrHoldsASitesOwn = EVERY_SITES_OWN.some((yours) => isAtOrUnder(path, yours) || isAtOrUnder(yours, path));
  const isOneOfItsOwnFiles = own.some((yours) => isAtOrUnder(path, yours));
  if (isOrHoldsASitesOwn || isOneOfItsOwnFiles)
    throw new Error(`"${path}" is each site's own, or holds what is: an update leaves it alone.`);
}

/** How Windows also spells a folder's name: with dots or spaces after it, or by its short name. */
const isGitFolder = (name: string): boolean => [".git", "git~1"].includes(name.toLowerCase().replace(/[. ]+$/, ""));

/** Refuses a path that could lead out of the repo, or into its .git: one with "..", one that starts from the
    system's root or a drive, one with a backslash (the lists write "/"). */
function refuseUnlessPlain(path: string): void {
  const names = path.split("/");
  const startsElsewhere = posix.isAbsolute(path) || win32.isAbsolute(path) || /[\\:]/.test(path);
  const staysInside = names.every((name) => name !== "" && name !== "." && name !== "..");
  if (startsElsewhere || !staysInside)
    throw new Error(`"${path}" isn't a plain path inside the repo: an update follows no other.`);
  if (names.some(isGitFolder)) throw new Error(`"${path}" is in a repo's .git, which an update never touches.`);
}

/** The files a shared path stands for: the file itself, every file in and under a folder, or none when the
    repo has nothing there. */
function filesAt(root: string, sharedPath: string): string[] {
  refuseLinksOnTheWayTo(root, sharedPath);
  const fullPath = join(root, sharedPath);
  const found = lstatSync(fullPath, { throwIfNoEntry: false });
  if (!found) return [];
  if (!found.isDirectory()) return [sharedPath];
  return readdirSync(fullPath, { recursive: true, withFileTypes: true }).flatMap((entry) => {
    const file = withForwardSlashes(relative(root, join(entry.parentPath, entry.name)));
    if (entry.isSymbolicLink()) throw aLinkIsRefused(join(root, file));
    if (file.split("/").some(isGitFolder))
      throw new Error(`${join(root, file)} is in a .git, which an update never touches.`);
    return entry.isFile() ? [file] : [];
  });
}

/** An update reads and writes real files in real folders, so that what it touches is where its path says: a
    link, in the template or in the site, could stand for anywhere on the machine. Refuses a path any part of
    which is one. */
function refuseLinksOnTheWayTo(root: string, path: string): void {
  const names = path.split("/");
  names.forEach((_, depth) => {
    const partWay = join(root, ...names.slice(0, depth + 1));
    if (lstatSync(partWay, { throwIfNoEntry: false })?.isSymbolicLink()) throw aLinkIsRefused(partWay);
  });
}

const aLinkIsRefused = (link: string): Error =>
  new Error(`${link} is a link to somewhere else: an update follows none.`);

/** Whether there's a real file there. */
function isFileAt(root: string, path: string): boolean {
  refuseLinksOnTheWayTo(root, path);
  return lstatSync(join(root, path), { throwIfNoEntry: false })?.isFile() ?? false;
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
  return own.filter((file) => isFileAt(sourceRoot, file) && !isFileAt(targetRoot, file));
}

/** Makes the changes, or none of them: every file is checked before the first is touched. */
export function applyChanges(sourceRoot: string, targetRoot: string, changes: SharedFileChanges): void {
  const copied = [...changes.added, ...changes.changed];
  for (const file of [...copied, ...changes.removed]) {
    refuseUnlessPlain(file);
    refuseLinksOnTheWayTo(targetRoot, file);
  }
  for (const file of copied) refuseLinksOnTheWayTo(sourceRoot, file);
  for (const file of copied) {
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
