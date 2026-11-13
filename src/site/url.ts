/* Addresses: one as the pages show it to a reader, and the path the site is served at. */

/** What starts a web address and a reader can do without: "https://",
    "http://www." */
const SCHEME_AND_WWW = /^https?:\/\/(www\.)?/;

/** A slash at the very end: the last character of "example.com/". */
const LAST_SLASH = /\/$/;

/** An address as people write it: no scheme, www. or trailing slash
    ("https://www.linkedin.com/in/you/" is "linkedin.com/in/you"). */
export const shortUrl = (href: string): string => href.replace(SCHEME_AND_WWW, "").replace(LAST_SLASH, "");

/** The path the site is served at: "/" for https://example.com, and
    "/portfolio/" for https://alex.github.io/portfolio (with or without
    the last slash). Every link the pages make to the site starts here. */
export function basePath(url: string): string {
  const { pathname } = new URL(url);
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}
