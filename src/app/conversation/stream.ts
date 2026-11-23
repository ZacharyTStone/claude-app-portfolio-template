/* A reply comes into a chat a word at a time, as a model's does, instead of
   all at once (src/styles/motion.css): each word of its text is wrapped in
   a part with its place in the order, and fades in at its turn. Its text
   is the same as before, so a screen reader hears it once, as it goes in,
   and a copy or a search finds it as it was. A picture, a card or a quote
   comes in whole, at its place, and keeps its own classes, as does the
   reply a model wrote for /ask, which stays text and nothing else. Only an
   answer comes in this way; a note under one is simply put in. With motion
   reduced, it shows at once. */
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../../contracts/page-selectors.ts";
import { make } from "../lib/dom.ts";
import { isMotionReduced } from "../lib/motion.ts";

/** How long after the word before it a word comes in, at most and at
    least: a long reply comes in faster, so none takes much longer than
    LONGEST_MS. */
const WORD_MS = { most: 16, least: 4 };
const LONGEST_MS = 3200;
/** How long a word takes to come in, once it starts. */
const COMES_IN_MS = 360;
/** A picture, a card or a quote takes as long as this many words. */
const WHOLE_PART_WORDS = 10;
/** The parts of an answer that are only running text, which come in a word
    at a time. A heading is laid out as a grid of its label and its title,
    so it comes in whole. */
const RUNNING_TEXT = new Set(["P", "UL", "OL"]);
/** Where each part's place, and the time between places, are for the
    stylesheet. */
const PLACE_PROPERTY = "--place";
const PACE_PROPERTY = "--pace";

/** Words, as the page's language divides them: Japanese has no spaces. */
const segmenter =
  "Segmenter" in Intl ? new Intl.Segmenter(document.documentElement.lang || undefined, { granularity: "word" }) : null;

/** Makes `message` come in a word at a time, from when it's put in the
    page, and says how long it will take, in ms. */
export function streamIn(message: Element): number {
  if (isMotionReduced() || !(message instanceof HTMLElement) || !message.matches(CLASS_SELECTOR.answer)) return 0;
  const parts = [...message.children];
  let place = 0;
  for (const part of parts) {
    place = isWordByWord(part) ? wrapWords(part, place) : placeWhole(part, place);
  }
  const pace = Math.max(WORD_MS.least, Math.min(WORD_MS.most, LONGEST_MS / Math.max(place, 1)));
  message.style.setProperty(PACE_PROPERTY, `${pace}ms`);
  message.classList.add(PAGE_CLASSES.streaming);
  const takes = place * pace + COMES_IN_MS;
  // Once it's in, it stays in: hidden and shown again, a tab would play it
  // again otherwise.
  setTimeout(() => finishStreaming(message), takes);
  return takes;
}

/** The rest of a message that's coming in shows at once. */
export function finishStreaming(message: Element): void {
  message.classList.remove(PAGE_CLASSES.streaming);
}

const isWordByWord = (part: Element): boolean => RUNNING_TEXT.has(part.tagName) && !part.matches(CLASS_SELECTOR.reply);

/** A part that comes in whole: the stylesheet finds it as an answer's part
    that isn't running text, and its place is all it's given. */
function placeWhole(part: Element, place: number): number {
  if (part instanceof HTMLElement) part.style.setProperty(PLACE_PROPERTY, String(place));
  return place + WHOLE_PART_WORDS;
}

function wordAt(word: string, place: number): HTMLElement {
  const part = make("span", { class: PAGE_CLASSES.streamed }, word);
  part.style.setProperty(PLACE_PROPERTY, String(place));
  return part;
}

/** Wraps each word of `block`'s text, from `place` on, and says the place
    after its last. */
function wrapWords(block: Element, place: number): number {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node instanceof Text) texts.push(node);
  let next = place;
  for (const text of texts) {
    text.replaceWith(
      ...wordsOf(text.data).map((piece) => (piece.trim() ? wordAt(piece, next++) : document.createTextNode(piece))),
    );
  }
  return next;
}

/** `text` in pieces: each word, and each run of spaces between. */
function wordsOf(text: string): string[] {
  if (!segmenter) return text.split(/(\s+)/).filter(Boolean);
  return [...segmenter.segment(text)].map(({ segment }) => segment);
}
