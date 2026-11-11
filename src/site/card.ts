/* A file card's lines, laid out like a small config file: the values start
   in one column, and so do the comments (src/components/Card.astro). */

import type { Card, CardValue } from "../shared/content.ts";

/** One line as it's drawn: its key (a list's later lines have none), the
    spaces before the value, the value and whether it's in the accent
    colour, and its comment with the spaces before it. */
export type CardRow = {
  key?: string;
  indent: string;
  accent: boolean;
  value: string;
  comment?: string;
  beforeComment: string;
};

// What shows on a key's own line: the value, a list's first line, or the accent.
const shown = (value: CardValue): string =>
  typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : value.accent;

const spaces = (n: number) => " ".repeat(n);

export function cardRows({ lines, gap = 1 }: Card): CardRow[] {
  // The values start `gap` spaces after the longest key and its colon.
  const column = Math.max(...lines.map(([key]) => key.length + 1)) + gap;
  // Comments line up when every value before one is plain ASCII, a column
  // to a character. Wide characters (CJK) take two, so with any of those
  // the comments just follow their value, two spaces on.
  const commented = lines.filter(([, , comment]) => comment).map(([, value]) => shown(value));
  const aligned = commented.every((value) => /^[\x20-\x7e]*$/.test(value));
  const commentColumn = Math.max(0, ...commented.map((value) => value.length)) + 2;

  return lines.flatMap(([key, value, comment]) => {
    const text = shown(value);
    const first: CardRow = {
      key,
      indent: spaces(column - key.length - 1),
      accent: typeof value === "object" && !Array.isArray(value),
      value: text,
      comment,
      beforeComment: aligned ? spaces(Math.max(0, commentColumn - text.length)) : "  ",
    };
    // A list's other lines, under its first.
    const rest = Array.isArray(value) ? value.slice(1) : [];
    return [
      first,
      ...rest.map((more): CardRow => ({ indent: spaces(column), accent: false, value: more, beforeComment: "" })),
    ];
  });
}
