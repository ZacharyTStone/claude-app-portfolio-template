/* A tab's page's description, for search engines and a link's preview:
   the text of the tab's first answer (its paragraphs and lists, as plain
   text), cut to about what a search result shows, at the end of a sentence
   where one fits and else at the end of a word. */

import { isTextBlock, type Block } from "../config/blocks.ts";
import { plainText } from "../config/markdown.ts";

/** In characters: about what a search result shows of a description. */
export const LONGEST_DESCRIPTION = 160;

/** What a description cut short ends with. */
const ELLIPSIS = "…";

/** What a cut can leave at the end before the "…": a space, or the comma,
    colon or dash before the word that didn't fit. */
const LOOSE_END = /[\s,;:、，\-–—]+$/u;

/** The marks a Chinese or Japanese sentence ends with, and the brackets
    that can close it: the next sentence follows with no space. */
const ENDS_WITHOUT_A_SPACE = /[。！？」』）]$/u;

/** Lines one after another, as a paragraph reads them. */
function joined(lines: string[]): string {
  return lines.reduce((text, line) => {
    if (!text) return line;
    return ENDS_WITHOUT_A_SPACE.test(text) ? `${text}${line}` : `${text} ${line}`;
  }, "");
}

/** As many of the text's first sentences as fit; "" if the first alone doesn't. */
function wholeSentences(text: string, code: string): string {
  let kept = "";
  for (const { segment } of new Intl.Segmenter(code, { granularity: "sentence" }).segment(text)) {
    if ((kept + segment).trimEnd().length > LONGEST_DESCRIPTION) break;
    kept += segment;
  }
  return kept.trimEnd();
}

/** The text's first words, as many as fit with the "…" after them. A
    first word too long for that is cut where it reaches the end. */
function firstWords(text: string, code: string): string {
  const room = LONGEST_DESCRIPTION - ELLIPSIS.length;
  let kept = "";
  for (const { segment } of new Intl.Segmenter(code, { granularity: "word" }).segment(text)) {
    if (kept.length + segment.length > room) break;
    kept += segment;
  }
  return (kept.replace(LOOSE_END, "") || text.slice(0, room)) + ELLIPSIS;
}

/** Text on one line, no longer than a description may be, in the language
    `code`, whose sentences and words it's cut between. */
export function shortened(text: string, code: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= LONGEST_DESCRIPTION) return oneLine;
  return wholeSentences(oneLine, code) || firstWords(oneLine, code);
}

/** What an answer says, as a description in the language `code`: null for
    one that says nothing in words of its own (only cards and figures). */
export function describe(answer: Block[], code: string): string | null {
  const lines = answer
    .filter(isTextBlock)
    .flat()
    .map((line) => plainText(line).trim())
    .filter(Boolean);
  return lines.length ? shortened(joined(lines), code) : null;
}
