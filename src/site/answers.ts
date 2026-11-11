/* ask.json, what /ask picks from: every answer on the site as plain text,
   a line for each of its blocks, with the id that names it
   (src/shared/ask.ts). llms.txt has the same answers in the same words
   (llms.ts). */

import type { AskAnswer, AskIndex } from "../shared/ask.ts";
import { labelled, personalAnswerId, threadAnswerId } from "../shared/ask.ts";
import type { Bars, Block, Card, Flow } from "../shared/content.ts";
import { plainText } from "../shared/markdown.ts";
import type { Site } from "./site.ts";

export function askIndex(site: Site, role: string): string {
  const index: AskIndex = {
    name: site.config.name,
    names: Object.fromEntries(site.codes.map((code) => [code, site.lang(code).person.name])),
    role,
    main: site.main,
    answers: Object.fromEntries(site.codes.map((code) => [code, plainAnswers(site, code)])),
  };
  return `${JSON.stringify(index, null, 2)}\n`;
}

/** Every answer in one language, as plain text: each thread's, in order,
    then the personal ones. */
export function plainAnswers(site: Site, code: string): AskAnswer[] {
  const { threads, questions } = site.lang(code);
  return [
    ...threads.flatMap((t) =>
      t.messages.map((m, i) => ({
        id: threadAnswerId(t.id, i + 1),
        title: t.title,
        q: plainText(m.q),
        text: lines([m.read ? cardText(m.read.card) : "", ...m.a.map(blockText)]),
      })),
    ),
    ...questions.personal.map((p) => ({
      id: personalAnswerId(p.id),
      title: p.title ?? p.q,
      q: plainText(p.q),
      text: lines(p.a.map(blockText)),
    })),
  ];
}

// Each block on a line of its own, and each item of a list and row of a
// card: Ask quotes an answer a line or a sentence at a time (quote.ts).
const lines = (blocks: string[]): string => blocks.filter(Boolean).join("\n");

function blockText(b: Block): string {
  if (typeof b === "string") return plainText(b);
  if (Array.isArray(b)) return lines(b.map(plainText));
  if ("card" in b) return cardText(b.card);
  if ("bars" in b) return barsText(b.bars);
  if ("flow" in b) return flowText(b.flow);
  if ("quote" in b) return `“${b.quote.text}” (${b.quote.by})`;
  if ("heading" in b) return `${b.heading.title}:`;
  // A picture says nothing the answer doesn't, but for its caption; a link,
  // its name. Each is a label: read by the model, never quoted.
  if ("image" in b) return picture(b.image.caption);
  if ("images" in b) return lines(b.images.map((image) => picture(image.caption)));
  return labelled("link", b.link.name);
}

const picture = (caption = ""): string => (caption ? labelled("picture", caption) : "");

// A figure says what its answer says, so its words are the answer's too:
// "Time to load: Before 1.04 s, After 385 ms (64% faster)"
const barsText = ({ title, rows, note }: Bars): string =>
  `${title}: ${rows.map(({ label, value }) => `${label} ${value}`).join(", ")}${note ? ` (${note})` : ""}`;

// "The pipeline: Draft (by a model) → Review → Publish"
const flowText = ({ title, steps }: Flow): string =>
  `${title}: ${steps.map(({ name, note }) => (note ? `${name} (${note})` : name)).join(" → ")}`;

// A row to a line: "company: Acme", then "role: Senior Engineer".
const cardText = (card: Card): string =>
  lines(
    card.lines.map(([key, value]) => {
      const text = typeof value === "string" ? value : Array.isArray(value) ? value.join(" ") : value.accent;
      return `${key}: ${text}`;
    }),
  );
