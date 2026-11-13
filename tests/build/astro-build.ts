/* `astro build` on a config of a test's choosing, as SITE_CONFIG lets anyone do. */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { join } from "node:path";
import { SITE_CONFIG } from "../../src/site/load-site-config.ts";
import { ROOT } from "../../src/site/repo.ts";

const ASTRO = join(ROOT, "node_modules/astro/bin/astro.mjs");

/** Builds the site of the config at `configPath` into `outputFolder`, and
    gives what the build said and how it ended. */
export const astroBuild = (configPath: string, outputFolder: string): SpawnSyncReturns<string> =>
  spawnSync(process.execPath, [ASTRO, "build", "--outDir", outputFolder], {
    cwd: ROOT,
    env: { ...process.env, [SITE_CONFIG]: configPath, ASTRO_TELEMETRY_DISABLED: "1", NO_COLOR: "1" },
    encoding: "utf8",
  });
