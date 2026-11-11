/* How each host gets the security headers (src/shared/headers.ts): as a
   _headers file beside the pages where the host reads one, and otherwise
   as much as a page can carry, in <meta> tags. */

import type { Host } from "../shared/config.ts";
import { contentSecurityPolicy, securityHeaders } from "../shared/headers.ts";
import type { Site } from "./site.ts";

/** Hosts that read a _headers file from the folder they publish. */
const READS_HEADERS_FILE: readonly Host[] = ["cloudflare", "netlify"];

/** The host's _headers file (every path gets every header), or null for a
    host that doesn't read one. */
export function headersFile({ config, host }: Site): string | null {
  if (!READS_HEADERS_FILE.includes(host)) return null;
  const headers = securityHeaders({ ask: Boolean(config.ask), hsts: config.hsts });
  return `/*\n${headers.map(([name, value]) => `  ${name}: ${value}\n`).join("")}`;
}

/** The Content-Security-Policy for a page to carry itself (less
    frame-ancestors, which only works as a header), or null where the host
    sends it as a header. */
export function pagePolicy({ config, host }: Site): string | null {
  if (READS_HEADERS_FILE.includes(host)) return null;
  return contentSecurityPolicy({ ask: Boolean(config.ask), meta: true });
}
