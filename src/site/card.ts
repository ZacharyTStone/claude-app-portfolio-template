/* A file card's lines, laid out like a small config file: the values start
   in one column, and so do the comments (src/components/Card.astro). */

import type { Card, CardValue } from "../config/blocks.ts";

/** One line of a card as it's drawn in the <pre>, left to right. */
export type CardRow = {
  /** The line's key, before its colon. A list's later lines have none. */
  key?: string;
  /** The spaces before the value, which bring it to the values' column. */
  indent: string;
  /** Whether the value is drawn in the accent colour. */
  accent: boolean;
  /** The value: all of it, or one line of a list. */
  value: string;
  /** The comment after the value, without its "#", if the line has one. */
  comment?: string;
  /** The spaces between the value and the comment. */
  beforeComment: string;
};

/** The spaces between the longest key's colon and the values, when the card
    doesn't set its own `gap`. */
const DEFAULT_GAP = 1;

/** The colon after a key takes one column. */
const COLON_WIDTH = 1;

/** The spaces between a value and its comment: after the longest commented
    value when the comments line up, after each value when they don't. */
const COMMENT_GAP = 2;

/** Only printable ASCII: "Acme, Inc.", and not "アクメ". */
const ONLY_ASCII = /^[\x20-\x7e]*$/;

const spaces = (count: number): string => " ".repeat(count);

/** What shows on a key's own line: the value, a list's first line, or the
    accented value. */
function firstLineOf(value: CardValue): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return value.accent;
}

/** A card's lines as they're drawn: a row for each line, and one more for
    each later line of a list, under the list's first. */
export function cardRows({ lines, gap = DEFAULT_GAP }: Card): CardRow[] {
  // Every value starts in one column, `gap` spaces after the longest key and its colon.
  const widestKeyAndColon = Math.max(...lines.map(([key]) => key.length + COLON_WIDTH));
  const valueColumn = widestKeyAndColon + gap;

  // The comments start in one column too, when every value before one is
  // plain ASCII, a column to a character. Wide characters (CJK) take two, so
  // with any of those each comment just follows its own value.
  const commentedValues = lines.filter(([, , comment]) => comment).map(([, value]) => firstLineOf(value));
  const commentsLineUp = commentedValues.every((value) => ONLY_ASCII.test(value));
  const commentColumn = Math.max(0, ...commentedValues.map((value) => value.length)) + COMMENT_GAP;

  return lines.flatMap(([key, value, comment]) => {
    const firstLine = firstLineOf(value);
    const keyRow: CardRow = {
      key,
      indent: spaces(valueColumn - key.length - COLON_WIDTH),
      accent: typeof value === "object" && !Array.isArray(value),
      value: firstLine,
      comment,
      beforeComment: spaces(commentsLineUp ? Math.max(0, commentColumn - firstLine.length) : COMMENT_GAP),
    };
    const laterLines = Array.isArray(value) ? value.slice(1) : [];
    const laterRows = laterLines.map((line): CardRow => ({
      indent: spaces(valueColumn),
      accent: false,
      value: line,
      beforeComment: "",
    }));
    return [keyRow, ...laterRows];
  });
}
