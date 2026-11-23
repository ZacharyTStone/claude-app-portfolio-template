/* wrangler.jsonc is where a site turns its Worker on, for Ask, the contact
   form or both, and Cloudflare reads it only when the site is deployed: a
   binding or a variable named there that the Worker doesn't read, or a
   value it can't, would otherwise go unnoticed. So would a form the config
   turns on with nothing in wrangler.jsonc to send its messages. (The
   secrets aren't in the file, so no test here can see them.) */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import ts from "typescript";
import ownConfig from "../../site.config.ts";
import type { SiteConfig } from "../../src/config/site-config.ts";
import { ASK_PATH } from "../../src/contracts/ask.ts";
import { CONTACT_PATH } from "../../src/contracts/contact.ts";
import { VISITS_PATH } from "../../src/contracts/globe.ts";
import { contactFormReceiver } from "../../src/site/contact-form.ts";
import { makeSite } from "../../src/site/site.ts";
import type { Env } from "../../src/worker/env.ts";
import { AskGuard } from "../../src/worker/index.ts";
import { SETTINGS, readSettings } from "../../src/worker/settings.ts";

const ROOT = join(import.meta.dirname, "../..");

/** The site's config, as its type has it: whatever it leaves out. */
const siteConfig: SiteConfig = ownConfig;

/** The bindings wrangler.jsonc gives the Worker, by what each is for. */
const BINDINGS = {
  ai: "AI",
  assets: "ASSETS",
  rateLimit: "ASK_LIMIT",
  guard: "ASK_GUARD",
  contactEmail: "CONTACT_EMAIL",
} as const satisfies Record<string, keyof Env>;

/** The contact form's API key, a secret: the Worker reads it as this, and
    wrangler.jsonc, which anyone who reads the repo reads, never has it. */
const API_KEY = "CONTACT_API_KEY" satisfies keyof Env;

type Wrangler = {
  main?: string;
  ai?: { binding?: string };
  assets?: { binding?: string; run_worker_first?: string[] };
  ratelimits?: { name?: string }[];
  durable_objects?: { bindings?: { name?: string; class_name?: string }[] };
  migrations?: { new_sqlite_classes?: string[]; new_classes?: string[] }[];
  send_email?: { name?: string; destination_address?: string; allowed_destination_addresses?: string[] }[];
  vars?: Record<string, string>;
  triggers?: { crons?: string[] };
  observability?: { enabled?: boolean; logs?: { invocation_logs?: boolean } };
};

function parse(text: string): Wrangler {
  const { config, error } = ts.parseConfigFileTextToJson("wrangler.jsonc", text);
  assert.equal(error, undefined, "wrangler.jsonc is JSON, with comments");
  return config;
}

// The file's instructions for turning the Worker on: uncomment its lines of
// JSON. The prose among them is commented twice, and stays a comment.
const A_COMMENTED_LINE_OF_JSON = /^(\s*)\/\/ (\s*)(?=["}\]])/gm;

const text = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8");
const asItIs = parse(text);

/** wrangler.jsonc with the Worker on: as the site has it, or as its
    instructions turn it on, every part of it (`wasOff`). Undefined for a
    site whose file has no Worker in it either way. */
function wranglerWithTheWorkerOn(): { wrangler: Wrangler; wasOff: boolean } | undefined {
  if (asItIs.main !== undefined) return { wrangler: asItIs, wasOff: false };
  const turnedOn = parse(text.replace(A_COMMENTED_LINE_OF_JSON, "$1$2"));
  return turnedOn.ai === undefined ? undefined : { wrangler: turnedOn, wasOff: true };
}

const withTheWorkerOn = wranglerWithTheWorkerOn();

/** The file with the Worker on, for a test about it; a site without a
    Worker in its wrangler.jsonc has nothing to check. */
function workerOn(t: TestContext): { wrangler: Wrangler; wasOff: boolean } | undefined {
  if (!withTheWorkerOn) t.skip("wrangler.jsonc has no Worker in it, on or commented out");
  return withTheWorkerOn;
}

/** The same, for a test of Ask's part: a site can have the Worker for the
    contact form alone. */
function askOn(t: TestContext): Wrangler | undefined {
  const wrangler = workerOn(t)?.wrangler;
  if (wrangler && !wrangler.ai) t.skip("wrangler.jsonc has no Ask in it");
  return wrangler?.ai ? wrangler : undefined;
}

/** Whether the file sends the contact form's messages: with the
    send_email binding, or with a sender's API. */
const sendsTheForm = (wrangler: Wrangler): boolean =>
  Boolean(wrangler.send_email) || readSettings(wrangler.vars ?? {}).contactSender !== "cloudflare";

/** The same, for a test of the contact form's part: or for Ask alone. */
function contactFormOn(t: TestContext): Wrangler | undefined {
  const wrangler = workerOn(t)?.wrangler;
  if (wrangler && !sendsTheForm(wrangler)) t.skip("wrangler.jsonc has no contact form in it");
  return wrangler && sendsTheForm(wrangler) ? wrangler : undefined;
}

/** The same, for a test of the send_email binding: a site with a sender's
    API has none. */
function bindingOn(t: TestContext): Wrangler | undefined {
  const wrangler = contactFormOn(t);
  if (wrangler && !wrangler.send_email) t.skip("the contact form's messages go out by a sender's API");
  return wrangler?.send_email ? wrangler : undefined;
}

const looksLikeAnAddress = (address: unknown): boolean =>
  typeof address === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);

test("wrangler.jsonc's `main` is a file that's there", (t) => {
  const on = workerOn(t);
  if (on) assert.ok(existsSync(join(ROOT, on.wrangler.main ?? "")), `${on.wrangler.main} isn't in the repo`);
});

test("it binds the site's files by the name the Worker reads", (t) => {
  const on = workerOn(t);
  if (on) assert.equal(on.wrangler.assets?.binding, BINDINGS.assets);
});

test("it binds AskGuard by the name the Worker reads and the class it exports", (t) => {
  const on = workerOn(t);
  if (on) {
    assert.deepEqual(on.wrangler.durable_objects?.bindings, [{ name: BINDINGS.guard, class_name: AskGuard.name }]);
  }
});

test("a migration creates AskGuard's class", (t) => {
  const on = workerOn(t);
  if (!on) return;
  const created = (on.wrangler.migrations ?? []).flatMap((step) => [
    ...(step.new_sqlite_classes ?? []),
    ...(step.new_classes ?? []),
  ]);
  assert.ok(created.includes(AskGuard.name), `no migration creates ${AskGuard.name}`);
});

test("every variable it sets is a setting's, with a value the setting can read", (t) => {
  const on = workerOn(t);
  if (!on) return;
  const rows = Object.values(SETTINGS);
  // The key has a test of its own, which doesn't print it.
  const unread = Object.entries(on.wrangler.vars ?? {}).filter(
    ([variable, written]) =>
      variable !== API_KEY && !rows.some((row) => row.variable === variable && row.read(written) !== undefined),
  );
  assert.deepEqual(unread, []);
});

test("the contact form's API key isn't in vars, where anyone who reads the repo would read it: it's a secret", (t) => {
  const on = workerOn(t);
  if (!on) return;
  assert.ok(
    !Object.keys(on.wrangler.vars ?? {}).includes(API_KEY),
    `remove ${API_KEY} from vars, make a new key with your sender, and set it with \`npm run wrangler -- secret put ${API_KEY}\``,
  );
});

test("a file with the Worker still commented out turns it on with every other setting at its default", (t) => {
  const on = workerOn(t);
  if (!on) return;
  if (!on.wasOff) return t.skip("this site has the Worker on, with settings of its own");
  const settings = readSettings(on.wrangler.vars ?? {});
  // An address has no default: the file has one to change.
  assert.deepEqual(settings, { ...readSettings({}), enabled: true, contactTo: settings.contactTo });
});

test("it binds Workers AI and the rate limit by the names the Worker reads", (t) => {
  const wrangler = askOn(t);
  if (!wrangler) return;
  const { ai, ratelimits = [] } = wrangler;
  assert.deepEqual(
    { ai: ai?.binding, rateLimit: ratelimits.map((limit) => limit.name) },
    { ai: BINDINGS.ai, rateLimit: [BINDINGS.rateLimit] },
  );
});

test("Ask's questions go where wrangler.jsonc runs the Worker first", (t) => {
  const wrangler = askOn(t);
  if (wrangler) assert.ok(wrangler.assets?.run_worker_first?.includes(ASK_PATH));
});

test("a site whose globe shows its visitors has the Worker run first for /visits, with AskGuard to count them", (t) => {
  if (!siteConfig.globe?.visitors) return t.skip("site.config.ts's globe shows no visitors");
  const { wrangler } = wranglerWithTheWorkerOn() ?? {};
  assert.ok(wrangler, "wrangler.jsonc turns the Worker on");
  assert.ok(wrangler.assets?.run_worker_first?.includes(VISITS_PATH), `"${VISITS_PATH}" in assets.run_worker_first`);
  assert.ok(
    (wrangler.durable_objects?.bindings ?? []).some(({ name }) => name === BINDINGS.guard),
    `the Durable Object ${BINDINGS.guard}`,
  );
});

test("it binds the contact form's email by the name the Worker reads, to one address only", (t) => {
  const wrangler = bindingOn(t);
  if (!wrangler) return;
  const [binding, ...more] = wrangler.send_email ?? [];
  assert.deepEqual(
    { name: binding?.name, more: more.length, allowlist: binding?.allowed_destination_addresses },
    { name: BINDINGS.contactEmail, more: 0, allowlist: undefined },
  );
  assert.ok(looksLikeAnAddress(binding?.destination_address), "its destination_address is your email address");
});

test("the contact form's messages go to the address its binding is locked to", (t) => {
  const wrangler = bindingOn(t);
  if (!wrangler) return;
  const lockedTo = wrangler.send_email?.[0]?.destination_address;
  assert.equal(
    wrangler.vars?.[SETTINGS.contactTo.variable],
    lockedTo,
    "CONTACT_TO is the binding's destination_address",
  );
});

test("the contact form's messages go where wrangler.jsonc runs the Worker first", (t) => {
  const wrangler = contactFormOn(t);
  if (wrangler) assert.ok(wrangler.assets?.run_worker_first?.includes(CONTACT_PATH));
});

/** The address the contact form's binding is locked to, if the file has
    the binding by the name the Worker reads, with an address. */
function lockedTo({ send_email: [email] = [] }: Wrangler): string | undefined {
  const isTheFormsBinding = email?.name === BINDINGS.contactEmail && looksLikeAnAddress(email.destination_address);
  return isTheFormsBinding ? email.destination_address : undefined;
}

/** What the sender CONTACT_SENDER names needs: the binding, locked to
    the address the Worker sends to; or, for an API, only that address (its
    key is a secret, which the file doesn't have). */
function partsTheSenderNeeds(wrangler: Wrangler): Record<string, boolean> {
  const { vars = {} } = wrangler;
  const to = SETTINGS.contactTo.variable;
  if (readSettings(vars).contactSender !== "cloudflare") {
    return { [`${to} in vars, your address`]: looksLikeAnAddress(vars[to]) };
  }
  const address = lockedTo(wrangler);
  return {
    [`send_email ${BINDINGS.contactEmail}, with your address as its destination_address`]: address !== undefined,
    [`${to} in vars, that same address`]: address !== undefined && vars[to] === address,
  };
}

/** What a site with the contact form needs wrangler.jsonc to have on, each
    under the name a failure gives it, and whether the file has it. */
function partsTheFormNeeds(wrangler: Wrangler): Record<string, boolean> {
  const { main, assets = {}, durable_objects: durableObjects = {} } = wrangler;
  return {
    main: main !== undefined,
    [`assets.binding "${BINDINGS.assets}"`]: assets.binding === BINDINGS.assets,
    [`"${CONTACT_PATH}" in assets.run_worker_first`]: (assets.run_worker_first ?? []).includes(CONTACT_PATH),
    [`the Durable Object ${BINDINGS.guard}`]: (durableObjects.bindings ?? []).some(
      ({ name }) => name === BINDINGS.guard,
    ),
    ...partsTheSenderNeeds(wrangler),
  };
}

test("a site with the contact form on in site.config.ts has it on in wrangler.jsonc too", (t) => {
  if (!siteConfig.contactForm) return t.skip("site.config.ts has no contact form");
  if (contactFormReceiver(makeSite(siteConfig).host) !== "worker") {
    return t.skip("Netlify Forms takes this site's messages, with no Worker");
  }
  const missing = Object.entries(partsTheFormNeeds(asItIs)).flatMap(([part, isThere]) => (isThere ? [] : [part]));
  assert.deepEqual(missing, [], "wrangler.jsonc needs these, as docs/contact-form.md says");
});

test("a cron trigger (the Writing tab's daily rebuild) has the Worker's script to run, and the site's files bound", (t) => {
  if (!asItIs.triggers?.crons?.length) return t.skip("wrangler.jsonc has no cron trigger");
  assert.ok(
    existsSync(join(ROOT, asItIs.main ?? "")),
    `a cron trigger runs the Worker's script, and ${asItIs.main} isn't one`,
  );
  assert.equal(asItIs.assets?.binding, BINDINGS.assets, "the Worker reaches the site's files by this binding");
});

test("the Worker's log is kept, without the line for each request that has the visitor's address", () => {
  const { observability } = asItIs;
  assert.deepEqual(
    { logged: observability?.enabled, eachRequest: observability?.logs?.invocation_logs },
    { logged: true, eachRequest: false },
  );
});
