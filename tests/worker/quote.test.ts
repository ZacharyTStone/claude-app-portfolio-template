/* The lines of a picked answer the model named, quoted as they are: the
   owner's own words, in the answer's order, or the reason they aren't
   quoted. Each table is a rule. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_REPLY_LENGTH, labelled } from "../../src/contracts/ask.ts";
import { MAX_QUOTED_LINES, neededFor, numbered, pointsBack } from "../../src/worker/ask/lines.ts";
import { quote, quoteSentences, type QuoteCheck } from "../../src/worker/ask/quote.ts";
import { piecesOf } from "../../src/worker/ask/text/sentences.ts";
import { EN, JA } from "./support/answers.ts";
import { eachRow } from "./rows.ts";

type Quote = readonly [text: string, numbers: unknown, reply: string];
type NoQuote = readonly [text: string, numbers: unknown];

const quoted = (says: string, rows: readonly Quote[]) =>
  eachRow(
    says,
    rows,
    ([, numbers, reply]) => `${JSON.stringify(numbers)}: ${reply}`,
    ([text, numbers, reply]) => assert.deepEqual(quote(text, numbers), { outcome: "sent", reply }),
  );

const dropped = (check: QuoteCheck, says: string, rows: readonly NoQuote[]) =>
  eachRow(
    says,
    rows,
    ([text, numbers]) => `${check}: ${JSON.stringify(numbers)} of ${text.slice(0, 60)}`,
    ([text, numbers]) => assert.deepEqual(quote(text, numbers), { outcome: "dropped", check }),
  );

const TEXT = "Alex is in New York. Alex works remotely. Alex works mostly with teams in Europe and Asia.";
const DEGREES = "He has two degrees:\nBS in Music, 2016\nMBA, 2020\nHe studied in Boston.\nrole: Engineer";
const ROLE = "Alex joined Acme in 2024. It’s a full-stack role: Alex works directly with customers. Alex is on call.";
const COUNTER =
  "Alex built a counter. It handles one request at a time. It never loses count. Alex also wrote its tests.";

quoted("a quote is the lines named, in the answer's order and in its own words, each once", [
  [TEXT, [2], "Alex works remotely."],
  [TEXT, [3, 1], "Alex is in New York. Alex works mostly with teams in Europe and Asia."],
  [TEXT, [2, 2], "Alex works remotely."],
  [
    "東京に住んでいます。リモートで働いています。主に欧州のチームと。",
    [1, 2],
    "東京に住んでいます。リモートで働いています。",
  ],
]);

quoted("a space follows a sentence, nothing a Japanese one, and a dot a line that isn't a sentence", [
  [DEGREES, [1, 2], "BS in Music, 2016 · MBA, 2020"],
  [DEGREES, [2, 3], "MBA, 2020 · He studied in Boston."],
  [DEGREES, [3, 4], "He studied in Boston. role: Engineer"],
  ["学歴：\n音楽学士、2016年\n東京在住です。\n職種: エンジニア", [1, 2], "音楽学士、2016年 · 東京在住です。"],
  ["本当？はい！そうです。次です。", [1, 2], "本当？はい！"],
]);

test("no numbers is no reply asked for", () => {
  for (const none of [undefined, null, []]) assert.equal(quote(TEXT, none), null);
});

dropped("unreadable", "numbers that aren't a list of whole numbers from 1, or are more than the picker may name", [
  [TEXT, "2"],
  [TEXT, 2],
  [TEXT, [1.5]],
  [TEXT, [-1]],
  [TEXT, ["1"]],
  [TEXT, Array.from({ length: MAX_QUOTED_LINES + 1 }, (_, i) => i + 1)],
]);

dropped("range", "a number that names no numbered line", [
  [TEXT, [0]],
  [TEXT, [4]],
  [TEXT, [1, 9]],
  ["Ramen.", [1]],
  [`The app works.\nHe built it:\n${labelled("link", "Resume")}`, [2]],
]);

const LONG_SENTENCE = `Long${" word".repeat(Math.ceil(MAX_REPLY_LENGTH / 10))}.`;
const PICTURED = `Alex is in New York. Alex works remotely.\n${labelled("picture", "The skyline")}`;

dropped("whole", "a quote that is all the answer says: the page shows the answer itself", [
  ["Alex is in New York. Alex works remotely.", [1, 2]],
  // A picture or a link beside them doesn't make them any less the whole answer.
  [PICTURED, [1, 2]],
  ["BS in Music, 2016\nMBA, 2020", [1, 2]],
  // With the sentence it needs, one line can be the whole answer.
  ["Alex built a notes app. It works offline.", [2]],
]);

test("a quote longer than a reply may be is dropped, though each of its lines fits one", () => {
  assert.ok(LONG_SENTENCE.length <= MAX_REPLY_LENGTH && LONG_SENTENCE.length * 2 > MAX_REPLY_LENGTH);
  assert.deepEqual(quote(`${LONG_SENTENCE} ${LONG_SENTENCE} More.`, [1, 2]), { outcome: "dropped", check: "length" });
  assert.deepEqual(quote(PICTURED, [2]), { outcome: "sent", reply: "Alex works remotely." });
});

test("where only sentences will do, a card's row, a list's item or a figure isn't quoted", () => {
  const text = "role: Engineer\nAlex joined in 2024. Alex has two degrees:\nBS in Music, 2016\nAlex is in New York.";
  assert.deepEqual(quoteSentences(text, [1]), { outcome: "dropped", check: "rows" });
  assert.deepEqual(quoteSentences(text, [2, 3]), { outcome: "dropped", check: "rows" });
  assert.deepEqual(quoteSentences(text, [2, 4]), {
    outcome: "sent",
    reply: "Alex joined in 2024. Alex is in New York.",
  });
  // Anywhere else, any line is.
  assert.deepEqual(quote(text, [1]), { outcome: "sent", reply: "role: Engineer" });
});

quoted("a sentence that points back is quoted with the one before it, whichever of the two was asked for", [
  [ROLE, [2], "Alex joined Acme in 2024. It’s a full-stack role: Alex works directly with customers."],
  [ROLE, [1, 2], "Alex joined Acme in 2024. It’s a full-stack role: Alex works directly with customers."],
  // The sentence before it doesn't need it, and neither does the one after.
  [ROLE, [1], "Alex joined Acme in 2024."],
  [ROLE, [3], "Alex is on call."],
  [
    "Acmeに入社しました。その後、東京に移りました。今はリモートです。",
    [2],
    "Acmeに入社しました。その後、東京に移りました。",
  ],
]);

quoted("and with the one before that, when that one points back too: as far as a sentence that doesn't", [
  [COUNTER, [3], "Alex built a counter. It handles one request at a time. It never loses count."],
  // Two that need the same sentence bring it once.
  [COUNTER, [2, 3], "Alex built a counter. It handles one request at a time. It never loses count."],
]);

quoted("the sentence before it may end the paragraph above, a picture or a link between them aside", [
  [
    `Alex built ten tools.\n${labelled("picture", "The tools.")}\nThose include a notes app.\nAlex is in New York.`,
    [2],
    "Alex built ten tools. Those include a notes app.",
  ],
]);

/** Every one or two of an answer's numbered lines: [1, 1], [1, 2], [2, 2]… */
function everyPairOfNumbers(text: string): [number, number][] {
  const count = numbered(text).filter(({ n }) => n !== undefined).length;
  return Array.from({ length: count }, (_, a) =>
    Array.from({ length: count - a }, (_, more): [number, number] => [a + 1, a + 1 + more]),
  ).flat();
}

test("every quote of every answer is the answer's own text", () => {
  for (const { text } of [...EN, ...JA]) {
    for (const numbers of everyPairOfNumbers(text)) {
      const quotedLines = quote(text, numbers)?.reply?.split(" · ") ?? [];
      for (const piece of quotedLines.flatMap(piecesOf)) assert.ok(text.includes(piece.text), piece.text);
    }
  }
});

test("no reply to any answer opens by pointing back at a line it left out", () => {
  const texts = [...EN, ...JA].map(({ text }) => text);
  for (const text of [...texts, ROLE, "Alex built ten tools.\nThose include a notes app.\nAlex is in New York."]) {
    const pieces = numbered(text);
    for (const [at, piece] of pieces.entries()) {
      if (piece.n === undefined) continue;
      const first = pieces[neededFor(pieces, at)?.[0] ?? -1];
      assert.ok(first && !pointsBack(first), `${piece.text} starts at ${first?.text}`);
      const quoted = quote(text, [piece.n]);
      if (quoted?.reply !== undefined) assert.ok(quoted.reply.startsWith(first.text), quoted.reply);
    }
  }
});
