/* What `astro build` says of a config with a problem, and how it stops
   (src/integrations/check-config.ts). */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  A_MISSPELT_SETTING,
  A_ROW_THAT_OPENS_NO_THREAD,
  NO_SUCH_SETTING,
  NO_SUCH_THREAD,
  folderForConfigs,
  writeSampleConfig,
} from "../sample/as-a-file.ts";
import { astroBuild } from "./astro-build.ts";

const folder = folderForConfigs();

/** The build of the sample's config after `change`, which is wrong: what it said, and how it ended. */
function buildOfAConfigWith(change: string, name: string) {
  const configPath = join(folder, `${name}.config.ts`);
  const outputFolder = join(folder, `${name}-dist`);
  writeSampleConfig(configPath, change);
  const { status, stdout, stderr } = astroBuild(configPath, outputFolder);
  return { status, said: stdout + stderr, configPath, built: existsSync(outputFolder) };
}

const withADeadLink = buildOfAConfigWith(A_ROW_THAT_OPENS_NO_THREAD, "dead-link");
const withATypeError = buildOfAConfigWith(A_MISSPELT_SETTING, "type-error");

test("a build stops at a problem the config's checks find, and names it under the config's file", () => {
  assert.equal(withADeadLink.status, 1);
  assert.ok(withADeadLink.said.includes(`${withADeadLink.configPath} has problems:\n- ${NO_SUCH_THREAD}\n`));
});

test("a build stops at a type error in the config, with the compiler's words and the place", () => {
  assert.equal(withATypeError.status, 1);
  assert.ok(withATypeError.said.includes(`${withATypeError.configPath} has problems:\n- ${withATypeError.configPath}`));
  assert.match(withATypeError.said, NO_SUCH_SETTING);
});

for (const [build, kind] of [
  [withADeadLink, "a problem"],
  [withATypeError, "a type error"],
] as const) {
  test(`a build that stops at ${kind} builds nothing`, () => {
    assert.ok(!build.built);
  });

  test(`a build that stops at ${kind} doesn't call it an unhandled error, or print a stack under it`, () => {
    assert.doesNotMatch(build.said, /unhandled|Stack trace|\n\s+at /);
  });
}
