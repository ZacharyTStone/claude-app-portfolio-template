/* Everything CI checks, in order, stopping at the first that fails:

     npm run verify

   Each step is an npm script, to run again by itself once it's fixed. The
   browser checks need Playwright's Chromium (`npx playwright install
   chromium`); a site with a Japanese page also needs Python with fonttools
   and brotli (`pip install fonttools brotli`), for its fonts' check.

   It prints a line before each step and one after, with the step's own
   output between them, and at the end how long it all took. When a step
   fails it says which, and how to check it again, and exits with that
   step's exit code. */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

/** One of the checks. */
type VerifyStep = {
  /** What's true of the repo once the step passes, as its progress line
      says it: "The site builds". */
  checksThat: string;
  /** The npm script that checks it, which a person runs by itself once
      they've fixed what it found: "build" for `npm run build`. */
  npmScript: string;
};

/** The steps, in CI's order. The build comes before the HTML check, the
    tests and the font check because they read what it wrote. */
const STEPS: VerifyStep[] = [
  { checksThat: "The code is formatted", npmScript: "lint" },
  { checksThat: "It type-checks, the .astro components too", npmScript: "typecheck" },
  { checksThat: "The site builds", npmScript: "build" },
  { checksThat: "The HTML is valid", npmScript: "lint:html" },
  { checksThat: "The unit tests pass, and a sample site builds", npmScript: "test" },
  {
    checksThat: "The Japanese fonts, if there's a Japanese page, have every character it uses",
    npmScript: "fonts:check",
  },
  { checksThat: "The pages work in a browser", npmScript: "test:browser" },
];

const MILLISECONDS_IN_A_SECOND = 1000;

function main(): void {
  const verifyStartedAt = Date.now();
  for (const [index, step] of STEPS.entries()) {
    const position = `${index + 1}/${STEPS.length}`;
    console.log(`\n[${position}] ${step.checksThat}: npm run ${step.npmScript}`);
    const stepStartedAt = Date.now();
    const { status, error } = runNpmScript(step.npmScript);
    if (status !== 0) {
      reportFailedStep(step, position, error);
      // A step that was killed, or never started, has no exit code of its own.
      process.exitCode = status || 1;
      return;
    }
    console.log(`[${position}] done in ${secondsSince(stepStartedAt)}`);
  }
  console.log(`\nverify: all ${STEPS.length} steps passed in ${secondsSince(verifyStartedAt)}.`);
}

/** Runs `npm run <npmScript>` with its output going straight to the
    terminal, and without npm's own lines about what it's running. */
function runNpmScript(npmScript: string): SpawnSyncReturns<Buffer> {
  const npmArguments = ["run", "--silent", npmScript];
  // Under `npm run verify`, npm says where its own program is: running that
  // with this Node is the same npm again, whatever the PATH has.
  const runningNpm = process.env.npm_execpath;
  if (runningNpm?.endsWith(".js"))
    return spawnSync(process.execPath, [runningNpm, ...npmArguments], { stdio: "inherit" });
  // Otherwise the npm on the PATH. On Windows that's npm.cmd, which only a shell can run.
  return spawnSync("npm", npmArguments, { stdio: "inherit", shell: process.platform === "win32" });
}

/** Says which step stopped the run, and how to check it by itself. `error`
    is why a step couldn't be run at all (no npm to run it with). */
function reportFailedStep(step: VerifyStep, position: string, error: Error | undefined): void {
  const whyItDidNotRun = error ? ` (${error.message})` : "";
  console.error(`\nverify stopped at ${position}, "${step.checksThat}"${whyItDidNotRun}.`);
  console.error(`Fix it, check with \`npm run ${step.npmScript}\`, then run \`npm run verify\` again.`);
}

/** The time since `startedAt` (a `Date.now()`), as the progress lines show it: "1.2 s". */
function secondsSince(startedAt: number): string {
  return `${((Date.now() - startedAt) / MILLISECONDS_IN_A_SECOND).toFixed(1)} s`;
}

main();
