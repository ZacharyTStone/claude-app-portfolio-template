/* The question card's data: each language's `questions` in site.config.ts
   is a QuestionCard. Portfolio.astro writes it into the page as JSON, and
   src/app/page.ts checks it field by field before the browser code builds
   the card from it: a field added here needs its check there.

       questions: {
         ask: "What would you like to know?",
         topics: [
           { label: "About me", tab: "about" },
           { label: "My work", ask: "Which job?", choices: [{ tab: "acme" }, { tab: "initech" }] },
           { label: "Something personal", ask: "Such as?", personal: true },
         ],
         personal: [{ id: "food", q: "what's your favorite food?", a: ["**Ramen**, of course."] }],
         ui: { … },
       } */

import type { Markdown } from "./markdown.ts";

/** The question card, as site.config.ts has it and the page carries it:
    the card over the composer of every tab, which needs JavaScript. */
export type QuestionCard = {
  /** The card's question, and what the home screen's box asks: "What would
      you like to know?" */
  ask: string;
  /** The choices under it, in order. Four or fewer read best (the build
      says so past that): group the rest under a topic with `choices`. */
  topics: Topic[];
  /** The answers that aren't in a thread. With none, leave the list empty. */
  personal: PersonalAnswer[];
  /** The card's own wording. */
  ui: QuestionCardWords;
};

/** A topic in the question card: it opens a thread (`tab`), or asks a
    second question (`ask`) and lists `choices` (or the personal answers,
    with `personal`). */
export type Topic = {
  /** What the choice says: "My work". */
  label: string;
  /** A line under the label. Left out, it's the thread's first question
      (with `tab`), or the names of what the topic lists. */
  hint?: string;
  /** The id of the thread the topic opens. Leave out for a topic that
      lists choices. */
  tab?: string;
  /** The second question, over the choices: "Which job?" A topic without
      a `tab` needs one. */
  ask?: string;
  /** The threads to choose from, as the topic's second step. */
  choices?: Choice[];
  /** true for the topic that lists the personal answers (but for the
      hidden ones) as its second step. */
  personal?: boolean;
};

/** A choice in the question card that opens a thread. */
export type Choice = {
  /** The thread's id. */
  tab: string;
  /** Leave out to use the thread's name in the sidebar. */
  label?: string;
  /** Leave out to use the row's second line in the sidebar. */
  hint?: string;
};

/** An answer that isn't in a thread. Each gets its own tab. Hidden ones
    aren't in the card, but /ask can pick them. */
export type PersonalAnswer = {
  /** Its own id (ID_PATTERN, as a thread's): "food". Its tab is at
      #personal-food, and /ask names its answer "personal-food.1". */
  id: string;
  /** The question, as a visitor would type it: what the card lists it by,
      and the message its tab shows. */
  q: string;
  /** Paragraphs, or lists of lines. */
  a: Array<Markdown | Markdown[]>;
  /** The tab's name (the question, if left out). */
  title?: string;
  /** A line under the question in the card (the question again, if left
      out). */
  hint?: string;
  /** true to keep it out of the card. It still has its tab, Ask can pick
      it for a typed question, and a question to start with on the home
      screen can name it. Keep those to things that won't go out of date. */
  hidden?: boolean;
};

/** The question card's own wording. */
export type QuestionCardWords = {
  /** The placeholder of the box for a question of the visitor's own: "Ask
      your own question". */
  else: string;
  /** That box's name, for screen readers. */
  elseLabel: string;
  /** The button that sends it, and the home screen's: "Ask". */
  send: string;
  /** The button that goes from a topic's choices back to the topics:
      "Back". */
  back: string;
  /** Beside that button, which step of the card this is: "{n} of {total}". */
  step: string;
  /** The card's name, for screen readers: "Ask a follow-up". */
  followUp: string;
};
