/* JSON as the build writes it: indented where a person may read it
   (ask.json, a page's schema.org data), and safe inside the <script>
   element a page carries it in (the question card's, in Portfolio.astro,
   and the schema.org Person, in structured-data.ts). */

/** The spaces each level of the JSON the build writes is indented by, so
    a person can read it. */
export const JSON_INDENT = 2;

/** "<" as JSON can write it inside a string, which JSON.parse reads back
    as "<". */
const LESS_THAN_ESCAPED = "\\u003c";

/** `value` as JSON with every "<" escaped, so "</script>" in the text can't
    end the element; JSON.parse reads it back as it was. `indent` is the
    spaces to indent each level by (none: one line). */
export const scriptJson = (value: unknown, indent?: number): string =>
  JSON.stringify(value, null, indent).replaceAll("<", LESS_THAN_ESCAPED);
