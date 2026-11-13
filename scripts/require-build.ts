/* Stops a check that reads the built site when there is none to read:

     node scripts/require-build.ts && html-validate dist */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OUTPUT, ROOT } from "../src/site/repo.ts";

if (!existsSync(join(ROOT, OUTPUT))) {
  console.error(`There is no ${OUTPUT}/ to check: run \`npm run build\` first.`);
  process.exitCode = 1;
}
