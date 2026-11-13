/* Words more than one prompt is written with. */

/** The owner's first name, as the instructions call them after the first
    mention: "Alex" for "Alex Example". */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** A language's name in English: "Japanese" for "ja". */
export const languageName = (code: string): string =>
  new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;

/** What a model says when the site doesn't say what was asked: the picker
    in place of an answer's id, the writer in place of a reply. The log has
    it for a question with no pick. */
export const NONE = "none";
