/* The reply to a typed question whose answer the page shows: a sentence or
   two written from the lines the picker chose and checked against them
   (write.ts) or, with none written, those lines quoted as they are
   (quote.ts). */
import { isCitedLines, type AskAnswer } from "../../contracts/ask.ts";
import { ownerNames, type Choices } from "./answers.ts";
import { citedPieces, joinPieces, type Piece } from "./lines.ts";
import { quote, type Quoted } from "./quote.ts";
import { write, writesIn, type Writing, type Written } from "./write.ts";

/** The reply made from the lines the picker chose in an answer. */
export type Reply = {
  /** How writing one went; undefined when none was to be written. */
  written?: Written;
  /** How quoting the lines went; null when the picker named none. */
  quoted: Quoted;
  /** The reply to send: the one written, else the lines quoted, else none
      (the page then shows the whole answer). */
  text?: string;
  /** With a reply that was written: the lines it was written from, each as
      the site has it, for the page to show under it. Not with a reply that
      is those lines (quoted, or written word for word the same), nor when
      they're more than the page takes (`isCitedLines`). */
  cited?: string[];
};

/** No answer is shown, so there's nothing to reply from. */
export const NO_REPLY: Reply = { quoted: null };

/** A question, and what the picker chose for it. */
export type Asked = {
  /** The visitor's question, as they typed it. */
  question: string;
  /** The answer the page shows. */
  answer: AskAnswer;
  /** The numbers of its lines the picker says answer the question, exactly
      as the model gave them: nothing has checked them yet. */
  lineNumbers: unknown;
};

/** The reply is written from the lines picked, and its names and numbers
    checked against them; if none passes, the lines are quoted as they are,
    where they're sentences. */
export async function replyFrom(ai: Ai, model: string, asked: Asked, choices: Choices): Promise<Reply> {
  const { answer, lineNumbers } = asked;
  const linesToWriteFrom = writesIn(choices.lang) ? citedPieces(answer.text, lineNumbers) : null;
  if (linesToWriteFrom === null) {
    // No reply is written (the picker named no lines, or the page is in a
    // language the check can't read): any line named is quoted, as it
    // always was.
    const quoted = quote(answer.text, lineNumbers);
    return { quoted, text: quoted?.reply };
  }
  const written = await write(ai, model, writingFrom(asked, linesToWriteFrom, choices));
  // A card's row or a figure is what a reply is written from, and no reply
  // itself: with none written, the page shows the answer instead.
  const quoted = quote(answer.text, lineNumbers, { sentencesOnly: true });
  if (written.reply === undefined) return { written, quoted, text: quoted?.reply };
  return { written, quoted, text: written.reply, cited: citedUnder(written.reply, linesToWriteFrom) };
}

// What a reply to the question is written for and from: lines of the answer.
function writingFrom({ question, answer }: Asked, linesToWriteFrom: Piece[], choices: Choices): Writing {
  const { name, role, lang } = choices;
  const { title, q } = answer;
  return { question, lang, lines: joinPieces(linesToWriteFrom), title, q, name, role, owner: ownerNames(choices) };
}

// The lines to show under a written reply: each one's text. None when the
// reply only repeats them (they'd be shown twice), or when they're more
// than the page takes: a line is never cut.
function citedUnder(reply: string, linesWrittenFrom: Piece[]): string[] | undefined {
  if (hasSameWords(reply, joinPieces(linesWrittenFrom))) return undefined;
  const lines = linesWrittenFrom.map((line) => line.text);
  return isCitedLines(lines) ? lines : undefined;
}

// Whether two texts have the same words, whatever space is between them.
const hasSameWords = (one: string, other: string) => one.replace(/\s+/g, "") === other.replace(/\s+/g, "");
