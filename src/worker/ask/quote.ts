/* The lines of a picked answer the picker named, quoted as they are: the
   owner's own words. */
import { MAX_REPLY_LENGTH } from "../../contracts/ask.ts";
import { joinLines, linesNamed, namesNoLines, numbered, ownLines, type Line, type Unnamed } from "./lines.ts";

/** Why a quote asked for wasn't sent: the lines can't be told (Unnamed);
    - whole: they (and the ones they can't be read without) are all the
      answer says, which the page shows as it is, with no reply;
    - length: together they're longer than a reply may be;
    - rows: one is a card's row, a list's item or a figure where only a
      sentence will do. */
export type QuoteCheck = Unnamed | "whole" | "length" | "rows";

/** The reply, or why it was dropped; null when the model asked for none. */
export type Quoted =
  | { outcome: "sent"; reply: string; check?: undefined }
  | { outcome: "dropped"; check: QuoteCheck; reply?: undefined }
  | null;

const dropped = (check: QuoteCheck): Quoted => ({ outcome: "dropped", check });

// Whatever is between them: a picture or a link beside the lines doesn't
// make them any less the whole answer.
const wordsRunTogether = (lines: Line[]): string =>
  lines
    .map((line) => line.text)
    .join("")
    .replace(/\s+/g, "");

function quoteOf(named: Line[], all: Line[]): Quoted {
  if (wordsRunTogether(named) === wordsRunTogether(ownLines(all))) return dropped("whole");
  const reply = joinLines(named);
  return reply.length > MAX_REPLY_LENGTH ? dropped("length") : { outcome: "sent", reply };
}

/** The lines `numbers` names, each with the sentences it can't be read
    without, in the answer's order. */
export function quote(text: string, numbers: unknown): Quoted {
  if (namesNoLines(numbers)) return null;
  const all = numbered(text);
  const named = linesNamed(all, numbers);
  return typeof named === "string" ? dropped(named) : quoteOf(named, all);
}

/** The same, where only sentences will do: a card's row ("frontend: React,
    Svelte") is what a reply is written from, and no reply itself. */
export function quoteSentences(text: string, numbers: unknown): Quoted {
  if (namesNoLines(numbers)) return null;
  const all = numbered(text);
  const named = linesNamed(all, numbers);
  if (typeof named === "string") return dropped(named);
  return named.every(({ sentence }) => sentence) ? quoteOf(named, all) : dropped("rows");
}
