/* The lines of a picked answer the model named, quoted as they are: the
   owner's own words. */
import { MAX_REPLY_LENGTH } from "../../contracts/ask.ts";
import { gaveNoNumbers, joinPieces, numbered, ownLines, piecesNumbered, type Piece, type Unnamed } from "./lines.ts";

/** Why a quote asked for wasn't sent: the numbers aren't a list of at most
    MAX_QUOTED_LINES, one names no numbered line, the lines (and the ones they
    can't be read without) are the whole answer, which the page shows as it
    is, with no reply, or together they're too long; or one is a card's row,
    a list's item or a figure where only a sentence will do (`rows`). */
export type QuoteCheck = Unnamed | "whole" | "length" | "rows";

/** The reply, or why it was dropped; null when the model asked for none. */
export type Quoted =
  | { outcome: "sent"; reply: string; check?: undefined }
  | { outcome: "dropped"; check: QuoteCheck; reply?: undefined }
  | null;

const dropped = (check: QuoteCheck): Quoted => ({ outcome: "dropped", check });

// The pieces' words run together, to tell whether two lists of pieces say
// the same whatever is between them.
const textWithoutSpaces = (pieces: Piece[]) =>
  pieces
    .map((piece) => piece.text)
    .join("")
    .replace(/\s+/g, "");

/** The reply quoting the pieces `numbers` names, each with the sentences it
    can't be read without, in the answer's order. With `sentencesOnly`, only
    sentences are quoted: a card's row ("frontend: React, Svelte") is what a
    reply is written from, and no reply itself, so where one was to be
    written and wasn't, the page shows the answer instead. */
export function quote(text: string, numbers: unknown, { sentencesOnly = false } = {}): Quoted {
  if (gaveNoNumbers(numbers)) return null;
  const pieces = numbered(text);
  const chosen = piecesNumbered(pieces, numbers);
  if (typeof chosen === "string") return dropped(chosen);
  if (sentencesOnly && chosen.some(({ sentence }) => !sentence)) return dropped("rows");
  // All the answer says: the page shows the answer itself, as it's written.
  if (textWithoutSpaces(chosen) === textWithoutSpaces(ownLines(pieces))) return dropped("whole");
  const reply = joinPieces(chosen);
  if (reply.length > MAX_REPLY_LENGTH) return dropped("length");
  return { outcome: "sent", reply };
}
