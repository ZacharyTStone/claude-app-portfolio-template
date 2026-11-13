import type { Found } from "./words.ts";

// An email or a handle ("alex@example.com", "@alex"), a link
// ("https://example.com/cv"), or a site's address with or without a path
// ("example.com", "t.me/alex", "Node.js"): a word with a dot whose last part
// has two letters or more, which "e.g" and "a.m" don't. A mark that ends the
// sentence after one comes with it when an address may have it, and
// `addressesIn` takes that off.
const ADDRESS = new RegExp(
  [
    /[A-Za-z0-9._%+-]*@[A-Za-z0-9_][A-Za-z0-9._-]*/.source,
    /[A-Za-z][A-Za-z0-9+.-]*:\/\/[A-Za-z0-9._~/?#@!$&*+=%-]+/.source,
    /(?<![\p{Script=Latin}\p{N}._%+@-])[\p{Script=Latin}\p{N}][\p{Script=Latin}\p{N}-]*(?:\.[\p{Script=Latin}\p{N}-]+)*\.\p{Script=Latin}{2,}(?!\p{N})(?:\/[A-Za-z0-9._~/?#@!$&*+=%-]*)?/u
      .source,
  ].join("|"),
  "gu",
);

/** The emails, handles, links and sites in a text, each without the full
    stop, question mark or exclamation mark after it. */
export const addressesIn = (text: string): Found[] =>
  [...text.matchAll(ADDRESS)].map((found) => ({ start: found.index, text: found[0].replace(/[.!?]+$/, "") }));
