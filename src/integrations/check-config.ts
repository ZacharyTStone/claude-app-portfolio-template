/* Checks the config as a build or the dev server starts, and again each
   time the dev server sees it saved: that it type-checks, then what types
   can't say (src/site/checks). A build stops at a problem. The dev server
   says it and serves on, so the next save can put it right. */
import { execFile } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { AstroIntegration } from "astro";
import type { SiteConfig } from "../config/site-config.ts";
import { checkSite } from "../site/checks/check-site.ts";
import { typeCheck } from "../site/checks/config-types.ts";
import type { Findings } from "../site/checks/reporting.ts";
import { iconsIn, readStylesheet, STYLES_FOLDER } from "../site/icons.ts";
import type { LoadedSiteConfig } from "../site/load-site-config.ts";
import { makeSite } from "../site/site.ts";

/** Where a report of the config goes: Astro's logger for this integration. */
type Log = Record<"info" | "warn" | "error", (message: string) => void>;

/** What a check found, and the files the config was read from: a save of
    any of them calls for another check. */
type Checked = { findings: Findings; sources: string[] };

/** What the config's checks find in a config whose shape is right. */
const checkedFindings = (config: SiteConfig, root: string): Findings =>
  checkSite(makeSite(config), iconsIn(readStylesheet(join(root, STYLES_FOLDER))));

/** Checks a config's types, then the config. The checks read it as its
    types describe it, so they don't run on one whose shape is wrong. */
function checkTyped(config: SiteConfig, filePath: string, root: string): Checked {
  const { problems, sources } = typeCheck(filePath, root);
  return { findings: problems.length ? { problems, notes: [] } : checkedFindings(config, root), sources };
}

/** Says what was found: the advice, then every problem under the config's
    file as it was named. */
function report({ problems, notes }: Findings, fileName: string, log: Log): void {
  for (const note of notes) log.warn(`${note}.`);
  if (problems.length) log.error(`${fileName} has problems:\n- ${problems.join("\n- ")}`);
}

const PRINT_WHAT_A_FILE_EXPORTS =
  "const { default: config } = await import(process.argv[1]); process.stdout.write(JSON.stringify(config));";

/** Room for a config many times the size of a large one. */
const LARGEST_CONFIG_BYTES = 64 * 1024 * 1024;

/** The config a file exports now, read by a new Node: this one has already
    imported the file and what it imports, and would hand back what they
    said when the server started. */
async function exportedNow(filePath: string): Promise<SiteConfig> {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["--input-type=module", "--eval", PRINT_WHAT_A_FILE_EXPORTS, pathToFileURL(filePath).href],
    { maxBuffer: LARGEST_CONFIG_BYTES },
  );
  return JSON.parse(stdout);
}

/** As much of Vite's dev server as the check on save uses. */
type DevServer = {
  config: { root: string };
  watcher: { add: (files: string[]) => unknown; on: (event: "change", listener: (file: string) => unknown) => unknown };
};

/** Checks the config again each time the dev server sees one of the files
    it's made of saved, and says what it finds, or that the problems are
    gone. `checked` is what the check found as the server started. */
export function checkOnSave(server: DevServer, { fileName, filePath }: LoadedSiteConfig, log: Log, checked: Checked) {
  async function checkAgain(): Promise<void> {
    const hadProblems = checked.findings.problems.length > 0;
    checked = checkTyped(await exportedNow(filePath), filePath, server.config.root);
    report(checked.findings, fileName, log);
    if (hadProblems && !checked.findings.problems.length) log.info(`${fileName} has no problems now.`);
  }
  // A config outside the repo (SITE_CONFIG) isn't among the files Vite watches.
  server.watcher.add(checked.sources);
  server.watcher.on("change", async (changedFile) => {
    if (!checked.sources.includes(resolve(changedFile))) return;
    // A file that doesn't load is Vite's to report, in the page.
    await checkAgain().catch(() => {});
  });
}

/** The Astro integration that checks the config Astro was started with. */
export function checkConfig(loaded: LoadedSiteConfig): AstroIntegration {
  const { fileName, filePath, config } = loaded;
  let checked: Checked = { findings: { problems: [], notes: [] }, sources: [filePath] };
  return {
    name: "check-config",
    hooks: {
      "astro:config:setup": ({ config: astroConfig, command, logger }) => {
        const root = fileURLToPath(astroConfig.root);
        // `astro check` runs the type checker itself, and a preview builds nothing.
        const buildsPages = command === "build" || command === "dev";
        checked = buildsPages
          ? checkTyped(config, filePath, root)
          : { ...checked, findings: checkedFindings(config, root) };
        report(checked.findings, fileName, logger);
        // Thrown, Astro would call it an unhandled error and print a stack under it.
        if (checked.findings.problems.length && command !== "dev") process.exit(1);
      },
      "astro:server:setup": ({ server, logger }) => checkOnSave(server, loaded, logger, checked),
    },
  };
}
