/* The sample site's config as a file of a test's own: for the tests that
   hand a config's path to the type checker, to Astro or to a new Node. */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after } from "node:test";

/** The sample's own config, as a path. */
export const SAMPLE_CONFIG = fileURLToPath(new URL("site.config.ts", import.meta.url));

/** A folder for a test file's configs, removed once its tests are done. */
export function folderForConfigs(): string {
  const folder = mkdtempSync(join(tmpdir(), "sample-configs-"));
  after(() => rmSync(folder, { recursive: true, force: true }));
  return folder;
}

/** Writes the sample's config after `change` to `file`: TypeScript that
    changes `config`, a copy of the sample's ("config.timezone = 'Tokyo';"),
    or nothing. */
export function writeSampleConfig(file: string, change = ""): void {
  const lines = [
    `import sample from ${JSON.stringify(SAMPLE_CONFIG)};`,
    "const config = structuredClone(sample);",
    change,
    "export default config;",
  ];
  writeFileSync(file, `${lines.join("\n")}\n`);
}

/** A sidebar row that opens a thread the sample doesn't have. */
export const A_ROW_THAT_OPENS_NO_THREAD = 'config.languages.en!.sidebar.nav[0]!.tab = "skils";';

/** What the checks say of that row. */
export const NO_SUCH_THREAD = `en: the sidebar's "About" points at #skils, which isn't a thread`;

/** A setting the config's type doesn't have: its name, misspelt. */
export const A_MISSPELT_SETTING = 'config.themeColour = "#191919";';

/** What the type checker says of it, after the file and the place. */
export const NO_SUCH_SETTING = /:3:8 Property 'themeColour' does not exist on type 'SiteConfig'/;
