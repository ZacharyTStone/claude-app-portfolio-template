/* What a value in the config has to look like before a page can carry it.
   The pages escape what they write, but escaping doesn't make a
   javascript: link safe to follow, or "../en" a folder's name. */

import { readsAsAnotherSite } from "../../contracts/links.ts";

/** A check that a value is text of one pattern. Anything that isn't text
    doesn't look like it. */
const looksLike =
  (pattern: RegExp) =>
  (value: unknown): boolean =>
    typeof value === "string" && pattern.test(value);

/** "en", "pt-BR": a page's `lang` attribute and its folder's name. Not
    "English", and not "../en". */
export const isLanguageCode = looksLike(/^[a-z]{2,3}(-[a-zA-Z0-9]{2,8})*$/);

/** "en_US", or "en" alone, as Open Graph writes a locale. Not "en-US". */
export const isLocale = looksLike(/^[a-z]{2,3}(_[A-Z]{2})?$/);

/** "#191919", "#fff", or a colour's name. Nothing with a quote, a space or
    a bracket in it. */
export const isColour = looksLike(/^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]+)$/i);

/** "https://github.com/alex": http:// or https://, then anything but a
    space, a quote, an angle bracket or a backslash. */
export const isWebAddress = looksLike(/^https?:\/\/[^\s"'<>\\]+$/);

/** A web address a browser reads as https://, the only kind a page served
    over HTTPS can show in a frame. */
export const isHttpsAddress = (address: string): boolean =>
  isWebAddress(address) && URL.canParse(address) && new URL(address).protocol === "https:";

/** "docs.google.com": names of letters, digits and inner hyphens, between
    dots. Not "*", which a policy reads as any site, and nothing with a ";",
    which ends a policy's directive. */
const PLAIN_DOMAIN_NAME = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

/** An https:// address whose host is a plain domain name, safe to write
    into the policy as a site the page may frame. */
export const isFrameableAddress = (address: string): boolean =>
  isHttpsAddress(address) && PLAIN_DOMAIN_NAME.test(new URL(address).hostname);

/** "https://example.com", "https://alex.github.io/portfolio/": a web
    address with no query and no #, and no empty step in its path. Not
    "https://example.com//": every link on that site would start "//",
    which a browser reads as another site. */
export const isSiteAddress = looksLike(/^https?:\/\/[^\s"'<>\\/?#]+(\/[^\s"'<>\\/?#]+)*\/?$/);

/** "/assets/og.png": a file on this site, from the site's own root. Not
    "assets/og.png" (read from the page's own folder), and not
    "//example.com/og.png" (another site). */
export const isPathOnSite = looksLike(/^\/(?!\/)[^\s"'<>\\]*$/);

/** "alex@example.com": safe after "mailto:" in a link. Whether mail gets
    there is the owner's to try. */
export const isEmailAddress = looksLike(/^[^\s@"'<>\\]+@[^\s@"'<>\\]+$/);

/** A size in pixels a picture can have. */
export const isPixelCount = (size: unknown): boolean => typeof size === "number" && Number.isInteger(size) && size > 0;

/** Whether the account menu's clock can tell the time in `zone`: it uses
    this constructor (src/app), which throws for a zone it doesn't know
    ("Tokyo", for "Asia/Tokyo"). */
export function isTimeZone(zone: unknown): boolean {
  if (typeof zone !== "string") return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A browser drops some of these before it reads a link's scheme, so
    "java\nscript:alert(1)" would run. */
const SPACE_OR_CONTROL_CHARACTER = /[\s\x00-\x1f\x7f]/;

/** A link's scheme: "https" in "https://example.com", "javascript" in
    "javascript:alert(1)". "#about", "/resume.pdf" and "resume.pdf" have
    none. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/** Any other scheme (javascript:, data:, vbscript:) could run code or show
    a page of someone's making. */
const SAFE_SCHEMES = ["http", "https", "mailto"];

/** Whether a link is safe to follow: a web or mailto address, #thread or a
    path, with nothing in it a browser would skip over, and no path that a
    browser reads as another site. */
export function isSafeHref(href: string): boolean {
  if (SPACE_OR_CONTROL_CHARACTER.test(href) || readsAsAnotherSite(href)) return false;
  const scheme = href.match(SCHEME)?.[1];
  return scheme === undefined || SAFE_SCHEMES.includes(scheme.toLowerCase());
}
