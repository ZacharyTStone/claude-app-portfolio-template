/* The template every site is made from, and the files a site shares with it byte for byte:
   `npm run update-template` replaces a site's with the template's.

   This file imports only Node's own modules, and has to stay that way: the update imports the template's copy of
   it from a fresh clone, where nothing is installed. */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

export const TEMPLATE = "https://github.com/ZacharyTStone/claude-app-portfolio-template";

/** The files and folders that are the same in every site made from the template. A folder is mirrored: a file
    the template doesn't have in it is deleted from a site's. Everything else (site.config.ts, README.md,
    wrangler.jsonc, diagrams/, images…) is each site's own. */
const SHARED_NOW = [
  "src",
  "astro.config.ts",
  "scripts/fonts.ts",
  "scripts/fonts",
  "scripts/diagram.ts",
  "scripts/diagram",
  "scripts/diagrams.ts",
  "scripts/template.ts",
  "scripts/update-template.ts",
  "scripts/require-build.ts",
  // Gone: `npm run verify` is a chain of npm scripts. Listed so an update takes it away.
  "scripts/verify.ts",
  "tests/browser",
  "tests/build",
  "tests/components",
  "tests/config",
  "tests/diagrams.test.ts",
  "tests/integrations",
  "tests/sample",
  "tests/scripts",
  "tests/site",
  "tests/app",
  "tests/config",
  "tests/contracts",
  "tests/worker",
  "tests/ask-eval.ts",
  "public/assets/icons",
  "public/assets/fonts",
  ".github/workflows/check.yml",
  ".github/dependabot.yml",
  "AGENTS.md",
  "CLAUDE.md",
  ".editorconfig",
  "eslint.config.js",
  // The violations there were when the linter came. It goes, and this line with it, once it's empty.
  "eslint-suppressions.json",
  ".gitignore",
  ".htmlvalidate.json",
  "knip.jsonc",
  ".node-version",
  ".npmrc",
  ".prettierignore",
  ".prettierrc.json",
  "package.json",
  "package-lock.json",
  "tsconfig.base.json",
  "tsconfig.json",
];

/** What was shared once and has since been deleted or moved. A site made before then still has it, and an
    update deletes it there, as it deletes any shared file the template no longer has. A shared path that goes
    is added here, and never taken out. */
export const RETIRED = [
  "scripts/ja-font.py",
  "tests/template.test.ts",
  "tests/config.test.ts",
  "tests/site.test.ts",
  "tests/sample-site.test.ts",
];

/** Every path an update makes the same as the template's. A site's older copy of the update reads the list
    under this name, and `OWN` under its. */
export const SHARED = [...SHARED_NOW, ...RETIRED];

/** Inside a shared folder, but each site's own: the styles a site adds, and the Japanese fonts, cut down to the
    characters each site's text uses. */
export const OWN = [
  "src/styles/site.css",
  "public/assets/fonts/noto-sans-jp.woff2",
  "public/assets/fonts/noto-serif-jp.woff2",
];

/** What's shared, as a copy of this file lists it: the copy, imported, is a SharedList, which is how the update
    reads the template's own. Paths are from the repo's root, with "/" between folders. */
export type SharedList = {
  SHARED: readonly string[];
  OWN: readonly string[];
};

/** What copying one repo's shared files over another's would do to the other. A file is in one list at most. */
export type SharedFileChanges = {
  /** Files the other repo doesn't have, to copy into it. */
  added: string[];
  /** Files the other repo has with different contents, to overwrite. */
  changed: string[];
  /** Files only the other repo has, to delete from it. */
  removed: string[];
};

/** Every shared file in the repo at `root`: the files `SHARED` names and those in its folders, less the site's
    `OWN`. */
export function sharedFiles(root: string, { SHARED, OWN }: SharedList): string[] {
  const ownFiles = new Set(OWN);
  return SHARED.flatMap((sharedPath) => filesAt(root, sharedPath))
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

/** The `OWN` files the target doesn't have yet. A site's own file is never overwritten, but one it lacks (a new
    one, which the shared code may need: the stylesheet imports `site.css`) starts as the source's copy. */
function ownFilesToStartFrom(sourceRoot: string, targetRoot: string, { OWN }: SharedList): string[] {
  return OWN.filter((file) => existsSync(join(sourceRoot, file)) && !existsSync(join(targetRoot, file)));
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
