/* How each host gets the security headers (src/shared/headers.ts): as a
   _headers file beside the pages where the host reads one, and otherwise
   as much as a page can carry, in <meta> tags. */

import type { Host } from "../shared/config.ts";
import { contentSecurityPolicy, frameOrigins, securityHeaders, type PolicyOptions } from "../shared/headers.ts";
import type { Site } from "./site.ts";

/** Hosts that read a _headers file from the folder they publish. */
const HOSTS_THAT_READ_A_HEADERS_FILE: readonly Host[] = ["cloudflare", "netlify"];

const readsHeadersFile = (host: Host): boolean => HOSTS_THAT_READ_A_HEADERS_FILE.includes(host);

/** In a _headers file, the line over the headers that go with every path. */
const EVERY_PATH = "/*";

/** What the site's policy allows beyond its own files: /ask when Ask is
    on, and frames from the sites its viewer shows. */
const policyOptions = ({ config }: Site): PolicyOptions => ({
  ask: Boolean(config.ask),
  frames: frameOrigins(config.viewer),
});

/** The host's _headers file (every path gets every header), or null for a
    host that doesn't read one. */
export function headersFile(site: Site): string | null {
  if (!readsHeadersFile(site.host)) return null;
  const headers = securityHeaders({ ...policyOptions(site), hsts: site.config.hsts });
  const headerLines = headers.map(([name, value]) => `  ${name}: ${value}\n`);
  return `${EVERY_PATH}\n${headerLines.join("")}`;
}

/** The Content-Security-Policy for a page to carry itself (less
    frame-ancestors, which only works as a header), or null where the host
    sends it as a header. */
export function pagePolicy(site: Site): string | null {
  if (readsHeadersFile(site.host)) return null;
  return contentSecurityPolicy({ ...policyOptions(site), meta: true });
}
