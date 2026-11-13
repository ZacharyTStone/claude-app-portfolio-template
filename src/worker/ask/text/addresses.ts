import type { Found } from "./words.ts";

// An email or a handle ("alex@example.com", "@alex"), or a link
// ("https://example.com/cv"). A mark that ends the sentence after one
// comes with it when an address may have it, and `addressesIn` takes that
// off.
const ADDRESS =
  /[A-Za-z0-9._%+-]*@[A-Za-z0-9_][A-Za-z0-9._-]*|[A-Za-z][A-Za-z0-9+.-]*:\/\/[A-Za-z0-9._~/?#@!$&*+=%-]+/g;

/** The emails, handles and links in a text, each without the full stop,
    question mark or exclamation mark after it. */
export const addressesIn = (text: string): Found[] =>
  [...text.matchAll(ADDRESS)].map((found) => ({ start: found.index, text: found[0].replace(/[.!?]+$/, "") }));

// A site's address ("example.com"), a file's name ("site.config.ts"). Not
// "e.g" or "a.m".
const DOTTED_ADDRESS = /^\p{Ll}{2,}(?:\.\p{Ll}{2,})+$/u;

/** Whether a word is one in lower case with a dot inside it. */
export const isDottedAddress = (word: string): boolean => DOTTED_ADDRESS.test(word);
