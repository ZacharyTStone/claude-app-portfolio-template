/* The site's security headers, in one place. The build writes them as a
   _headers file where the host reads one, or as a <meta>
   Content-Security-Policy where it doesn't (src/site/hosts.ts), and the
   browser checks serve the pages with exactly these. */

/** The Content-Security-Policy, directive by directive: only same-origin
    scripts, styles, images and fonts, nothing inline, and Trusted Types
    required, so no script can turn a string into markup. */
export function contentSecurityPolicy({ ask, meta = false }: { ask: boolean; meta?: boolean }): string {
  const directives = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    // The page fetches only /ask, and only when Ask is on.
    ...(ask ? ["connect-src 'self'"] : []),
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

/** Strict-Transport-Security's two extras, from site.config.ts. Both are
    hard to undo, so they're off unless a site asks for them. */
export type Hsts = {
  /** Every subdomain too: only if every one of them is HTTPS for good. */
  includeSubDomains?: boolean;
  /** Ask browsers to build the site in as HTTPS-only (hstspreload.org).
      Needs includeSubDomains. */
  preload?: boolean;
};

/** Browsers use only HTTPS for the site for two years after a visit. */
export function strictTransportSecurity({ includeSubDomains, preload }: Hsts = {}): string {
  return [
    "max-age=63072000",
    ...(includeSubDomains ? ["includeSubDomains"] : []),
    ...(preload ? ["preload"] : []),
  ].join("; ");
}

/** Every header, for every path, in the order they're written. */
export function securityHeaders({
  ask,
  hsts,
}: {
  ask: boolean;
  hsts?: Hsts | undefined;
}): Array<[name: string, value: string]> {
  return [
    ["Strict-Transport-Security", strictTransportSecurity(hsts)],
    ["Content-Security-Policy", contentSecurityPolicy({ ask })],
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", REFERRER_POLICY],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"],
    ["Cross-Origin-Opener-Policy", "same-origin"],
  ];
}
