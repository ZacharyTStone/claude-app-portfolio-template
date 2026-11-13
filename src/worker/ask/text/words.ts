/** Something found in a text: as it's written there, and where it starts. */
export type Found = { text: string; start: number };

/** Text with one form of each character (ｆｕｌｌ width to plain, so "２０２４"
    is "2024") and one kind of apostrophe. Capitals are kept: a name is told
    by them. */
export const withPlainCharacters = (text: string): string => text.normalize("NFKC").replace(/[’‘]/g, "'");

// With what's written inside a word: "Node.js", "2,350+", "CI/CD",
// "doesn't", "C#", "full-stack". The "%" of "12%" and the "年" of "4年"
// aren't part of it.
const LATIN_WORD = /[\p{Script=Latin}\p{N}]+(?:[.,'+#/&-]+[\p{Script=Latin}\p{N}]+)*[+#]*/gu;

// "Alex's" as "Alex", "he's" as "he", "they're" as "they", "I'm" as "I".
const withoutApostropheEnding = (word: string): string => word.replace(/'(?:s|re|ve|ll|d|m)$/i, "");

/** The text's words in Latin letters or digits, each without the ending a
    contraction or a possessive writes on to it. */
export const latinWordsIn = (text: string): Found[] =>
  [...text.matchAll(LATIN_WORD)].map((found) => ({ text: withoutApostropheEnding(found[0]), start: found.index }));

/** The words a compound is made of: "CI/CD", "US-based", "4-year". */
export const compoundParts = (word: string): string[] => word.split(/[/&-]+/).filter(Boolean);

/** A name's own parts, joined by a dot or a comma: "Node.js" is "Node" too.
    A number has none: "1.04" has no "04", nor "2,350" a "350". */
export const dottedParts = (word: string): string[] => (hasDigit(word) ? [word] : word.split(/[.,]+/).filter(Boolean));

export const hasDigit = (word: string): boolean => /\p{N}/u.test(word);
export const hasLetter = (word: string): boolean => /\p{L}/u.test(word);
export const hasCapitalInside = (word: string): boolean => /\p{Lu}/u.test(word.slice(1));
export const startsWithCapital = (word: string): boolean => /^\p{Lu}/u.test(word);

/** "nodejs" for "node.js", "wifi" for "wi-fi". */
export const withoutDotsAndDashes = (word: string): string => word.replace(/[.-]/g, "");
