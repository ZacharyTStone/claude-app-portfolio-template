/* Words the model's instructions (pick.ts, write.ts, address.ts) are
   written with. */

/** The owner's first name, as the instructions call them after the first
    mention: "Alex" for "Alex Example". */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** A language's name in English: "Japanese" for "ja". */
export const languageName = (code: string): string =>
  new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
