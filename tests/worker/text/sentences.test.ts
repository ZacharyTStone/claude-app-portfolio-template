/* An answer's text, cut into pieces: its sentences, and what isn't one.
   Each table is a rule of where a sentence ends, and each row a text. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isLabel, labelled } from "../../../src/contracts/ask.ts";
import { piecesOf } from "../../../src/worker/ask/text/sentences.ts";
import { eachRow } from "../rows.ts";

type Row = readonly [text: string, pieces: readonly string[]];

/** The text, cut: each piece's words. */
const cutInto = (says: string, rows: readonly Row[]) =>
  eachRow(
    says,
    rows,
    ([text]) => text,
    ([text, pieces]) =>
      assert.deepEqual(
        piecesOf(text).map((piece) => piece.text),
        pieces,
      ),
  );

/** Texts that are one piece. */
const notCut = (says: string, texts: readonly string[]) =>
  cutInto(
    says,
    texts.map((text) => [text, [text]] as const),
  );

cutInto("a sentence ends at a full stop, a question mark or an exclamation mark, then a space", [
  [
    "Alex builds web apps. Is it hard? Not really! Mostly fun.",
    ["Alex builds web apps.", "Is it hard?", "Not really!", "Mostly fun."],
  ],
  ["He said.  Then left.", ["He said.", "Then left."]],
  ["One.\tTwo.", ["One.", "Two."]],
  ["Wait... What?! Really?? Yes.", ["Wait...", "What?!", "Really??", "Yes."]],
]);

notCut("not without the space, inside a number or a name, or before a lower-case word", [
  "Is it hard?Not really!Mostly fun.",
  "It went from 1.04 s to 385 ms in v2.0 of the app.",
  "Alex works with Node.js and Next.js every day.",
  "haku. the job tracker, came first.",
]);

notCut("nor after an abbreviation, however it's capitalised, when it starts the text or follows a space or a bracket", [
  "Alex likes small tools, e.g. Make, and i.e. Unix ones.",
  "Talks with Dr. Smith, vs. Mr. Jones, went well.",
  ...["e.g", "i.e", "vs", "cf", "approx", "Mr", "Mrs", "Ms", "Dr", "St", "Jr", "Sr", "E.G", "VS"].map(
    (abbreviation) => `Talks with ${abbreviation}. Smith went well.`,
  ),
  "He likes tools (e.g. Make) a lot.",
  "He likes tools （e.g. Make） a lot.",
  "E.g. Make is one.",
  "Some tools (e.g.) Are fine.",
  "Some tools （e.g.） Are fine.",
]);

cutInto("a word that only ends like an abbreviation, or isn't one, ends its sentence", [
  ["Alex went West. Then home.", ["Alex went West.", "Then home."]],
  ["Alex met Drs. Smith and Jones.", ["Alex met Drs.", "Smith and Jones."]],
  ["Talks with etc. Smith went well.", ["Talks with etc.", "Smith went well."]],
]);

/** What opens a quote or a bracket, and what closes it. */
const PAIRS = [
  ["(", ")"],
  ["（", "）"],
  ["“", "”"],
  ["「", "」"],
  ["『", "』"],
] as const;

cutInto(
  "a mark inside quotes or brackets doesn't end the sentence they're in",
  PAIRS.flatMap(([open, close]): Row[] => [
    [
      `He said ${open}Good. Fine.${close} Then he left. Yes.`,
      [`He said ${open}Good. Fine.${close}`, "Then he left.", "Yes."],
    ],
    [`彼は${open}いい。とても。${close}と言った。はい。`, [`彼は${open}いい。とても。${close}と言った。`, "はい。"]],
  ]),
);

cutInto("a bracket that never closes takes the rest of its line with it; one that never opened closes nothing", [
  ["He said (Good. Fine. Then he left. Yes.", ["He said (Good. Fine. Then he left. Yes."]],
  ["He said Good. Fine.) Then he left. Yes.", ["He said Good.", "Fine.)", "Then he left.", "Yes."]],
]);

cutInto("a bracket just after a sentence belongs to it: who said it, an aside", [
  [
    "What people said: “Thorough. A team player.” (A coworker) “Got it done.” (A leader) Then more.",
    ["What people said: “Thorough. A team player.” (A coworker)", "“Got it done.” (A leader)", "Then more."],
  ],
  ["It ships (in v2. Soon) today. Yes.", ["It ships (in v2. Soon) today.", "Yes."]],
  [
    "End. (An aside.) Next. (Another (nested) one.) Last.",
    ["End. (An aside.)", "Next. (Another (nested) one.)", "Last."],
  ],
  ["End. （An aside.） Next.", ["End. （An aside.）", "Next."]],
  ["End. (Unclosed aside. Next.", ["End.", "(Unclosed aside. Next."]],
  ["End. [An aside.] Next.", ["End.", "[An aside.] Next."]],
]);

cutInto(
  "Japanese is cut at 。！？ with or without a space after, and not where a quote the sentence goes on from closes",
  [
    [
      "東京に住んでいます。本当？はい！「好き。とても。」と言いました。",
      ["東京に住んでいます。", "本当？", "はい！", "「好き。とても。」と言いました。"],
    ],
    ["本当？ はい！ そう。 次。", ["本当？", "はい！", "そう。", "次。"]],
    ["「好き。」と言った。次。", ["「好き。」と言った。", "次。"]],
    ["「好き。」 次。", ["「好き。」", "次。"]],
    [
      "“丁寧です。最高です。” (同僚（Nodeについて）) 次の文です。",
      ["“丁寧です。最高です。” (同僚（Nodeについて）)", "次の文です。"],
    ],
  ],
);

test("what's left after the last sentence is a piece, but not a sentence", () => {
  assert.deepEqual(piecesOf("Alex has been at Acme since 2024. Resume (EN) Resume (JA)"), [
    { text: "Alex has been at Acme since 2024.", sentence: true },
    { text: "Resume (EN) Resume (JA)", sentence: false },
  ]);
});

test("each block of an answer is a line: a card's row doesn't run into the sentence after it", () => {
  assert.deepEqual(piecesOf("company: Acme\nrole: Senior Engineer\nHe joined in 2024. He leads the web team."), [
    { text: "company: Acme", sentence: false },
    { text: "role: Senior Engineer", sentence: false },
    { text: "He joined in 2024.", sentence: true },
    { text: "He leads the web team.", sentence: true },
  ]);
});

test("a label is one piece, whatever is in it, and no sentence", () => {
  const caption = labelled("picture", "The home page. It has a sidebar (on the left).");
  assert.deepEqual(piecesOf(`He built it.\n${caption}\n${labelled("link", "Resume (EN)")}`), [
    { text: "He built it.", sentence: true },
    { text: caption, sentence: false },
    { text: "(link: Resume (EN))", sentence: false },
  ]);
});

test("only a line that is a picture's or a link's name, and nothing else, is a label", () => {
  for (const line of ["(picture: A)", "(link: B (C))"]) assert.ok(isLabel(line), line);
  for (const line of ["(An aside.)", "picture: A", "(picture: A) and more", "He said (link: B)"]) {
    assert.ok(!isLabel(line), line);
  }
});
