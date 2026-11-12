/* Writes the site's diagrams (diagrams/*.ts) as SVG files in
   public/assets: `npm run diagrams`, or `npm run diagrams NAME` for one.
   With --check it writes nothing, and fails if a file isn't what its
   diagram draws now (tests/diagrams.test.ts checks the same).

   Files in a folder inside diagrams/ are parts that diagrams share, not
   diagrams.

   A diagram's file exports one thing, by default:

       export default {
         name: "how-it-works",
         words: { en: { … }, ja: { … } },
         draw: (words) => ({ width: 1600, height: 900, shapes: [ … ] }),
       } satisfies Diagram<Words>;

   Each language gets two files, the picture as it moves and the picture
   still. The first language's are NAME.svg and NAME-still.svg; another's
   have its code: NAME-ja.svg, NAME-ja-still.svg. An `image` in the config
   names the first as its `src` and the second as its `still`.

   Like the other scripts, this runs on Node alone. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { svgOf, type Drawing } from "./diagram.ts";

/** A diagram: its files' name, its wording in each language, and how it's
    drawn with one language's wording. */
export type Diagram<Words> = {
  /** What its files are called, without ".svg". */
  name: string;
  /** Its wording, by language code. The first is the one whose files have
      no code in their names. */
  words: Record<string, Words>;
  /** The picture, in one language's wording. */
  draw(words: Words): Drawing;
};

/** Where the diagrams are written, and where their files go. */
const DIAGRAMS = "diagrams";
const ASSETS = join("public", "assets");

/** Every file the site's diagrams make (or only the diagram called
    `only`), by its path from `root`: the path, then the file's text. */
export async function diagramFiles(root: string, only?: string): Promise<Map<string, string>> {
  const folder = join(root, DIAGRAMS);
  const files = new Map<string, string>();
  if (!existsSync(folder)) return files;
  for (const file of readdirSync(folder).sort()) {
    if (!file.endsWith(".ts")) continue;
    const { default: diagram } = (await import(pathToFileURL(join(folder, file)).href)) as {
      default: Diagram<unknown>;
    };
    if (only !== undefined && diagram.name !== only) continue;
    Object.entries(diagram.words).forEach(([language, words], i) => {
      const drawing = diagram.draw(words);
      const name = i === 0 ? diagram.name : `${diagram.name}-${language}`;
      files.set(join(ASSETS, `${name}.svg`), svgOf(drawing, "moving"));
      files.set(join(ASSETS, `${name}-still.svg`), svgOf(drawing, "still"));
    });
  }
  return files;
}

/** The files that aren't on disk as their diagrams draw them now. */
export async function staleDiagramFiles(root: string): Promise<string[]> {
  const files = await diagramFiles(root);
  return [...files].flatMap(([path, text]) => {
    const onDisk = join(root, path);
    return existsSync(onDisk) && readFileSync(onDisk, "utf8") === text ? [] : [path];
  });
}

if (import.meta.main) {
  const root = process.cwd();
  if (process.argv.includes("--check")) {
    const stale = await staleDiagramFiles(root);
    if (stale.length > 0) {
      console.error(
        `These aren't what their diagrams draw now. Run "npm run diagrams" and commit them:\n  ${stale.join("\n  ")}`,
      );
      process.exit(1);
    }
    console.log("The diagrams' files are up to date.");
  } else {
    // `npm run diagrams NAME` writes only that one.
    const only = process.argv[2];
    const files = await diagramFiles(root, only);
    if (files.size === 0)
      throw new Error(only ? `No diagram in ${DIAGRAMS}/ is called "${only}"` : `No diagrams in ${DIAGRAMS}/`);
    for (const [path, text] of files) writeFileSync(join(root, path), text);
    console.log(`Wrote ${files.size} files:\n  ${[...files.keys()].join("\n  ")}`);
  }
}
