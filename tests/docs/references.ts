/* What a Markdown document names, for the tests that hold the docs true of
   the repo: the files its inline code names, where its links go, and the
   npm scripts its commands run.

   It reads one convention: inline code that names a file names it by its
   path from the repo's root (`src/config/blocks.ts`, `package.json`). A
   fenced block is an example, so only its npm commands are read. */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

const FENCED_BLOCK = /^[ \t]*```[\s\S]*?^[ \t]*```/gm;
const INLINE_CODE = /`([^`\n]+)`/g;
const LINK_TARGET = /\]\(([^)\s]+)\)/g;
const HEADING = /^#{1,6}[ \t]+(.+)$/gm;

// `npm run build` and `npm test` run a script; `npm ci` does not.
const NPM_SCRIPT = /\bnpm (?:run ([\w:-]+)|(test)\b)/g;

// "src/app/", "tests/site.test.ts", "docs": names with a slash between or after them.
const PATH_WITH_A_SLASH = /^[\w.-]+(?:\/[\w.[\]-]+)*\/?$/;
// A file at the root is told from a field ("home.prompts") by its extension.
const ROOT_FILE = /^[\w.-]+\.(?:ts|json|jsonc|md|yml)$/;
const NOT_IN_THE_REPO = /^(?:dist|node_modules|\.\.?)(?:\/|$)/;
const ANOTHER_SITE = /^(?:https?:|mailto:)/;

const textOf = (file: string): string => readFileSync(join(ROOT, file), "utf8");
const proseOf = (file: string): string => textOf(file).replace(FENCED_BLOCK, "");
const unique = (values: string[]): string[] => [...new Set(values)];
const firstGroups = (text: string, pattern: RegExp): string[] =>
  [...text.matchAll(pattern)].map((match) => match[1] ?? "");

function isPathFromRoot(code: string): boolean {
  if (NOT_IN_THE_REPO.test(code)) return false;
  return code.includes("/") ? PATH_WITH_A_SLASH.test(code) : ROOT_FILE.test(code);
}

/** The files and folders `doc` names in inline code, as paths from the
    repo's root with no slash at the end. */
export function pathsNamedIn(doc: string): string[] {
  const paths = firstGroups(proseOf(doc), INLINE_CODE).filter(isPathFromRoot);
  return unique(paths.map((path) => path.replace(/\/$/, "")));
}

export const isMissing = (path: string): boolean => !existsSync(join(ROOT, path));

/** The npm scripts `doc` runs, in prose or in a fenced block, that
    package.json doesn't have. */
export function missingNpmScripts(doc: string): string[] {
  const { scripts } = JSON.parse(textOf("package.json")) as { scripts: Record<string, string> };
  const named = [...textOf(doc).matchAll(NPM_SCRIPT)].map(([, run, test]) => run ?? test ?? "");
  return unique(named).filter((script) => !(script in scripts));
}

/** A heading as GitHub makes its anchor: "What Ask can cost" is
    "what-ask-can-cost". */
const anchorOf = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replaceAll(" ", "-");

const anchorsIn = (file: string): string[] => firstGroups(proseOf(file), HEADING).map(anchorOf);

/** Whether a link written in `doc` arrives: at a file in the repo, and at
    a heading in it when the link names one ("ask.md#what-ask-can-cost"). */
function arrives(doc: string, target: string): boolean {
  const [file = "", anchor] = target.split("#");
  const linkedFile = file === "" ? doc : join(dirname(doc), file);
  if (isMissing(linkedFile)) return false;
  return anchor === undefined || anchorsIn(linkedFile).includes(anchor);
}

/** The links in `doc` to a file or a heading that isn't there. Links to
    other sites aren't followed. */
export function brokenLinks(doc: string): string[] {
  const withoutInlineCode = proseOf(doc).replace(INLINE_CODE, "");
  const targets = firstGroups(withoutInlineCode, LINK_TARGET).filter((target) => !ANOTHER_SITE.test(target));
  return unique(targets).filter((target) => !arrives(doc, target));
}
