/* The checks of one block of an answer (src/config/blocks.ts's Block). A
   paragraph or a list is text: its links are checked with all the others
   (text-links.ts). */

import { FIGURE_LIMITS, isTextBlock, picturesIn } from "../../config/blocks.ts";
import type { Bars, Block, Flow, Heading, LinkCard, Picture, Quote } from "../../config/blocks.ts";
import { isPathOnSite, isPixelCount } from "./formats.ts";
import { isFilledIn, type LanguageChecks } from "./reporting.ts";

/** `where` starts each problem with the place the block is in: `the thread
    "work"`. */
export function checkBlock(block: Block, where: string, checks: LanguageChecks): void {
  for (const picture of picturesIn(block)) checkPicture(picture, where, checks);
  if (isTextBlock(block)) return;
  if ("link" in block) checkLinkCard(block.link, checks);
  if ("bars" in block) checkBars(block.bars, where, checks);
  if ("flow" in block) checkFlow(block.flow, where, checks);
  if ("heading" in block) checkHeading(block.heading, where, checks);
  if ("quote" in block) checkQuote(block.quote, where, checks);
}

/** The security policy lets a picture come from nowhere but this site, and
    its size is how the page keeps its place while the file loads. */
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

function checkLinkCard({ name, icon, href }: LinkCard, { checkIsIconOrLogo, checkLinkIsSafe }: LanguageChecks): void {
  checkIsIconOrLogo(icon, `the link card "${name}"`);
  checkLinkIsSafe(href, `the link card "${name}"`);
}

/** One of FIGURE_LIMITS. */
type CountLimits = { min: number; max: number };

const isWithin = (count: number, { min, max }: CountLimits): boolean => count >= min && count <= max;

/** "2 to 6". */
const inWords = ({ min, max }: CountLimits): string => `${min} to ${max}`;

/** A bar's length is drawn from its `amount`: a site gets it wrong by
    giving the amount as it's written ("385 ms") instead of as a number. */
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

function checkHeading({ title }: Heading, where: string, { problemUnless }: LanguageChecks): void {
  problemUnless(isFilledIn(title), `${where} has a heading without a title`);
}

function checkQuote({ text, by }: Quote, where: string, { problemUnless }: LanguageChecks): void {
  problemUnless(isFilledIn(text) && isFilledIn(by), `${where} has a quote without its text or who said it (by)`);
}
