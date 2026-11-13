/* The check of the config each time the dev server sees it saved
   (src/integrations/check-config.ts), with a stand-in for the server. */
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { checkOnSave } from "../../src/integrations/check-config.ts";
import { ROOT } from "../../src/site/repo.ts";
import {
  A_MISSPELT_SETTING,
  A_ROW_THAT_OPENS_NO_THREAD,
  NO_SUCH_SETTING,
  NO_SUCH_THREAD,
  folderForConfigs,
  writeSampleConfig,
} from "../sample/as-a-file.ts";

const filePath = join(folderForConfigs(), "site.config.ts");
const HAS_PROBLEMS = "site.config.ts has problems:\n- ";

/** A dev server that has just started on the config at `filePath`, with
    nothing wrong: what it's told (`said`), and `save`, which writes the
    sample's config after a change and tells the server the file changed. */
function devServerWatchingTheConfig() {
  const said: string[] = [];
  const log = {
    info: (message: string) => said.push(`info: ${message}`),
    warn: (message: string) => said.push(`warn: ${message}`),
    error: (message: string) => said.push(`error: ${message}`),
  };
  const watched: string[] = [];
  let whenAFileChanges: (file: string) => unknown = () => {};
  const server = {
    config: { root: ROOT },
    watcher: {
      add: (files: string[]) => watched.push(...files),
      on: (_event: "change", listener: (file: string) => unknown) => (whenAFileChanges = listener),
    },
  };
  writeSampleConfig(filePath);
  const startedWith = { findings: { problems: [], notes: [] }, sources: [filePath] };
  checkOnSave(server, { fileName: "site.config.ts", filePath, config: {} as never }, log, startedWith);
  const save = async (change = ""): Promise<void> => {
    writeSampleConfig(filePath, change);
    await whenAFileChanges(filePath);
  };
  return { said, watched, save, changed: (file: string) => whenAFileChanges(file) };
}

test("the dev server is asked to watch the config's file, wherever it is", () => {
  assert.deepEqual(devServerWatchingTheConfig().watched, [filePath]);
});

test("a config saved with a link to a thread that isn't there is told so, by the checks", async () => {
  const { said, save } = devServerWatchingTheConfig();
  await save(A_ROW_THAT_OPENS_NO_THREAD);
  assert.deepEqual(said, [`error: ${HAS_PROBLEMS}${NO_SUCH_THREAD}`]);
});

test("a config saved with a setting its type doesn't have is told so, by the type checker", async () => {
  const { said, save } = devServerWatchingTheConfig();
  await save(A_MISSPELT_SETTING);
  assert.equal(said.length, 1);
  assert.ok(said[0]?.startsWith(`error: ${HAS_PROBLEMS}${filePath}`));
  assert.match(said[0] ?? "", NO_SUCH_SETTING);
});

test("a config saved with nothing wrong, after one with a problem, is said to have none now", async () => {
  const { said, save } = devServerWatchingTheConfig();
  await save(A_ROW_THAT_OPENS_NO_THREAD);
  await save();
  assert.equal(said.at(-1), "info: site.config.ts has no problems now.");
});

test("a config saved with nothing wrong, as it was, is checked without a word", async () => {
  const { said, save } = devServerWatchingTheConfig();
  await save();
  assert.deepEqual(said, []);
});

test("a save of a file the config isn't made of checks nothing", async () => {
  const { said, changed } = devServerWatchingTheConfig();
  writeSampleConfig(filePath, A_ROW_THAT_OPENS_NO_THREAD);
  await changed(join(ROOT, "src/app/main.ts"));
  assert.deepEqual(said, []);
});

test("a save of a file the config imports checks the config again", async () => {
  const { said, save, changed } = devServerWatchingTheConfig();
  await save();
  writeSampleConfig(filePath, A_ROW_THAT_OPENS_NO_THREAD);
  await changed(join(ROOT, "tests/sample/site.config.ts"));
  assert.deepEqual(said, [`error: ${HAS_PROBLEMS}${NO_SUCH_THREAD}`]);
});
