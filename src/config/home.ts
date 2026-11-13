/* Each language's `home`: the home screen. */

import type { Markdown } from "./markdown.ts";

export type Home = {
  /** The heading. */
  greeting: Greeting;
  /** Under the greeting: a line or so, as the home screen is meant to be
      light. */
  intro: Markdown;
  /** Its own line under the intro, after an arrow pointing at the tabs
      (not on phones, where the tabs are a drawer). Leave out for none. */
  hint?: string;
  /** One line under your name at the top of a new chat, which is where a
      visit starts on a phone. Leave out for the name alone. */
  tagline?: string;
  /** Questions to start with, under the box to type in (which needs
      JavaScript, as they do): a few, each short enough for one line.
      Leave out for the box alone. */
  prompts?: Prompt[];
};

/** The home screen's heading, by the visitor's time of day (the hours are
    HOURS.greeting, in src/contracts/day-parts.ts). */
export type Greeting = {
  /** What the page is built with, and shows without JavaScript: "Hello." */
  default: string;
  /** From 5:00: "Good morning." */
  morning: string;
  /** From 12:00: "Good afternoon." */
  afternoon: string;
  /** From 18:00: "Good evening." */
  evening: string;
  /** From 23:00 until morning: "Up late?" */
  late: string;
};

/** A question to start with: choosing it opens a new chat and sends it. */
export type Prompt = {
  /** The question, as the visitor would ask it. */
  q: string;
  /** The answer it gets, word for word, named as /ask names them: "work.2"
      is the second answer in the thread "work", and "personal-food.1" the
      personal answer "food". */
  answer: string;
};
