/* security.txt (RFC 9116): where to report a security problem with the
   site. To the address the site gives for everything else. */

import type { Site } from "../site.ts";

/** Where RFC 9116 puts it, from the site's root. The route that writes it
    is named for it (src/pages/.well-known/security.txt.ts). */
export const SECURITY_TXT_FILE = ".well-known/security.txt";

/** How long the file says it holds after a build: under a year, as RFC
    9116 asks, so a file nobody has rebuilt in a year says it's out of date.
    Each build writes it again, after a push or the daily rebuild. */
const DAYS_IT_HOLDS = 364;

const A_DAY_MS = 24 * 60 * 60 * 1000;

/** The file's Expires, for a build at `builtAt`. */
export const expiryAfter = (builtAt: Date): Date => new Date(builtAt.getTime() + DAYS_IT_HOLDS * A_DAY_MS);

/** Its fields: the email, as a mailto: address; when it stops holding; the
    languages of the site's pages, the main one first; and its own address,
    under the site's path, if it has one. */
export function securityTxt(site: Site, expires: Date): string {
  const fields = [
    ["Contact", `mailto:${site.config.links.email}`],
    ["Expires", expires.toISOString()],
    ["Preferred-Languages", site.codes.join(", ")],
    ["Canonical", site.fileUrl(`/${SECURITY_TXT_FILE}`)],
  ];
  return fields.map(([name, value]) => `${name}: ${value}\n`).join("");
}
