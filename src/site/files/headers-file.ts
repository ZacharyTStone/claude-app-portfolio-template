/* How each host gets the security headers (../security-headers.ts): as a
   _headers file beside the pages where the host reads one, and on every
   host as much as a page can carry, in <meta> tags, so a site deployed
   to another host than its config names still has its policy. */

import type { Host } from "../../config/site-config.ts";
import { contentSecurityPolicy, frameOrigins, securityHeaders, type PolicyOptions } from "../security-headers.ts";
import type { Site } from "../site.ts";

export const HEADERS_FILE = "_headers";

/** They read it from the folder they publish. */
const HOSTS_THAT_READ_A_HEADERS_FILE: readonly Host[] = ["cloudflare", "netlify"];

const readsHeadersFile = (host: Host): boolean => HOSTS_THAT_READ_A_HEADERS_FILE.includes(host);

/** The line over the headers that go with every path. */
const EVERY_PATH = "/*";

/** What the site's policy allows beyond its own files: /ask when Ask is
    on, and frames from the sites its viewer shows. */
const policyOptions = ({ config }: Site): PolicyOptions => ({
  ask: Boolean(config.ask),
  frames: frameOrigins(config.viewer),
});

/** Null for a host that doesn't read one. */
export function headersFile(site: Site): string | null {
  if (!readsHeadersFile(site.host)) return null;
  const headers = securityHeaders({ ...policyOptions(site), hsts: site.config.hsts });
  const headerLines = headers.map(([name, value]) => `  ${name}: ${value}\n`);
  return `${EVERY_PATH}\n${headerLines.join("")}`;
}

/** The policy every page carries itself, whatever its host sends. */
export const pagePolicy = (site: Site): string => contentSecurityPolicy({ ...policyOptions(site), meta: true });
