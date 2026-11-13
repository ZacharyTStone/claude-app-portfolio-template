/* The page's ids, classes and data attributes as CSS selectors, made here
   once for the browser code (src/app) and the browser checks
   (tests/browser). The names themselves are PAGE_IDS, PAGE_CLASSES and
   DATA: a class goes on an element by its name, and is found by its
   selector. */

import { mapValues, omit } from "es-toolkit";
import { DATA } from "./page-attributes.ts";
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
