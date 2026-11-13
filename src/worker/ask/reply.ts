/* The reply to a typed question whose answer the page shows: a sentence or
   two written from the lines the picker chose and checked against them or,
   with none written, those lines quoted as they are. */
import { isCitedLines, type AskAnswer } from "../../contracts/ask.ts";
import { ownerNames, type Choices } from "./answers.ts";
import { joinLines, linesToWriteFrom, type Line } from "./lines.ts";
import { quote, quoteSentences, type Quoted } from "./quote.ts";
import type { Writing } from "./prompts/reply.ts";
import { write, writesIn, type Written } from "./write.ts";

/** How making a reply went, for the log. */
type Made = {
  /** How writing one went; undefined when none was to be written. */
  written?: Written;
  /** How quoting the lines went; null when the picker named none. */
  quoted: Quoted;
};

/** The reply made from the lines the picker chose in an answer, as one of
    the kinds /ask sends (src/contracts/ask.ts):
    - written: the reply to send is `text`, with the lines it was written
      from (`cited`), each as the site has it, for the page to show under
      it. None are cited when the reply only repeats them, or when they're
      more than the page takes (`isCitedLines`);
    - quoted: the reply is those lines as they are, so nothing is cited;
    - none: no reply, and the page shows the whole answer. */
export type Reply =
  | ({ text: string; cited?: string[] } & Made & { written: Extract<Written, { outcome: "sent" }> })
  | ({ text: string; cited?: undefined } & Made)
  | ({ text?: undefined; cited?: undefined } & Made);

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
  const { lang } = choices;
  const lines = writesIn(lang) ? linesToWriteFrom(answer.text, lineNumbers) : null;
  // No reply is written when the picker named no lines, or the page is in a
  // language the check can't read: any line named is quoted.
  if (lines === null || !writesIn(lang)) return quotedOr({}, quote(answer.text, lineNumbers));
  const written = await write(ai, model, writingFrom(asked, lines, { ...choices, lang }));
  // A card's row or a figure is what a reply is written from, and no reply
  // itself: with none written, the page shows the answer instead.
  const quoted = quoteSentences(answer.text, lineNumbers);
  if (written.outcome === "dropped") return quotedOr({ written }, quoted);
  return { written, quoted, text: written.reply, cited: citedUnder(written.reply, lines) };
}

// With no reply written: the lines quoted, if they could be; else no reply.
const quotedOr = (made: Pick<Made, "written">, quoted: Quoted): Reply =>
  quoted?.outcome === "sent" ? { ...made, quoted, text: quoted.reply } : { ...made, quoted };

type ChoicesIn<Lang> = Choices & { lang: Lang };

function writingFrom({ question, answer }: Asked, lines: Line[], choices: ChoicesIn<Writing["lang"]>): Writing {
  const { name, role, lang } = choices;
  const { title, q } = answer;
  return { question, lang, lines: joinLines(lines), title, q, name, role, owner: ownerNames(choices) };
}

// The lines to show under a written reply: each one's text. None when the
// reply only repeats them (they'd be shown twice), or when they're more
// than the page takes: a line is never cut.
function citedUnder(reply: string, linesWrittenFrom: Line[]): string[] | undefined {
  if (hasSameWords(reply, joinLines(linesWrittenFrom))) return undefined;
  const lines = linesWrittenFrom.map((line) => line.text);
  return isCitedLines(lines) ? lines : undefined;
}

// Whether two texts have the same words, whatever space is between them.
const hasSameWords = (one: string, other: string) => one.replace(/\s+/g, "") === other.replace(/\s+/g, "");
