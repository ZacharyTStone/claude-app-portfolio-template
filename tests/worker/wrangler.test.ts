/* wrangler.jsonc is where a site turns Ask on, and Cloudflare reads it only
   when the site is deployed: a binding or a variable named there that the
   Worker doesn't read, or a value it can't, would otherwise go unnoticed. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import ts from "typescript";
import { ASK_PATH } from "../../src/contracts/ask.ts";
import type { Env } from "../../src/worker/env.ts";
import { AskGuard } from "../../src/worker/index.ts";
import { SETTINGS, readSettings } from "../../src/worker/settings.ts";

const ROOT = join(import.meta.dirname, "../..");

/** The bindings wrangler.jsonc gives the Worker, by what each is for. */
const BINDINGS = {
  ai: "AI",
  assets: "ASSETS",
  rateLimit: "ASK_LIMIT",
  guard: "ASK_GUARD",
} as const satisfies Record<string, keyof Env>;

type Wrangler = {
  main?: string;
  ai?: { binding?: string };
  assets?: { binding?: string };
  ratelimits?: { name?: string }[];
  durable_objects?: { bindings?: { name?: string; class_name?: string }[] };
  migrations?: { new_sqlite_classes?: string[]; new_classes?: string[] }[];
  vars?: Record<string, string>;
};

function parse(text: string): Wrangler {
  const { config, error } = ts.parseConfigFileTextToJson("wrangler.jsonc", text);
  assert.equal(error, undefined, "wrangler.jsonc is JSON, with comments");
  return config;
}

// The file's instructions for turning Ask on: uncomment its lines of JSON.
// The prose among them is commented twice, and stays a comment.
const A_COMMENTED_LINE_OF_JSON = /^(\s*)\/\/ (\s*)(?=["}\]])/gm;

/** wrangler.jsonc with Ask on: as the site has it, or as its instructions
    turn it on (`wasOff`). Undefined for a site whose file has no Ask in it
    either way. */
function wranglerWithAskOn(): { wrangler: Wrangler; wasOff: boolean } | undefined {
  const text = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8");
  const asItIs = parse(text);
  if (asItIs.main !== undefined) return { wrangler: asItIs, wasOff: false };
  const turnedOn = parse(text.replace(A_COMMENTED_LINE_OF_JSON, "$1$2"));
  return turnedOn.main === undefined ? undefined : { wrangler: turnedOn, wasOff: true };
}

const withAskOn = wranglerWithAskOn();

/** The file with Ask on, for a test about it; a site without Ask in its
    wrangler.jsonc has nothing to check. */
function askOn(t: TestContext): { wrangler: Wrangler; wasOff: boolean } | undefined {
  if (!withAskOn) t.skip("wrangler.jsonc has no Ask in it, on or commented out");
  return withAskOn;
}

test("wrangler.jsonc's `main` is a file that's there", (t) => {
  const on = askOn(t);
  if (on) assert.ok(existsSync(join(ROOT, on.wrangler.main ?? "")), `${on.wrangler.main} isn't in the repo`);
});

test("it binds Workers AI, the site's files and the rate limit by the names the Worker reads", (t) => {
  const on = askOn(t);
  if (!on) return;
  const { ai, assets, ratelimits = [] } = on.wrangler;
  assert.deepEqual(
    { ai: ai?.binding, assets: assets?.binding, rateLimit: ratelimits.map((limit) => limit.name) },
    { ai: BINDINGS.ai, assets: BINDINGS.assets, rateLimit: [BINDINGS.rateLimit] },
  );
});

test("it binds AskGuard by the name the Worker reads and the class it exports", (t) => {
  const on = askOn(t);
  if (on) {
    assert.deepEqual(on.wrangler.durable_objects?.bindings, [{ name: BINDINGS.guard, class_name: AskGuard.name }]);
  }
});

test("a migration creates AskGuard's class", (t) => {
  const on = askOn(t);
  if (!on) return;
  const created = (on.wrangler.migrations ?? []).flatMap((step) => [
    ...(step.new_sqlite_classes ?? []),
    ...(step.new_classes ?? []),
  ]);
  assert.ok(created.includes(AskGuard.name), `no migration creates ${AskGuard.name}`);
});

test("every variable it sets is a setting's, with a value the setting can read", (t) => {
  const on = askOn(t);
  if (!on) return;
  const rows = Object.values(SETTINGS);
  const unread = Object.entries(on.wrangler.vars ?? {}).filter(
    ([variable, written]) => !rows.some((row) => row.variable === variable && row.read(written) !== undefined),
  );
  assert.deepEqual(unread, []);
});

test("a file with Ask still commented out turns it on with every other setting at its default", (t) => {
  const on = askOn(t);
  if (!on) return;
  if (!on.wasOff) return t.skip("this site has Ask on, with settings of its own");
  assert.deepEqual(readSettings(on.wrangler.vars ?? {}), { ...readSettings({}), enabled: true });
});

test("Ask's questions go where wrangler.jsonc runs the Worker first", () => {
  assert.match(
    readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"),
    new RegExp(`"run_worker_first": \\[[^\\]]*"${ASK_PATH}"`),
  );
});
