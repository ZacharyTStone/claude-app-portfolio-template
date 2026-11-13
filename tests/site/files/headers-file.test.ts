/* How each host gets the security headers: a _headers file where it reads
   one, and the policy in every page (src/site/files/headers-file.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOSTS, type Host } from "../../../src/config/site-config.ts";
import { headersFile, pagePolicy } from "../../../src/site/files/headers-file.ts";
import { contentSecurityPolicy } from "../../../src/site/security-headers.ts";
import { makeSite } from "../../../src/site/site.ts";
import { sampleConfig } from "../sample.ts";

const HOSTS_THAT_READ_A_HEADERS_FILE: Host[] = ["cloudflare", "netlify"];
const HOSTS_THAT_READ_NONE = HOSTS.filter((host) => !HOSTS_THAT_READ_A_HEADERS_FILE.includes(host));

/** The sample on `host`, with neither Ask nor a viewer: its policy allows nothing beyond the site's own files. */
const plainSiteOn = (host: Host) => makeSite(sampleConfig({ host, ask: undefined, viewer: undefined }));

/** Written out, so that a change to a header fails here, not only in the function that writes it. */
const PLAIN_SITES_HEADERS_FILE = [
  "/*",
  "  Strict-Transport-Security: max-age=63072000",
  "  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'",
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: DENY",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "  Cross-Origin-Opener-Policy: same-origin",
  "",
].join("\n");

for (const host of HOSTS_THAT_READ_A_HEADERS_FILE) {
  test(`${host} gets exactly the security headers in a _headers file, for every path`, () => {
    assert.equal(headersFile(plainSiteOn(host)), PLAIN_SITES_HEADERS_FILE);
  });
}

for (const host of HOSTS_THAT_READ_NONE) {
  test(`${host} reads no _headers file, so the build writes none`, () => {
    assert.equal(headersFile(plainSiteOn(host)), null);
  });
}

for (const host of HOSTS) {
  test(`on ${host} a page carries the policy itself, less frame-ancestors, which only works as a header`, () => {
    const policy = pagePolicy(plainSiteOn(host));
    assert.equal(policy, contentSecurityPolicy({ ask: false, meta: true }));
    assert.doesNotMatch(policy, /frame-ancestors/);
  });
}

const VIEWER = { "https://docs.example.com/d/1/edit": "https://docs.example.com/d/1/preview" };
const FRAMES_FROM_THE_VIEWERS_SITE = "frame-src https://docs.example.com";

test("a host's _headers file lets frames come from the viewer's site", () => {
  const file = headersFile(makeSite(sampleConfig({ viewer: VIEWER, host: "cloudflare" })));
  assert.ok(file?.includes(FRAMES_FROM_THE_VIEWERS_SITE));
});

test("a page that carries its own policy lets frames come from the viewer's site", () => {
  const policy = pagePolicy(makeSite(sampleConfig({ viewer: VIEWER, host: "static" })));
  assert.ok(policy.includes(FRAMES_FROM_THE_VIEWERS_SITE));
});
