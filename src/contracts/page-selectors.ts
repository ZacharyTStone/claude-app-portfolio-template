/* The page's ids, classes and data attributes as CSS selectors, made here
   once for the browser code (src/app) and the browser checks
   (tests/browser). The names themselves are PAGE_IDS, PAGE_CLASSES and
   DATA: a class goes on an element by its name, and is found by its
   selector. */

import { mapValues, omit } from "es-toolkit";
import { DATA, LOCAL_ZONE } from "./page-attributes.ts";
import { PAGE_CLASSES } from "./page-classes.ts";
import { PAGE_IDS } from "./page-ids.ts";

/** The element with an id: ID_SELECTOR.greeting is "#hello". */
export const ID_SELECTOR = mapValues(PAGE_IDS, (id) => `#${id}`);

/** The elements with a class: CLASS_SELECTOR.thread is ".thread". */
export const CLASS_SELECTOR = mapValues(PAGE_CLASSES, (name) => `.${name}`);

/** The elements that have a data-* attribute, whatever its value:
    ATTRIBUTE_SELECTOR.clock is "[data-clock]". DATA.greet and DATA.mood
    aren't here: each makes an attribute's name from a part of the day. */
export const ATTRIBUTE_SELECTOR = mapValues(omit(DATA, ["greet", "mood"]), (attribute: string) => `[${attribute}]`);

/** The parts of the page that take more than one name to find, and that
    more than one file looks for. One that a single file looks for is in
    that file. */
export const PART_SELECTOR = {
  /** In the sidebar: "New tab". */
  newTab: `${CLASS_SELECTOR.nav} ${CLASS_SELECTOR.newTab}`,
  /** In the sidebar: each row at the top, "New tab" among them. */
  navRow: `${CLASS_SELECTOR.nav} a`,
  /** In the sidebar: a row in one of its groups of tabs. */
  tabRow: `${CLASS_SELECTOR.groupRows} > li > a`,
  /** A thread's own questions, not one quoted inside an answer. */
  threadQuestion: `${CLASS_SELECTOR.thread} > ${CLASS_SELECTOR.question}`,
  /** In the account menu's clock: the time that's the owner's. */
  ownerZone: `${ATTRIBUTE_SELECTOR.zone}:not([${DATA.zone}="${LOCAL_ZONE}"])`,
  /** A link that opens in the viewer. */
  viewerLink: `a${ATTRIBUTE_SELECTOR.viewerAddress}`,
  /** What comes in as it's scrolled to: a quote, a file card. */
  comesIntoView: `${CLASS_SELECTOR.quote}, ${CLASS_SELECTOR.fileCard}`,
  /** A played picture's Play button. */
  playButton: `a${ATTRIBUTE_SELECTOR.play}`,
} as const;
