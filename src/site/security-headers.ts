/* The site's security headers, in one place. The build writes them as a
   _headers file where the host reads one, and the policy and referrer
   policy into every page as <meta> tags (files/headers-file.ts); the
   browser checks serve the pages with exactly these. */

import type { Hsts } from "../config/site-config.ts";

/** What a site's policy depends on. */
export type PolicyOptions = {
  /** Ask is on: the page may send questions to /ask. */
  ask: boolean;
  /** The contact form is on: the page may post it to /contact, as a form
      and, with JavaScript, with fetch. */
  contactForm?: boolean;
  /** The sites the viewer may show in a frame (frameOrigins), if any. */
  frames?: readonly string[];
  /** The viewer shows the site's own pages of its posts in a frame (the
      config's writing.viewer): the pages may frame the site itself, and be
      framed by it and by no other site. */
  ownFrames?: boolean;
};

/** The sites the viewer shows pages from: the origin of each address in
    the config's `viewer` ("https://docs.google.com"), once each, sorted.
    An address that isn't one is left out, for the config's checks to
    report. */
export function frameOrigins(viewer: Record<string, string> = {}): string[] {
  const origins = Object.values(viewer).flatMap((address) => (URL.canParse(address) ? [new URL(address).origin] : []));
  return [...new Set(origins)].sort();
}

/** Where the pages' frames may come from: the site itself, for its own
    pages of its posts, then the sites its viewer names. */
const frameSources = ({ frames = [], ownFrames }: PolicyOptions): string[] => [
  ...(ownFrames ? ["'self'"] : []),
  ...frames,
];

/** The Content-Security-Policy, directive by directive: only same-origin
    scripts, styles, images and fonts, nothing inline, and Trusted Types
    required, so no script can turn a string into markup. A site with a
    viewer may also show pages from the sites its viewer names, in a frame,
    and its own pages of its posts if its viewer shows those: only then may
    a page be framed at all, and by the site itself alone. One with the
    contact form may post a form, to itself.

    With `meta`, it's the policy for a page to carry in a <meta> tag: the
    same, less frame-ancestors, which browsers only take from a header. */
export function contentSecurityPolicy(options: PolicyOptions & { meta?: boolean }): string {
  const { ask, contactForm = false, ownFrames = false, meta = false } = options;
  const frames = frameSources(options);
  const directives = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    // The page fetches only /ask and /contact, and only when each is on.
    ...(ask || contactForm ? ["connect-src 'self'"] : []),
    // Frames only for the viewer, and only from the sites it names.
    ...(frames.length ? [`frame-src ${frames.join(" ")}`] : []),
    "base-uri 'none'",
    // The one form a page may post is the contact form, to the site itself.
    `form-action ${contactForm ? "'self'" : "'none'"}`,
    // Browsers ignore this one in a <meta> tag (and say so in the console).
    ...(meta ? [] : [`frame-ancestors ${ownFrames ? "'self'" : "'none'"}`]),
    "require-trusted-types-for 'script'",
    "trusted-types 'none'",
  ];
  return directives.join("; ");
}

/** Sent as a header where a host can, and in a <meta> tag on every page. */
export const REFERRER_POLICY = "strict-origin-when-cross-origin";

/** How long a browser that has visited keeps to HTTPS for the site: two
    years, in seconds (the length hstspreload.org recommends). */
const HSTS_MAX_AGE_SECONDS = 2 * 365 * 24 * 60 * 60;

/** Browsers use only HTTPS for the site for two years after a visit. */
function strictTransportSecurity({ includeSubDomains, preload }: Hsts = {}): string {
  return [
    `max-age=${HSTS_MAX_AGE_SECONDS}`,
    ...(includeSubDomains ? ["includeSubDomains"] : []),
    ...(preload ? ["preload"] : []),
  ].join("; ");
}

/** What the page may use of the browser's: no camera, microphone,
    location, payments or USB, and no part in the Topics API's ad
    targeting. */
const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";

/** Every header, for every path, in the order they're written. */
export function securityHeaders({
  hsts,
  ...policy
}: PolicyOptions & { hsts?: Hsts | undefined }): Array<[name: string, value: string]> {
  return [
    ["Strict-Transport-Security", strictTransportSecurity(hsts)],
    ["Content-Security-Policy", contentSecurityPolicy(policy)],
    // A file is what its type says it is, never guessed from its contents.
    ["X-Content-Type-Options", "nosniff"],
    // No other site shows these pages in a frame, and the site itself only
    // where its viewer shows its own pages: for browsers that predate the
    // policy's frame-ancestors.
    ["X-Frame-Options", policy.ownFrames ? "SAMEORIGIN" : "DENY"],
    ["Referrer-Policy", REFERRER_POLICY],
    ["Permissions-Policy", PERMISSIONS_POLICY],
    // A window from another site that this page opens, or that opened it,
    // can't reach it.
    ["Cross-Origin-Opener-Policy", "same-origin"],
  ];
}
