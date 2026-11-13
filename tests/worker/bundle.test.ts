/* Cloudflare bundles the Worker with esbuild when the site is deployed, and
   until then nothing else runs it as one file: a module of Node's, or one
   that isn't there, would pass every other check. */
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

const WORKER_ENTRY = join(import.meta.dirname, "../../src/worker/index.ts");

/** The names the Worker's bundle exports, built as wrangler builds it: for
    Workers, where Node's modules aren't there to import. */
async function bundleExports(): Promise<string[]> {
  const { metafile } = await build({
    entryPoints: [WORKER_ENTRY],
    bundle: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "neutral",
    conditions: ["workerd", "worker", "browser"],
    mainFields: ["browser", "module", "main"],
    external: ["cloudflare:*"],
    logLevel: "silent",
  });
  return Object.values(metafile.outputs).flatMap((output) => output.exports);
}

test("the Worker bundles for Cloudflare, and exports its handler and the AskGuard class wrangler.jsonc binds", async () => {
  assert.deepEqual((await bundleExports()).sort(), ["AskGuard", "default"]);
});
