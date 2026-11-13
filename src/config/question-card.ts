/* Each language's `questions`: the card over the composer of every tab,
   which needs JavaScript. The page carries it to the browser code as JSON.

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

import type { TextBlock } from "./blocks.ts";

export type QuestionCard = {
  /** The card's question, and what the home screen's box asks: "What would
      you like to know?" */
  ask: string;
  /** The choices under the question, in order. Four or fewer read best
      (the build says so past that): group the rest under a topic with
      `choices`. */
  topics: Topic[];
  /** The answers that aren't in a thread. With none, leave the list empty. */
  personal: PersonalAnswer[];
  /** The card's own wording. */
  ui: QuestionCardWords;
};

/** A topic opens a thread at once (`tab`), or asks a second question
    (`ask`) over what to pick from: threads (`choices`), or the personal
    answers (`personal`). */
export type Topic = TabTopic | ChoicesTopic | PersonalTopic;

type TopicLabel = {
  /** What the choice says: "My work". */
  label: string;
  /** A line under the label. Left out, it's the thread's first question
      (with `tab`), or the names of what the topic lists. */
  hint?: string;
};

export type TabTopic = TopicLabel & {
  /** The id of the thread the topic opens. */
  tab: string;
  ask?: never;
  choices?: never;
  /** Only the topic that lists the personal answers has it. */
  personal?: false;
};

type ChoicesTopic = TopicLabel & {
  /** The second question, over the choices: "Which job?" */
  ask: string;
  /** The threads to choose from. */
  choices: Choice[];
  tab?: never;
  /** Only the topic that lists the personal answers has it. */
  personal?: false;
};

type PersonalTopic = TopicLabel & {
  /** The second question, over the personal answers: "Such as?" */
  ask: string;
  /** Lists the personal answers, but for the hidden ones, as the topic's
      second step. */
  personal: true;
  tab?: never;
  choices?: never;
};

type Choice = {
  /** The id of the thread it opens. */
  tab: string;
  /** Leave out to use the thread's name in the sidebar. */
  label?: string;
  /** Leave out to use the row's second line in the sidebar. */
  hint?: string;
};

/** An answer that isn't in a thread. Each gets its own tab. */
export type PersonalAnswer = {
  /** ID_PATTERN, as a thread's: "food". Its tab is at #personal-food, and
      /ask names its answer "personal-food.1". */
  id: string;
  /** The question, as a visitor would type it: what the card lists it by,
      and the message its tab shows. */
  q: string;
  /** The answer: paragraphs, and lists of lines. */
  a: TextBlock[];
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

type QuestionCardWords = {
  /** The placeholder of the box for a question of the visitor's own: "Ask
      your own question". */
  else: string;
  /** That box's name, for screen readers. */
  elseLabel: string;
  /** The button that sends the visitor's question, and the home screen's:
      "Ask". */
  send: string;
  /** The button that goes from a topic's choices back to the topics:
      "Back". */
  back: string;
  /** Beside the back button, which step of the card this is: "{n} of
      {total}". */
  step: string;
  /** The card's name, for screen readers: "Ask a follow-up". */
  followUp: string;
};
