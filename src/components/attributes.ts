/* Attributes to spread onto an element. */

/** A bare data-* attribute, by its name in src/shared/page-data.ts:
    <button {...flag(DATA.copyLink)}> is <button data-copy-link>. */
export const flag = (name: string): Record<string, string> => ({ [name]: "" });
