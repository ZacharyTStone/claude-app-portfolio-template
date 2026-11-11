/* The Japanese fonts, for a site with a Japanese page:

     npm run fonts          rebuild them from the built page's text
     npm run fonts:check    fail if the page uses a character they lack

   Both run scripts/ja-font.py, which needs Python with fonttools and brotli
   (`pip install fonttools brotli`). A site with no Japanese page has no
   such fonts, and needs no Python. */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import config from "../site.config.ts";
import { ROOT } from "../src/site/constants.ts";

// "ja", or Japanese with a region or script: "ja-JP".
const isJapanese = (code: string) => /^ja(-|$)/i.test(code);

if (!Object.keys(config.languages).some(isJapanese)) {
  console.log("No Japanese page, so no Japanese fonts: nothing to do.");
  process.exit(0);
}
const python = process.platform === "win32" ? "python" : "python3";
const { status, error } = spawnSync(python, [join(ROOT, "scripts", "ja-font.py"), ...process.argv.slice(2)], {
  stdio: "inherit",
});
if (error) console.error(`The Japanese fonts need Python 3 (${error.message}).`);
process.exit(status ?? 1);
