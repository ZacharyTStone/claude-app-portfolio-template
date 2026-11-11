/* The template every site is made from, and the files a site shares with
   it byte for byte: `npm run update-template` takes the template's, and the
   site the template is made from copies its own across (sync-template.ts). */
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
  "scripts/template.ts",
  "scripts/update-template.ts",
  "scripts/verify.ts",
  "tests/browser",
  "tests/config.test.ts",
  "tests/sample",
  "tests/sample-site.test.ts",
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

/** What's shared, as a site's copy of this file lists it. */
export type SharedList = { SHARED: readonly string[]; OWN: readonly string[] };

/** What copying one repo's shared files over another's would do. */
export type Changes = { added: string[]; changed: string[]; removed: string[] };

/** Every shared file in `root`, relative to it, with "/" between folders. */
export function sharedFiles(root: string, { SHARED, OWN }: SharedList): string[] {
  const own = new Set(OWN);
  return SHARED.flatMap((path) => filesIn(root, path))
    .map((file) => file.split(sep).join("/"))
    .filter((file) => !own.has(file));
}

function filesIn(root: string, path: string): string[] {
  const full = join(root, path);
  if (!existsSync(full)) return [];
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)));
}

/** How the shared files in `to` differ from those in `from`. One of a
    site's own files that `to` doesn't have yet (a new one, which the shared
    code may need) starts as `from`'s. */
export function changesBetween(from: string, to: string, list: SharedList): Changes {
  const ours = new Set(sharedFiles(from, list));
  const theirs = new Set(sharedFiles(to, list));
  const same = (file: string) => readFileSync(join(from, file)).equals(readFileSync(join(to, file)));
  const missingOwn = list.OWN.filter((file) => existsSync(join(from, file)) && !existsSync(join(to, file)));
  return {
    added: [...[...ours].filter((file) => !theirs.has(file)), ...missingOwn],
    changed: [...ours].filter((file) => theirs.has(file) && !same(file)),
    removed: [...theirs].filter((file) => !ours.has(file)),
  };
}

/** Makes the shared files in `to` the same as in `from`. */
export function applyChanges(from: string, to: string, { added, changed, removed }: Changes): void {
  for (const file of [...added, ...changed]) {
    mkdirSync(dirname(join(to, file)), { recursive: true });
    cpSync(join(from, file), join(to, file));
  }
  for (const file of removed) rmSync(join(to, file));
}

/** The changes, a line a file ("changed  src/app/main.ts"), or [] for none. */
export const describe = ({ added, changed, removed }: Changes): string[] => [
  ...added.map((file) => `new      ${file}`),
  ...changed.map((file) => `changed  ${file}`),
  ...removed.map((file) => `removed  ${file}`),
];
