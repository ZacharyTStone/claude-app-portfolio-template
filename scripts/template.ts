/* The template every site is made from, and the files a site shares with
   it byte for byte: `npm run update-template` takes the template's, and the
   site the template is made from copies its own across (sync-template.ts).

   This file imports nothing but Node's own modules, and has to stay that
   way: `npm run update-template` imports the template's copy of it from a
   fresh clone, and the sync workflow reads TEMPLATE from it before anything
   is installed. In both places there is no node_modules to find a package
   in. */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

/** The template repo. */
export const TEMPLATE = "https://github.com/ZacharyTStone/claude-app-portfolio-template";

/** Files and folders that are the same in every site made from the
    template. A folder is mirrored: a file deleted from it in one is
    deleted from the other. Everything else (site.config.ts, README.md,
    wrangler.jsonc, images…) is each site's own. */
export const SHARED = [
  "src",
  "astro.config.ts",
  "scripts/fonts.ts",
  "scripts/ja-font.py",
  // What a diagram is drawn with, and what writes its files. The diagrams
  // themselves (diagrams/) and the files they write are each site's own.
  "scripts/diagram.ts",
  "scripts/diagram",
  "scripts/diagrams.ts",
  "scripts/template.ts",
  "scripts/update-template.ts",
  "scripts/verify.ts",
  "tests/browser",
  "tests/config.test.ts",
  "tests/diagrams.test.ts",
  "tests/sample",
  "tests/sample-site.test.ts",
  "tests/scripts",
  "tests/site.test.ts",
  "tests/template.test.ts",
  // The browser code's unit tests. None here now; listed so the sync takes
  // the template's old ones away, and for the next one written.
  "tests/app",
  "tests/worker",
  "tests/ask-eval.ts",
  "public/assets/icons",
  "public/assets/fonts",
  ".github/workflows/check.yml",
  ".github/dependabot.yml",
  "AGENTS.md",
  "CLAUDE.md",
  ".editorconfig",
  ".gitignore",
  ".htmlvalidate.json",
  ".node-version",
  ".prettierignore",
  ".prettierrc.json",
  "package.json",
  "package-lock.json",
  "tsconfig.base.json",
  "tsconfig.json",
];

/** Inside a shared folder, but each site's own: the styles a site adds, and
    the Japanese fonts, cut down to the characters each site's text uses. */
export const OWN = [
  "src/styles/site.css",
  "public/assets/fonts/noto-sans-jp.woff2",
  "public/assets/fonts/noto-serif-jp.woff2",
];

/** What's shared, as a site's copy of this file lists it. The fields have
    the names of this file's two lists on purpose: a copy of this file,
    imported, is a SharedList. `npm run update-template` reads the
    template's own lists that way, so the two names have to stay: a site's
    older copy of that script looks for them. */
export type SharedList = {
  /** The shared files and folders, as paths from the repo's root with "/"
      between folders: `SHARED`. */
  SHARED: readonly string[];
  /** The files inside those folders that are each site's own: `OWN`. */
  OWN: readonly string[];
};

/** What copying one repo's shared files over another's would do to the
    other. Every file is a path from the repo's root with "/" between
    folders, and is in one list at most. */
export type SharedFileChanges = {
  /** Files the other repo doesn't have, to copy into it. */
  added: string[];
  /** Files the other repo has with different contents, to overwrite. */
  changed: string[];
  /** Files only the other repo has, to delete from it. */
  removed: string[];
};

/** Every shared file in the repo at `root`, as a path from it with "/"
    between folders: the files `SHARED` names and those in its folders, less
    the site's `OWN`. */
export function sharedFiles(root: string, { SHARED, OWN }: SharedList): string[] {
  const ownFiles = new Set(OWN);
  return SHARED.flatMap((sharedPath) => filesAt(root, sharedPath))
    .map(withForwardSlashes)
    .filter((file) => !ownFiles.has(file));
}

/** The files a shared path stands for, as paths from `root`: the file
    itself, every file in and under a folder, or none when the repo has
    nothing there (a folder with no files yet, or a site older than the
    list). */
function filesAt(root: string, sharedPath: string): string[] {
  const fullPath = join(root, sharedPath);
  if (!existsSync(fullPath)) return [];
  if (!statSync(fullPath).isDirectory()) return [sharedPath];
  return readdirSync(fullPath, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

/** A path as the lists write it, whatever the system's separator: on
    Windows, "src\app\main.ts" becomes "src/app/main.ts". */
function withForwardSlashes(path: string): string {
  return path.split(sep).join("/");
}

/** What would make the shared files in `targetRoot` the same as those in
    `sourceRoot`. The `list` is the source's: what it shares is what's
    copied, and what's deleted from the target's shared folders. */
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

/** The `OWN` files the target doesn't have yet. A site's own file is never
    overwritten, but one it lacks (a new one, which the shared code may
    need: the stylesheet imports `site.css`) starts as the source's copy,
    and is the site's to change from then on. */
function ownFilesToStartFrom(sourceRoot: string, targetRoot: string, { OWN }: SharedList): string[] {
  return OWN.filter((file) => existsSync(join(sourceRoot, file)) && !existsSync(join(targetRoot, file)));
}

/** Makes the shared files in `targetRoot` the same as in `sourceRoot`:
    copies what's new or changed, and deletes what's gone. */
export function applyChanges(sourceRoot: string, targetRoot: string, changes: SharedFileChanges): void {
  for (const file of [...changes.added, ...changes.changed]) {
    mkdirSync(dirname(join(targetRoot, file)), { recursive: true });
    cpSync(join(sourceRoot, file), join(targetRoot, file));
  }
  for (const file of changes.removed) rmSync(join(targetRoot, file));
}

/** The changes as the scripts print them, a line a file
    ("changed  src/app/main.ts"), or [] when there are none. */
export function describeChanges({ added, changed, removed }: SharedFileChanges): string[] {
  return [
    ...added.map((file) => `new      ${file}`),
    ...changed.map((file) => `changed  ${file}`),
    ...removed.map((file) => `removed  ${file}`),
  ];
}
