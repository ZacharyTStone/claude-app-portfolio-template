/* Every answer on the site as plain text, a line for each of its blocks.
   ask.json and llms.txt have the same answers in the same words
   (files/ask-json.ts, files/llms-txt.ts). */

import type { AskAnswer } from "../contracts/ask.ts";
import { labelled, personalAnswerId, threadAnswerId } from "../contracts/ask.ts";
import type { Bars, Block, FileCard, CardValue, Flow, LinkCard, Picture } from "../config/blocks.ts";
import { plainText } from "../config/markdown.ts";
import type { GitHubPart } from "../config/github-history.ts";
import { historyLine } from "./history/plain.ts";
import type { Site } from "./site.ts";

/** Each thread's answers, in order, then the personal ones. */
export function plainAnswers(site: Site, code: string): AskAnswer[] {
  const { threads, questions } = site.language(code);
  const lineOf = (block: Block): string => blockText(block, site);
  const threadAnswers = threads.flatMap((thread) =>
    thread.messages.map((message, messageIndex): AskAnswer => ({
      id: threadAnswerId(thread.id, messageIndex + 1),
      title: thread.title,
      q: plainText(message.q),
      // The card its "Read …" line opens onto is part of the answer, and comes first.
      text: joinLines([
        message.read ? cardText(message.read.card) : "",
        ...message.a.map(thread.fetched ? postLine : lineOf),
      ]),
    })),
  );
  const personalAnswers = questions.personal.map((personalAnswer): AskAnswer => ({
    id: personalAnswerId(personalAnswer.id),
    title: personalAnswer.title ?? personalAnswer.q,
    q: plainText(personalAnswer.q),
    text: joinLines(personalAnswer.a.map(lineOf)),
  }));
  return [...threadAnswers, ...personalAnswers];
}

/** The texts that say something, each on a line of its own: Ask quotes an
    answer a line or a sentence at a time (src/worker/ask/quote.ts). */
const joinLines = (texts: string[]): string => texts.filter(Boolean).join("\n");

/** A line, several (a list, a card, a row of pictures), or "" for a picture
    with no caption. `site` has the GitHub history a part of it is drawn from. */
function blockText(block: Block, site?: Site): string {
  if (typeof block === "string") return plainText(block);
  if (Array.isArray(block)) return joinLines(block.map(plainText));
  if ("card" in block) return cardText(block.card);
  if ("bars" in block) return barsText(block.bars);
  if ("flow" in block) return flowText(block.flow);
  if ("quote" in block) return `“${block.quote.text}” (${block.quote.by})`;
  if ("heading" in block) return `${block.heading.title}:`;
  return labelText(block, site);
}

/** The blocks that are read as a label. */
type LabelledBlock = { image: Picture } | { images: Picture[] } | { link: LinkCard } | { github: GitHubPart };

/** A picture says nothing the answer doesn't, but for its caption; a link,
    its name; a part of the GitHub history, what GitHub counts (or "" while
    there's no history). Each is a label: read by the model, never quoted. */
function labelText(block: LabelledBlock, site?: Site): string {
  if ("image" in block) return pictureLabel(block.image.caption);
  if ("images" in block) return joinLines(block.images.map((picture) => pictureLabel(picture.caption)));
  if ("link" in block) return labelled("link", block.link.name);
  return historyLabel(block.github, site);
}

/** "(GitHub: 4,812 contributions on GitHub since 2019, …)". */
const historyLabel = (part: GitHubPart, site?: Site): string =>
  site?.history ? labelled("GitHub", historyLine(part, site.history, site.config.githubHistory?.marks)) : "";

/** A block of the Writing tab's answer: a post's card is its title, a line
    Ask may quote like any sentence, where another card is only a label. A
    title is its author's own words, as the owner's answers are. */
const postLine = (block: Block): string =>
  typeof block === "object" && "link" in block ? block.link.name : blockText(block);

/** "(picture: The home page)". */
const pictureLabel = (caption = ""): string => (caption ? labelled("picture", caption) : "");

/** "Time to load: Before 1.04 s, After 385 ms (64% faster)". A figure says
    what its answer says, so its words are the answer's too. */
function barsText({ title, rows, note }: Bars): string {
  const amounts = rows.map(({ label, value }) => `${label} ${value}`).join(", ");
  return `${title}: ${amounts}${note ? ` (${note})` : ""}`;
}

/** "The pipeline: Draft (by a model) → Review → Publish". */
function flowText({ title, steps }: Flow): string {
  const stepNames = steps.map(({ name, note }) => (note ? `${name} (${note})` : name)).join(" → ");
  return `${title}: ${stepNames}`;
}

/** A row to a line: "company: Acme", then "role: Senior Engineer". */
const cardText = (card: FileCard): string =>
  joinLines(card.lines.map(([key, value]) => `${key}: ${cardValueText(value)}`));

function cardValueText(value: CardValue): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(" ");
  return value.accent;
}
