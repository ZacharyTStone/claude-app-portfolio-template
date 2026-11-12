/* Data a page carries as JSON in a <script> element: the question card's
   (Portfolio.astro) and the schema.org Person (structured-data.ts). */

/** "<" as JSON can write it inside a string, which JSON.parse reads back
    as "<". */
const LESS_THAN_ESCAPED = "\\u003c";

/** `value` as JSON with every "<" escaped, so "</script>" in the text can't
    end the element; JSON.parse reads it back as it was. `indent` is the
    spaces to indent each level by (none: one line). */
export const scriptJson = (value: unknown, indent?: number): string =>
  JSON.stringify(value, null, indent).replaceAll("<", LESS_THAN_ESCAPED);
