/* `astro build` on a config of a test's choosing, as SITE_CONFIG lets anyone do. */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { join } from "node:path";
import { SITE_CONFIG } from "../../src/site/load-site-config.ts";
import { ROOT } from "../../src/site/repo.ts";
import { WRITING_FIXTURE } from "../../src/site/writing/fixture.ts";
import { SAMPLE_QIITA } from "../sample/qiita.ts";

const ASTRO = join(ROOT, "node_modules/astro/bin/astro.mjs");

/** Builds the site of the config at `configPath` into `outputFolder`, and
    gives what the build said and how it ended. A config with `writing` gets
    the sample's posts from the tests' stand-in for Qiita, if it's for the
    sample's user, and Qiita's 404 if not: a test build never reaches Qiita. */
export const astroBuild = (configPath: string, outputFolder: string): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [ASTRO, "build", "--outDir", outputFolder], {
    cwd: ROOT,
    env: {
      ...process.env,
      [SITE_CONFIG]: configPath,
      [WRITING_FIXTURE]: SAMPLE_QIITA,
      ASTRO_TELEMETRY_DISABLED: "1",
      NO_COLOR: "1",
    },
    encoding: "utf8",
  });
