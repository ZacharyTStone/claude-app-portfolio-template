/* Everything CI checks, in order, stopping at the first that fails:

     npm run verify

   Each step is an npm script, to run again by itself once it's fixed. The
   browser checks need Playwright's Chromium (`npx playwright install
   chromium`); a site with a Japanese page also needs Python with fonttools
   and brotli (`pip install fonttools brotli`), for its fonts' check. */
import { spawnSync } from "node:child_process";

// The tests, the HTML check and the font check read what the build wrote.
const STEPS: Array<{ what: string; script: string }> = [
  { what: "The code is formatted", script: "lint" },
  { what: "It type-checks, the .astro components too", script: "typecheck" },
  { what: "The site builds", script: "build" },
  { what: "The HTML is valid", script: "lint:html" },
  { what: "The unit tests pass, and a sample site builds", script: "test" },
  { what: "The Japanese fonts, if there's a Japanese page, have every character it uses", script: "fonts:check" },
  { what: "The pages work in a browser", script: "test:browser" },
];

// The npm that's running this, or the one on the PATH.
const npm = process.env.npm_execpath;
const run = (args: string[]) =>
  npm?.endsWith(".js")
    ? spawnSync(process.execPath, [npm, ...args], { stdio: "inherit" })
    : spawnSync("npm", args, { stdio: "inherit", shell: process.platform === "win32" });

const started = Date.now();
const seconds = (since: number) => `${((Date.now() - since) / 1000).toFixed(1)} s`;
for (const [i, { what, script }] of STEPS.entries()) {
  const command = `npm run ${script}`;
  console.log(`\n[${i + 1}/${STEPS.length}] ${what}: ${command}`);
  const since = Date.now();
  const { status, error } = run(["run", "--silent", script]);
  if (status !== 0) {
    console.error(`\nverify stopped at ${i + 1}/${STEPS.length}, "${what}"${error ? ` (${error.message})` : ""}.`);
    console.error(`Fix it, check with \`${command}\`, then run \`npm run verify\` again.`);
    process.exit(status || 1);
  }
  console.log(`[${i + 1}/${STEPS.length}] done in ${seconds(since)}`);
}
console.log(`\nverify: all ${STEPS.length} steps passed in ${seconds(started)}.`);
