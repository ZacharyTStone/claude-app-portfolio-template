/* The site's security headers, in one place. The build writes them as a
   _headers file where the host reads one, or as a <meta>
   Content-Security-Policy where it doesn't (src/site/hosts.ts), and the
   browser checks serve the pages with exactly these. */

import type { Hsts } from "../config/site-config.ts";

/** What a site's policy depends on. */
export type PolicyOptions = {
  /** Ask is on: the page may send questions to /ask. */
  ask: boolean;
  /** The sites the viewer may show in a frame (frameOrigins), if any. */
  frames?: readonly string[];
};

/** The sites the viewer shows pages from: the origin of each address in
    the config's `viewer` ("https://docs.google.com"), once each, sorted.
    An address that isn't one is left out, for the config's checks to
    report. */
export function frameOrigins(viewer: Record<string, string> = {}): string[] {
  const origins = Object.values(viewer).flatMap((address) => (URL.canParse(address) ? [new URL(address).origin] : []));
  return [...new Set(origins)].sort();
}

/** The Content-Security-Policy, directive by directive: only same-origin
    scripts, styles, images and fonts, nothing inline, and Trusted Types
    required, so no script can turn a string into markup. A site with a
    viewer may also show pages from the sites its viewer names, in a frame.

    With `meta`, it's the policy for a page to carry in a <meta> tag, where
    the host sends no headers: the same, less frame-ancestors, which
    browsers only take from a header. */
export function contentSecurityPolicy({ ask, frames = [], meta = false }: PolicyOptions & { meta?: boolean }): string {
  const directives = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    // The page fetches only /ask, and only when Ask is on.
    ...(ask ? ["connect-src 'self'"] : []),
    // Frames only for the viewer, and only from the sites it names.
    ...(frames.length ? [`frame-src ${frames.join(" ")}`] : []),
    "base-uri 'none'",
    "form-action 'none'",
    // Browsers ignore this one in a <meta> tag (and say so in the console).
    ...(meta ? [] : ["frame-ancestors 'none'"]),
    "require-trusted-types-for 'script'",
    "trusted-types 'none'",
  ];
  return directives.join("; ");
}

/** Sent as a header, or where a host can't, in a <meta> tag. */
export const REFERRER_POLICY = "strict-origin-when-cross-origin";

/** How long a browser that has visited keeps to HTTPS for the site: two
    years, in seconds (the length hstspreload.org recommends). */
const HSTS_MAX_AGE_SECONDS = 2 * 365 * 24 * 60 * 60;

/** Browsers use only HTTPS for the site for two years after a visit. */
export function strictTransportSecurity({ includeSubDomains, preload }: Hsts = {}): string {
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
  ask,
  frames,
  hsts,
}: PolicyOptions & { hsts?: Hsts | undefined }): Array<[name: string, value: string]> {
  return [
    ["Strict-Transport-Security", strictTransportSecurity(hsts)],
    ["Content-Security-Policy", contentSecurityPolicy({ ask, frames })],
    // A file is what its type says it is, never guessed from its contents.
    ["X-Content-Type-Options", "nosniff"],
    // No site shows these pages in a frame: for browsers that predate the
    // policy's frame-ancestors.
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", REFERRER_POLICY],
    ["Permissions-Policy", PERMISSIONS_POLICY],
    // A window from another site that this page opens, or that opened it,
    // can't reach it.
    ["Cross-Origin-Opener-Policy", "same-origin"],
  ];
}
