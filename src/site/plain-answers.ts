/* Every answer on the site as plain text, a line for each of its blocks,
   with the id that names it (src/contracts/ask.ts). ask.json and llms.txt
   have the same answers in the same words (files/ask-json.ts,
   files/llms-txt.ts). */

import type { AskAnswer } from "../contracts/ask.ts";
import { labelled, personalAnswerId, threadAnswerId } from "../contracts/ask.ts";
import type { Bars, Block, FileCard, CardValue, Flow } from "../config/blocks.ts";
import { plainText } from "../config/markdown.ts";
import type { Site } from "./site.ts";

/** Every answer in one language, as plain text: each thread's, in order,
    then the personal ones. */
export function plainAnswers(site: Site, code: string): AskAnswer[] {
  const { threads, questions } = site.lang(code);
  const threadAnswers = threads.flatMap((thread) =>
    thread.messages.map((message, messageIndex): AskAnswer => ({
      id: threadAnswerId(thread.id, messageIndex + 1),
      title: thread.title,
      q: plainText(message.q),
      // The card its "Read …" line opens onto is part of the answer, and comes first.
      text: joinLines([message.read ? cardText(message.read.card) : "", ...message.a.map(blockText)]),
    })),
  );
  const personalAnswers = questions.personal.map((personalAnswer): AskAnswer => ({
    id: personalAnswerId(personalAnswer.id),
    title: personalAnswer.title ?? personalAnswer.q,
    q: plainText(personalAnswer.q),
    text: joinLines(personalAnswer.a.map(blockText)),
  }));
  return [...threadAnswers, ...personalAnswers];
}

/** The texts that say something, each on a line of its own. An answer's
    blocks are joined this way, and so are a list's items and a card's
    rows: Ask quotes an answer a line or a sentence at a time
    (src/worker/ask/quote.ts). */
const joinLines = (texts: string[]): string => texts.filter(Boolean).join("\n");

/** One block of an answer as plain text: a line, several (a list, a card,
    a row of pictures), or "" for a picture with no caption. */
function blockText(block: Block): string {
  if (typeof block === "string") return plainText(block);
  if (Array.isArray(block)) return joinLines(block.map(plainText));
  if ("card" in block) return cardText(block.card);
  if ("bars" in block) return barsText(block.bars);
  if ("flow" in block) return flowText(block.flow);
  if ("quote" in block) return `“${block.quote.text}” (${block.quote.by})`;
  if ("heading" in block) return `${block.heading.title}:`;
  // A picture says nothing the answer doesn't, but for its caption; a link,
  // its name. Each is a label: read by the model, never quoted.
  if ("image" in block) return pictureLabel(block.image.caption);
  if ("images" in block) return joinLines(block.images.map((picture) => pictureLabel(picture.caption)));
  return labelled("link", block.link.name);
}

/** A picture's caption as a label, "(picture: The home page)", or "" for a
    picture without one. */
const pictureLabel = (caption = ""): string => (caption ? labelled("picture", caption) : "");

/** Bars as a line. A figure says what its answer says, so its words are
    the answer's too:
    "Time to load: Before 1.04 s, After 385 ms (64% faster)" */
function barsText({ title, rows, note }: Bars): string {
  const amounts = rows.map(({ label, value }) => `${label} ${value}`).join(", ");
  return `${title}: ${amounts}${note ? ` (${note})` : ""}`;
}

/** A flow as a line: "The pipeline: Draft (by a model) → Review → Publish".
    Its steps, and not the example it may follow through them: that's an
    illustration, which Ask and llms.txt don't read. */
function flowText({ title, steps }: Flow): string {
  const stepNames = steps.map(({ name, note }) => (note ? `${name} (${note})` : name)).join(" → ");
  return `${title}: ${stepNames}`;
}

/** A file card, a row to a line: "company: Acme", then
    "role: Senior Engineer". */
const cardText = (card: FileCard): string =>
  joinLines(card.lines.map(([key, value]) => `${key}: ${cardValueText(value)}`));

/** A card's value on one line: a list's lines are joined with spaces. */
function cardValueText(value: CardValue): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(" ");
  return value.accent;
}
