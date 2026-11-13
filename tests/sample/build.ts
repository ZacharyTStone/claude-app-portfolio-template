/* Builds the sample site, for the tests that read or open its pages. */
import type { SpawnSyncReturns } from "node:child_process";
import { cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { astroBuild } from "../build/astro-build.ts";
import { SAMPLE_CONFIG } from "./as-a-file.ts";

/** The sample's own pictures. They aren't in the repo's public/, which is
    each site's own and all of it published. */
const SAMPLE_PUBLIC = fileURLToPath(new URL("public", import.meta.url));

/** Builds the sample into `outputFolder`: `astro build` on its config (or
    on a test's own version of it, at `configPath`), then its pictures. */
export function buildSample(outputFolder: string, configPath = SAMPLE_CONFIG): SpawnSyncReturns<string> {
  const built = astroBuild(configPath, outputFolder);
  if (built.status === 0) cpSync(SAMPLE_PUBLIC, outputFolder, { recursive: true });
  return built;
}
