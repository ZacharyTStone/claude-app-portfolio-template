/* `npm test`'s unit tests: every `.test.ts` file under tests/, with Node's own runner. In a site made from the template,
   the two that build the sample site (tests/sample) many times over are left out: they test the template's shared
   code on its made-up site, which the template's own checks do on every change, and they're the slowest by far. */
import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isTheTemplate } from "./template.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The tests that build the sample, to test the template's own code. */
const SAMPLE_BUILDS = ["tests/build/config-problems.test.ts", "tests/build/sample-site.test.ts"];

const everyTest = globSync("tests/**/*.test.ts", { cwd: ROOT }).map((path) => path.split(sep).join("/"));
const tests = isTheTemplate(ROOT) ? everyTest : everyTest.filter((path) => !SAMPLE_BUILDS.includes(path));
if (tests.length < everyTest.length)
  console.log(`Leaving out the template's own builds of its sample: ${SAMPLE_BUILDS.join(", ")}`);
const run = spawnSync(process.execPath, ["--test", "--test-reporter=dot", ...tests], { cwd: ROOT, stdio: "inherit" });
process.exit(run.status ?? 1);
