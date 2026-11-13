import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after } from "node:test";

/** A file's text, by its path from its folder's root. */
export type Files = Record<string, string>;

/** What makes folders with files in them, under one folder of the system's temporary ones that's deleted when
    the file's tests are over. */
export function scratchFolders(prefix: string): (name: string, files: Files) => string {
  const scratch = mkdtempSync(join(tmpdir(), prefix));
  after(() => rmSync(scratch, { recursive: true, force: true }));
  return (name, files) => {
    const root = join(scratch, name);
    mkdirSync(root, { recursive: true });
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    }
    return root;
  };
}

export const readText = (root: string, file: string): string => readFileSync(join(root, file), "utf8");
