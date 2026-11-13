/* The security headers (src/site/security-headers.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Hsts } from "../../src/config/site-config.ts";
import { contentSecurityPolicy, frameOrigins, securityHeaders } from "../../src/site/security-headers.ts";

const VIEWER = {
  "https://docs.example.com/d/1/edit": "https://docs.example.com/d/1/preview",
  "https://docs.example.com/d/2/edit": "https://docs.example.com/d/2/preview",
  "https://a.example.org/x": "https://a.example.org/embed/x",
};

test("the viewer's sites are the origins of the addresses it shows, each once, in order", () => {
  assert.deepEqual(frameOrigins(VIEWER), ["https://a.example.org", "https://docs.example.com"]);
});

test("a site without a viewer shows no other site in a frame", () => {
  assert.deepEqual(frameOrigins(), []);
});

test("the policy lets frames come from the viewer's sites", () => {
  const directives = contentSecurityPolicy({ ask: false, frames: frameOrigins(VIEWER) }).split("; ");
  assert.ok(directives.includes("frame-src https://a.example.org https://docs.example.com"));
});

test("the policy has no frame-src without a viewer", () => {
  assert.doesNotMatch(contentSecurityPolicy({ ask: true }), /frame-src/);
});

test("no source but frames gains the viewer's sites", () => {
  const directives = contentSecurityPolicy({ ask: true, frames: frameOrigins(VIEWER) }).split("; ");
  const otherDirectivesNamingThem = directives.filter(
    (directive) => !directive.startsWith("frame-src") && /example\.(com|org)/.test(directive),
  );
  assert.deepEqual(otherDirectivesNamingThem, []);
});

const strictTransportSecurityFor = (hsts?: Hsts): string | undefined =>
  Object.fromEntries(securityHeaders({ ask: false, hsts }))["Strict-Transport-Security"];

test("HSTS is two years of HTTPS only, for a site that asks nothing more", () => {
  assert.equal(strictTransportSecurityFor(), "max-age=63072000");
});

test("HSTS covers subdomains when a site asks", () => {
  assert.equal(strictTransportSecurityFor({ includeSubDomains: true }), "max-age=63072000; includeSubDomains");
});

test("HSTS asks to be preloaded when a site asks for that too", () => {
  assert.equal(
    strictTransportSecurityFor({ includeSubDomains: true, preload: true }),
    "max-age=63072000; includeSubDomains; preload",
  );
});
