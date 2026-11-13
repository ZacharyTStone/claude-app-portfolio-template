/* This repo's own site, as built (dist/). */
import { existsSync } from "node:fs";
import { join } from "node:path";
import config from "../../site.config.ts";
import { OUTPUT, ROOT } from "../../src/site/repo.ts";
import { builtSite, testBuiltSite } from "./built-site.ts";

const BUILT_FOLDER = join(ROOT, OUTPUT);
if (!existsSync(BUILT_FOLDER)) throw new Error(`There is no ${OUTPUT}/ to check: run \`npm run build\` first.`);

testBuiltSite(builtSite("this site", BUILT_FOLDER, config));
