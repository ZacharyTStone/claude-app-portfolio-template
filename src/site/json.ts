/* JSON as the build writes it. */

/** Indented, where a person may read it: ask.json, a page's schema.org data. */
export const JSON_INDENT = 2;

/** "<" as JSON can write it inside a string: JSON.parse reads it back as "<". */
const LESS_THAN_ESCAPED = "\\u003c";

/** `value` as JSON for a <script> element to carry: with every "<" escaped,
    "</script>" in the text can't end the element. `indent` is the spaces
    to indent each level by (none: one line). */
export const scriptJson = (value: unknown, indent?: number): string =>
  JSON.stringify(value, null, indent).replaceAll("<", LESS_THAN_ESCAPED);
