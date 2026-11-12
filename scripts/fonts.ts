/* The Japanese fonts, for a site with a Japanese page:

     npm run fonts          rebuild them from the built page's text
     npm run fonts:check    fail if the page uses a character they lack

   Both run scripts/ja-font.py, which needs Python with fonttools and brotli
   (`pip install fonttools brotli`). A site with no Japanese page has no
   such fonts, and needs no Python: this file is what finds that out, from
   the config, before it looks for Python. Otherwise it hands its arguments
   to the Python script, and exits as that does. */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import config from "../site.config.ts";
import { ROOT } from "../src/site/constants.ts";

/** The script that reads the built pages and cuts or checks the fonts. */
const FONT_SCRIPT = join(ROOT, "scripts", "ja-font.py");

/** A language code that means Japanese: "ja", or Japanese with a region or
    script ("ja-JP"), but not another language that starts the same ("jam"). */
const JAPANESE_LANGUAGE_CODE = /^ja(-|$)/i;

function main(): void {
  if (!siteHasJapanesePage()) {
    console.log("No Japanese page, so no Japanese fonts: nothing to do.");
    return;
  }
  const { status, error } = spawnSync(pythonCommand(), [FONT_SCRIPT, ...process.argv.slice(2)], { stdio: "inherit" });
  if (error) console.error(`The Japanese fonts need Python 3 (${error.message}).`);
  // A script that was killed, or never started, has no exit code of its own.
  process.exitCode = status ?? 1;
}

/** Each language in the config is a page, so a Japanese one is a Japanese page. */
function siteHasJapanesePage(): boolean {
  return Object.keys(config.languages).some((languageCode) => JAPANESE_LANGUAGE_CODE.test(languageCode));
}

/** Python 3's name on this system: Windows installs it as plain `python`. */
function pythonCommand(): string {
  return process.platform === "win32" ? "python" : "python3";
}

main();
