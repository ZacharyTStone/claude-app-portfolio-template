/* `astro build` on a config of a test's choosing, as SITE_CONFIG lets anyone do. */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { join } from "node:path";
import { SITE_CONFIG } from "../../src/site/load-site-config.ts";
import { ROOT } from "../../src/site/repo.ts";
import { ACTIVITY_FIXTURE } from "../../src/site/activity/fixture.ts";
import { GITHUB_HISTORY_FIXTURE } from "../../src/site/history/fixture.ts";
import { WRITING_FIXTURE } from "../../src/site/writing/fixture.ts";
import { SAMPLE_GITHUB } from "../sample/github.ts";
import { SAMPLE_GITHUB_HISTORY } from "../sample/github-history.ts";
import { SAMPLE_QIITA } from "../sample/qiita.ts";

const ASTRO = join(ROOT, "node_modules/astro/bin/astro.mjs");

/** Builds the site of the config at `configPath` into `outputFolder`, and
    gives what the build said and how it ended. A config with `writing` gets
    the sample's posts from the tests' stand-in for Qiita, if it's for the
    sample's user, and Qiita's 404 if not (or what `qiitaFixture` says
    instead: the sample before its first post); one with `activity` gets
    the sample's repos from the stand-in for GitHub the same way, and one
    with `githubHistory` the sample's history: a test build never reaches
    Qiita or GitHub. */
export const astroBuild = (
  configPath: string,
  outputFolder: string,
  qiitaFixture = SAMPLE_QIITA,
): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [ASTRO, "build", "--outDir", outputFolder], {
    cwd: ROOT,
    env: {
      ...process.env,
      [SITE_CONFIG]: configPath,
      [WRITING_FIXTURE]: qiitaFixture,
      [ACTIVITY_FIXTURE]: SAMPLE_GITHUB,
      [GITHUB_HISTORY_FIXTURE]: SAMPLE_GITHUB_HISTORY,
      ASTRO_TELEMETRY_DISABLED: "1",
      NO_COLOR: "1",
    },
    encoding: "utf8",
  });
