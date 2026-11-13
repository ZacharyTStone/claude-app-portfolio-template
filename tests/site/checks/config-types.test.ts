/* What the type checker says of a config's file (src/site/checks/config-types.ts). */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { typeCheck } from "../../../src/site/checks/config-types.ts";
import { ROOT } from "../../../src/site/repo.ts";
import {
  A_MISSPELT_SETTING,
  NO_SUCH_SETTING,
  SAMPLE_CONFIG,
  folderForConfigs,
  writeSampleConfig,
} from "../../sample/as-a-file.ts";

const folder = folderForConfigs();

test("the sample's config type-checks", () => {
  assert.deepEqual(typeCheck(SAMPLE_CONFIG, ROOT).problems, []);
});

test("a config is made of its own file and the files of the repo it imports, the types among them", () => {
  const { sources } = typeCheck(SAMPLE_CONFIG, ROOT);
  const expected = [SAMPLE_CONFIG, join(ROOT, "src/site/icons.ts"), join(ROOT, "src/config/strings.ts")];
  assert.deepEqual(
    expected.filter((file) => !sources.includes(file)),
    [],
  );
});

test("nothing from node_modules is one of a config's own files", () => {
  assert.deepEqual(
    typeCheck(SAMPLE_CONFIG, ROOT).sources.filter((file) => file.includes("node_modules")),
    [],
  );
});

test("a setting the config's type doesn't have is a problem, named by its file, line and column", () => {
  const file = join(folder, "misspelt.config.ts");
  writeSampleConfig(file, A_MISSPELT_SETTING);
  const { problems } = typeCheck(file, ROOT);
  assert.equal(problems.length, 1, problems.join("\n"));
  assert.ok(problems[0]?.startsWith(file), "a file outside the repo is named in full");
  assert.match(problems[0] ?? "", NO_SUCH_SETTING);
});

test("a file in the repo is named from the repo's root", () => {
  const file = join(folder, "site.config.ts");
  writeFileSync(join(folder, "tsconfig.json"), '{ "compilerOptions": { "skipLibCheck": true } }');
  writeFileSync(file, "export default { url: 1 } satisfies { url: string };\n");
  const { problems } = typeCheck(file, folder);
  assert.deepEqual(problems, ["site.config.ts:1:18 Type 'number' is not assignable to type 'string'."]);
});
