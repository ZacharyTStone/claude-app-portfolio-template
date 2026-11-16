import type { Markdown } from "../config/markdown.ts";

// An emoji at the start of a line (with the variation selector, U+FE0F, that can follow it) and the space after
// it: the "🎸 " of "🎸 Plays guitar". Its first group is the emoji alone.
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;

/** A line of a personal answer, as its tab shows it: an emoji it starts with is decoration, which screen readers
    skip, apart from the words after it. */
export type AnswerLine = { emoji?: string; text: Markdown };

export function answerLine(line: Markdown): AnswerLine {
  const leading = line.match(LEADING_EMOJI);
  if (!leading) return { text: line };
  const [emojiAndSpace, emoji = ""] = leading;
  return { emoji, text: line.slice(emojiAndSpace.length) };
}

/** A list whose every line starts with an emoji has them in place of its bullets. */
export const isEmojiList = (lines: Markdown[]): boolean => lines.every((line) => LEADING_EMOJI.test(line));
