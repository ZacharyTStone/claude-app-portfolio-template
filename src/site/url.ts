/* Addresses as the pages show them to a reader. */

/** What starts a web address and a reader can do without: "https://",
    "http://www." */
const SCHEME_AND_WWW = /^https?:\/\/(www\.)?/;

/** A slash at the very end: the last character of "example.com/". */
const LAST_SLASH = /\/$/;

/** An address as people write it: no scheme, www. or trailing slash
    ("https://www.linkedin.com/in/you/" is "linkedin.com/in/you"). */
export const shortUrl = (href: string): string => href.replace(SCHEME_AND_WWW, "").replace(LAST_SLASH, "");
