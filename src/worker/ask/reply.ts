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
  /** Undefined when none was to be written. */
  written?: Written;
  /** Null when the picker named no lines. */
  quoted: Quoted;
};

/** The reply, as one of the kinds /ask sends: written (`text`, and in
    `cited` the lines it was written from, as the site has them), quoted
    (`text` is those lines, so nothing is cited), or none (the page shows the
    whole answer). */
export type Reply =
  | ({ text: string; cited?: string[] } & Made & { written: Extract<Written, { outcome: "sent" }> })
  | ({ text: string; cited?: undefined } & Made)
  | ({ text?: undefined; cited?: undefined } & Made);

/** A question, and what the picker chose for it. */
export type Asked = {
  question: string;
  answer: AskAnswer;
  /** As the model gave them: nothing has checked them yet. */
  lineNumbers: unknown;
};

export async function replyFrom(ai: Ai, model: string, asked: Asked, choices: Choices): Promise<Reply> {
  const { answer, lineNumbers } = asked;
  const { lang } = choices;
  const lines = writesIn(lang) ? linesToWriteFrom(answer.text, lineNumbers) : null;
  // No reply is written when the picker named no lines, or the page is in a
  // language the check can't read: any line named is quoted.
  if (lines === null || !writesIn(lang)) return quotedOrNone({}, quote(answer.text, lineNumbers));
  const written = await write(ai, model, writingFrom(asked, lines, { ...choices, lang }));
  // A card's row or a figure is what a reply is written from, and no reply
  // itself: with none written, the page shows the answer instead.
  const quoted = quoteSentences(answer.text, lineNumbers);
  if (written.outcome === "dropped") return quotedOrNone({ written }, quoted);
  return { written, quoted, text: written.reply, cited: citedUnder(written.reply, lines) };
}

const quotedOrNone = (made: Pick<Made, "written">, quoted: Quoted): Reply =>
  quoted?.outcome === "sent" ? { ...made, quoted, text: quoted.reply } : { ...made, quoted };

type ChoicesIn<Lang> = Choices & { lang: Lang };

function writingFrom({ question, answer }: Asked, lines: Line[], choices: ChoicesIn<Writing["lang"]>): Writing {
  const { name, role, lang } = choices;
  const { title, q } = answer;
  return { question, lang, lines: joinLines(lines), title, q, name, role, owner: ownerNames(choices) };
}

// None when the reply only repeats its lines (they'd be shown twice), or
// when they're more than the page takes: a line is never cut.
function citedUnder(reply: string, linesWrittenFrom: Line[]): string[] | undefined {
  if (hasSameWordsWhateverTheSpacing(reply, joinLines(linesWrittenFrom))) return undefined;
  const lines = linesWrittenFrom.map((line) => line.text);
  return isCitedLines(lines) ? lines : undefined;
}

const hasSameWordsWhateverTheSpacing = (one: string, other: string) =>
  one.replace(/\s+/g, "") === other.replace(/\s+/g, "");
