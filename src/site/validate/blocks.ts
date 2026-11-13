/* The checks of one block of an answer (src/config/blocks.ts's Block): a
   picture, a link card, bars, a flow, a heading or a quote. A paragraph or
   a list is text, and its links are checked with all the others
   (language.ts). */

import type { Language } from "../../config/language.ts";
import { FIGURE_LIMITS } from "../../config/blocks.ts";
import type { Bars, Block, Flow, Heading, LinkCard, Picture, Quote } from "../../config/blocks.ts";
import type { Markdown } from "../../config/markdown.ts";
import { isFilledIn, type LanguageChecks } from "./reporting.ts";
import { isPathOnSite, isPixelCount } from "./shapes.ts";

/** Whether a block is words alone: a paragraph, or a list of lines. Every
    other block is an object with one key that says what it is. */
export const isTextBlock = (block: Block): block is Markdown | Markdown[] =>
  typeof block !== "object" || Array.isArray(block);

/** Every block of every answer in a language's threads. */
export const answerBlocksIn = (language: Language): Block[] =>
  language.threads.flatMap((thread) => thread.messages.flatMap((message) => message.a));

/** The pictures in a block: one, a row of them, or none. */
export function picturesIn(block: Block): Picture[] {
  if (isTextBlock(block)) return [];
  if ("image" in block) return [block.image];
  return "images" in block ? block.images : [];
}

/** Checks one block of an answer. `where` starts each message with the
    place the block is in: `the thread "work"`. */
export function checkBlock(block: Block, where: string, checks: LanguageChecks): void {
  for (const picture of picturesIn(block)) checkPicture(picture, where, checks);
  if (isTextBlock(block)) return;
  if ("link" in block) checkLinkCard(block.link, checks);
  if ("bars" in block) checkBars(block.bars, where, checks);
  if ("flow" in block) checkFlow(block.flow, where, checks);
  if ("heading" in block) checkHeading(block.heading, where, checks);
  if ("quote" in block) checkQuote(block.quote, where, checks);
}

/** A picture is a file on this site (the security policy lets images come
    from nowhere else), with words for anyone who can't see it, and its size
    in pixels, so the page keeps its place while the file loads. One that
    moves has a still of itself, which is a file on this site too. A site
    gets it wrong by pasting a picture's address from another site, or by
    leaving the alt for later. */
function checkPicture(
  { src, still, alt, width, height, href }: Picture,
  where: string,
  { problemUnless, checkLinkIsSafe }: LanguageChecks,
): void {
  problemUnless(isPathOnSite(src), `${where} has a picture at "${src}", which should be a path on this site`);
  problemUnless(
    still == null || (isPathOnSite(still) && still !== src),
    `${where} has the picture "${src}" with the still "${still}", which should be another file on this site: the same picture without its motion`,
  );
  problemUnless(
    isFilledIn(alt),
    `${where} has the picture "${src}" without an alt: say what it shows, for anyone who can't see it`,
  );
  problemUnless(
    isPixelCount(width) && isPixelCount(height),
    `${where} has the picture "${src}" without its width and height in pixels`,
  );
  if (href != null) checkLinkIsSafe(href, `the picture "${src}"`);
}

/** A link card's icon is one the stylesheet has (or a logo), and its link
    one a browser can safely follow. */
function checkLinkCard({ name, icon, href }: LinkCard, { checkIsIconOrLogo, checkLinkIsSafe }: LanguageChecks): void {
  checkIsIconOrLogo(icon, `the link card "${name}"`);
  checkLinkIsSafe(href, `the link card "${name}"`);
}

/** How many of something a figure can hold (one of FIGURE_LIMITS). */
type CountLimits = { min: number; max: number };

const isWithin = (count: number, { min, max }: CountLimits): boolean => count >= min && count <= max;

/** The limits as a problem's message says them: "2 to 6". */
const inWords = ({ min, max }: CountLimits): string => `${min} to ${max}`;

/** Bars are a figure: a title, and few enough rows to read at a glance but
    more than one (one number alone is a sentence, not a chart). Each bar's
    length is drawn from its `amount`, so that has to be a number above
    zero: a site gets it wrong by giving the amount as it's written
    ("385 ms") instead of as a number (385). */
function checkBars({ title, rows }: Bars, where: string, { problemUnless }: LanguageChecks): void {
  problemUnless(isFilledIn(title), `${where} has bars without a title`);
  problemUnless(
    isWithin(rows.length, FIGURE_LIMITS.bars),
    `${where} has ${rows.length} bars in "${title}": it takes ${inWords(FIGURE_LIMITS.bars)} (one number alone is text)`,
  );
  for (const { label, value, amount } of rows) {
    problemUnless(
      isFilledIn(label) && isFilledIn(value),
      `${where} has a bar in "${title}" without a label or a value`,
    );
    const isNumberAboveZero = Number.isFinite(amount) && amount > 0;
    problemUnless(
      isNumberAboveZero,
      `${where} has the bar "${label}" with the amount ${JSON.stringify(amount)}: it should be a number above zero, in the same unit on every row`,
    );
  }
}

/** A flow is a figure too: a title, and named steps, few enough to read at
    a glance. */
function checkFlow({ title, steps }: Flow, where: string, { problemUnless }: LanguageChecks): void {
  problemUnless(isFilledIn(title), `${where} has a flow without a title`);
  problemUnless(
    isWithin(steps.length, FIGURE_LIMITS.flow),
    `${where} has ${steps.length} steps in "${title}": it takes ${inWords(FIGURE_LIMITS.flow)}`,
  );
  for (const step of steps) {
    problemUnless(isFilledIn(step.name), `${where} has a step in "${title}" without a name`);
  }
}

/** A heading sets a part of a long answer apart by its title: without one
    there's nothing to draw. */
function checkHeading({ title }: Heading, where: string, { problemUnless }: LanguageChecks): void {
  problemUnless(isFilledIn(title), `${where} has a heading without a title`);
}

/** A quote is someone's words and who said them; `by` can be their part
    ("A fellow engineer"), but not nothing. */
function checkQuote({ text, by }: Quote, where: string, { problemUnless }: LanguageChecks): void {
  problemUnless(isFilledIn(text) && isFilledIn(by), `${where} has a quote without its text or who said it (by)`);
}
