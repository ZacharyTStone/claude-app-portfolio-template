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

/* The policies written out, so that a change that weakens one (a source
   added, Trusted Types or a directive dropped) fails here. */
const OWN_FILES_ONLY = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'";
const NO_BASE_NO_FORMS = "base-uri 'none'; form-action 'none'";
const NEVER_FRAMED = "frame-ancestors 'none'";
const TRUSTED_TYPES = "require-trusted-types-for 'script'; trusted-types 'none'";
const VIEWER_FRAMES = "frame-src https://a.example.org https://docs.example.com";
const PLAIN_POLICY = `${OWN_FILES_ONLY}; ${NO_BASE_NO_FORMS}; ${NEVER_FRAMED}; ${TRUSTED_TYPES}`;

const POLICIES = [
  {
    site: "a site with neither Ask nor a viewer",
    options: { ask: false },
    policy: PLAIN_POLICY,
  },
  {
    site: "a site with Ask",
    options: { ask: true },
    policy: `${OWN_FILES_ONLY}; connect-src 'self'; ${NO_BASE_NO_FORMS}; ${NEVER_FRAMED}; ${TRUSTED_TYPES}`,
  },
  {
    site: "a site with a viewer",
    options: { ask: false, frames: frameOrigins(VIEWER) },
    policy: `${OWN_FILES_ONLY}; ${VIEWER_FRAMES}; ${NO_BASE_NO_FORMS}; ${NEVER_FRAMED}; ${TRUSTED_TYPES}`,
  },
  {
    site: "a site with Ask and a viewer",
    options: { ask: true, frames: frameOrigins(VIEWER) },
    policy: `${OWN_FILES_ONLY}; connect-src 'self'; ${VIEWER_FRAMES}; ${NO_BASE_NO_FORMS}; ${NEVER_FRAMED}; ${TRUSTED_TYPES}`,
  },
];

for (const { site, options, policy } of POLICIES) {
  test(`${site} sends exactly its policy`, () => {
    assert.equal(contentSecurityPolicy(options), policy);
  });

  test(`${site} puts the same policy in its pages, less frame-ancestors`, () => {
    assert.equal(contentSecurityPolicy({ ...options, meta: true }), policy.replace(`${NEVER_FRAMED}; `, ""));
  });
}

test("every path gets exactly these headers, in this order", () => {
  assert.deepEqual(securityHeaders({ ask: false }), [
    ["Strict-Transport-Security", "max-age=63072000"],
    ["Content-Security-Policy", PLAIN_POLICY],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
  ]);
});
