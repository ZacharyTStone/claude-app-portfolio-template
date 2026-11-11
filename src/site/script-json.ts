/* Data a page carries as JSON in a <script> element: the question card's
   (Portfolio.astro) and the schema.org Person (structured-data.ts). */

/** `value` as JSON with every "<" written as <, which JSON.parse reads
    back as it was: "</script>" in the text can't end the element. */
export const scriptJson = (value: unknown, space?: number): string =>
  JSON.stringify(value, null, space).replace(/</g, "\\u003c");
