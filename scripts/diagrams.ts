/* `npm run diagrams` writes each diagram (diagrams/*.ts) as SVG files in public/assets, `npm run diagrams NAME`
   writes one, and `npm run diagrams -- --check` writes nothing and fails if a file isn't what its diagram draws.

   A file in a folder inside diagrams/ is a part that diagrams share, not a diagram. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { svgOf, type Diagram } from "./diagram.ts";

/** Where a site's diagrams have always imported this type from: it's the kit's now. */
export type { Diagram } from "./diagram.ts";

const DIAGRAMS = "diagrams";
const ASSETS = join("public", "assets");

type WrittenFile = [path: string, text: string];

/** Every file the site's diagrams make (or only the diagram called `only`): its path from `root`, then its
    text. */
export async function diagramFiles(root: string, only?: string): Promise<Map<string, string>> {
  const diagrams = await diagramsIn(join(root, DIAGRAMS));
  const wanted = diagrams.filter((diagram) => only === undefined || diagram.name === only);
  return new Map(wanted.flatMap(filesOf));
}

async function diagramsIn(folder: string): Promise<Array<Diagram<unknown>>> {
  if (!existsSync(folder)) return [];
  const files = readdirSync(folder)
    .filter((file) => file.endsWith(".ts"))
    .sort();
  const modules = await Promise.all(files.map((file) => import(pathToFileURL(join(folder, file)).href)));
  return modules.map((module: { default: Diagram<unknown> }) => module.default);
}

/** A diagram's files: in each language, the picture as it moves and the picture still. The first language's
    have no code in their names (NAME.svg, NAME-still.svg), another's have its own (NAME-ja.svg). */
function filesOf(diagram: Diagram<unknown>): WrittenFile[] {
  return Object.entries(diagram.words).flatMap(([language, words], i): WrittenFile[] => {
    const drawing = diagram.draw(words);
    const name = i === 0 ? diagram.name : `${diagram.name}-${language}`;
    return [
      [join(ASSETS, `${name}.svg`), svgOf(drawing, "moving")],
      [join(ASSETS, `${name}-still.svg`), svgOf(drawing, "still")],
    ];
  });
}

/** The files that aren't on disk as their diagrams draw them now. */
export async function staleDiagramFiles(root: string): Promise<string[]> {
  const files = await diagramFiles(root);
  return [...files].flatMap(([path, text]) => {
    const onDisk = join(root, path);
    return existsSync(onDisk) && readFileSync(onDisk, "utf8") === text ? [] : [path];
  });
}

async function check(root: string): Promise<void> {
  const stale = await staleDiagramFiles(root);
  if (stale.length === 0) {
    console.log("The diagrams' files are up to date.");
    return;
  }
  console.error(
    `These aren't what their diagrams draw now. Run "npm run diagrams" and commit them:\n  ${stale.join("\n  ")}`,
  );
  process.exit(1);
}

async function write(root: string, only?: string): Promise<void> {
  const files = await diagramFiles(root, only);
  if (files.size === 0)
    throw new Error(only ? `No diagram in ${DIAGRAMS}/ is called "${only}"` : `No diagrams in ${DIAGRAMS}/`);
  for (const [path, text] of files) writeFileSync(join(root, path), text);
  console.log(`Wrote ${files.size} files:\n  ${[...files.keys()].join("\n  ")}`);
}

if (import.meta.main) {
  const root = process.cwd();
  if (process.argv.includes("--check")) await check(root);
  else await write(root, process.argv[2]);
}
