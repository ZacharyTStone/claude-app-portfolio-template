/* The reply: the picked answer's own lines, chosen by number
   (src/worker/ask/quote.ts), or none, the pick kept. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_REPLY_LENGTH, isLabel, labelled } from "../../src/shared/ask.ts";
import { BETWEEN_LINES, MAX_QUOTED, numbered, piecesOf, quote, withNumbers } from "../../src/worker/ask/quote.ts";
import { NONE } from "../../src/worker/constants.ts";
import { EN, JA, askJson, captureLogs, lines, models, okLeft, stubs, toolCall } from "./fixtures.ts";

const logs = captureLogs();

const sentences = (text: string) => piecesOf(text).map((piece) => piece.text);

// ---- Sentences ------------------------------------------------------------------------

test("English is cut at a full stop, question or exclamation mark and a space", () => {
  assert.deepEqual(sentences("Alex builds web apps. Is it hard? Not really! Mostly fun."), [
    "Alex builds web apps.",
    "Is it hard?",
    "Not really!",
    "Mostly fun.",
  ]);
});

test("not inside a number, a name, an abbreviation, or before a lower-case word", () => {
  for (const text of [
    "It went from 1.04 s to 385 ms in v2.0 of the app.",
    "Alex works with Node.js and Next.js every day.",
    "Alex likes small tools, e.g. Make, and i.e. Unix ones.",
    "Talks with Dr. Smith, vs. Mr. Jones, went well.",
    "haku. the job tracker, came first.",
  ]) {
    assert.deepEqual(sentences(text), [text]);
  }
});

test("not inside quotes or brackets, and a bracket just after a sentence is its own", () => {
  assert.deepEqual(
    sentences(`What people said: “Thorough. A team player.” (A coworker) “Got it done.” (A leader) Then more.`),
    [`What people said: “Thorough. A team player.” (A coworker)`, `“Got it done.” (A leader)`, "Then more."],
  );
  assert.deepEqual(sentences("It ships (in v2. Soon) today. Yes."), ["It ships (in v2. Soon) today.", "Yes."]);
});

test("Japanese is cut at 。！？, with no space after, and not inside 「」 or “”", () => {
  assert.deepEqual(sentences("東京に住んでいます。本当？はい！「好き。とても。」と言いました。"), [
    "東京に住んでいます。",
    "本当？",
    "はい！",
    "「好き。とても。」と言いました。",
  ]);
  assert.deepEqual(sentences("“丁寧です。最高です。” (同僚（Nodeについて）) 次の文です。"), [
    "“丁寧です。最高です。” (同僚（Nodeについて）)",
    "次の文です。",
  ]);
});

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

test("a label is one piece, whatever is in it, and only a picture's or a link's line is one", () => {
  const caption = labelled("picture", "The home page. It has a sidebar (on the left).");
  assert.deepEqual(piecesOf(`He built it.\n${caption}\n${labelled("link", "Resume (EN)")}`), [
    { text: "He built it.", sentence: true },
    { text: caption, sentence: false },
    { text: "(link: Resume (EN))", sentence: false },
  ]);
  for (const line of ["(picture: A)", "(link: B (C))"]) assert.ok(isLabel(line), line);
  for (const line of ["(An aside.)", "picture: A", "(picture: A) and more", "He said (link: B)"]) {
    assert.ok(!isLabel(line), line);
  }
});

test("all an answer says is numbered: sentences, a list's items, a card's rows, figures", () => {
  const text = [
    "role: Sr. Engineer",
    "He joined in 2024. He has two degrees:",
    "BS in Music, 2016",
    "The stack:",
    "How it ships: Draft → Review → Publish",
    "Email is best: alex@example.com",
  ].join("\n");
  assert.deepEqual(
    numbered(text).map(({ text, n }) => [n, text]),
    [
      [1, "role: Sr. Engineer"],
      [2, "He joined in 2024."],
      [undefined, "He has two degrees:"],
      [3, "BS in Music, 2016"],
      [undefined, "The stack:"],
      [4, "How it ships: Draft → Review → Publish"],
      [5, "Email is best: alex@example.com"],
    ],
  );
  assert.deepEqual(
    numbered("学歴：\n音楽学士、2016年\n東京在住です。").map(({ n }) => n),
    [undefined, 1, 2],
  );
});

test("not a label, a line that leads into the next, one too long, or an answer that says one thing", () => {
  const long = `Long${" word".repeat(MAX_REPLY_LENGTH / 5)}.`;
  const text = `${labelled("picture", "The app.")}\nHe built it:\n${long} It works.\n${labelled("link", "Resume")}`;
  assert.deepEqual(
    numbered(text).map(({ n }) => n),
    [undefined, undefined, undefined, 1, undefined],
  );
  assert.deepEqual(numbered("Ramen."), [{ text: "Ramen.", sentence: true }]);
  assert.equal(withNumbers("Ramen."), "Ramen.");
  // One sentence and a picture is still one thing said.
  assert.equal(withNumbers(`Ramen.\n${labelled("picture", "A bowl")}`), "Ramen. (picture: A bowl)");
});

test("the model reads each numbered piece after its number", () => {
  const acme = EN.find((answer) => answer.id === "acme.1");
  assert.ok(acme);
  assert.equal(
    withNumbers(acme.text),
    "[1] Alex has been at Acme since 2024. [2] Alex moved the web app to server-rendered pages, which cut the time to first load by 40%. [3] Time to load: Before 1.04 s, After 385 ms",
  );
});

// ---- Quotes ---------------------------------------------------------------------------

const TEXT = "Alex is in New York. Alex works remotely. Alex works mostly with teams in Europe and Asia.";

test("lines that aren't sentences are quoted with a dot between them; one after a sentence, with a space", () => {
  const text = "He has two degrees:\nBS in Music, 2016\nMBA, 2020\nHe studied in Boston.\nrole: Engineer";
  assert.deepEqual(quote(text, [1, 2]), { outcome: "sent", reply: `BS in Music, 2016${BETWEEN_LINES}MBA, 2020` });
  assert.deepEqual(quote(text, [2, 3]), { outcome: "sent", reply: `MBA, 2020${BETWEEN_LINES}He studied in Boston.` });
  assert.deepEqual(quote(text, [3, 4]), { outcome: "sent", reply: "He studied in Boston. role: Engineer" });
  assert.deepEqual(quote("学歴：\n音楽学士、2016年\n東京在住です。\n職種: エンジニア", [1, 2]), {
    outcome: "sent",
    reply: `音楽学士、2016年${BETWEEN_LINES}東京在住です。`,
  });
});

test("a quote is the sentences named, in the answer's order, in its own words", () => {
  assert.deepEqual(quote(TEXT, [2]), { outcome: "sent", reply: "Alex works remotely." });
  assert.deepEqual(quote(TEXT, [3, 1]), {
    outcome: "sent",
    reply: "Alex is in New York. Alex works mostly with teams in Europe and Asia.",
  });
  assert.deepEqual(quote(TEXT, [2, 2]), { outcome: "sent", reply: "Alex works remotely." });
  assert.deepEqual(quote("東京に住んでいます。リモートで働いています。主に欧州のチームと。", [1, 2]), {
    outcome: "sent",
    reply: "東京に住んでいます。リモートで働いています。",
  });
});

test("no numbers is no reply asked for; numbers it can't read, or out of range, are dropped", () => {
  for (const none of [undefined, null, []]) assert.equal(quote(TEXT, none), null);
  const tooMany = Array.from({ length: MAX_QUOTED + 1 }, (_, i) => i + 1);
  for (const unreadable of ["2", 2, [1.5], [-1], ["1"], tooMany]) {
    assert.deepEqual(quote(TEXT, unreadable), { outcome: "dropped", check: "unreadable" }, JSON.stringify(unreadable));
  }
  assert.deepEqual(quote(TEXT, [0]), { outcome: "dropped", check: "range" });
  assert.deepEqual(quote(TEXT, [4]), { outcome: "dropped", check: "range" });
  assert.deepEqual(quote(TEXT, [1, 9]), { outcome: "dropped", check: "range" });
  assert.deepEqual(quote("Ramen.", [1]), { outcome: "dropped", check: "range" }, "a lone sentence has no number");
  assert.deepEqual(quote(`It works.\nHe built it:\n${labelled("link", "Resume")}`, [2]), {
    outcome: "dropped",
    check: "range",
  });
});

test("a quote that's the whole answer, or longer than MAX_REPLY_LENGTH, is dropped", () => {
  assert.deepEqual(quote("Alex is in New York. Alex works remotely.", [1, 2]), { outcome: "dropped", check: "whole" });
  const sentence = `Long${" word".repeat(30)}.`;
  assert.deepEqual(quote(`${sentence} ${sentence} More.`, [1, 2]), { outcome: "dropped", check: "length" });
  // A picture or a link beside them doesn't make them any less the whole answer.
  const pictured = `Alex is in New York. Alex works remotely.\n${labelled("picture", "The skyline")}`;
  assert.deepEqual(quote(pictured, [1, 2]), { outcome: "dropped", check: "whole" });
  assert.deepEqual(quote("BS in Music, 2016\nMBA, 2020", [1, 2]), { outcome: "dropped", check: "whole" });
  assert.deepEqual(quote(pictured, [2]), { outcome: "sent", reply: "Alex works remotely." });
});

test("every quote of every answer is the answer's own text", () => {
  for (const { text } of [...EN, ...JA]) {
    const count = numbered(text).filter(({ n }) => n !== undefined).length;
    for (let a = 1; a <= count; a++) {
      for (let b = a; b <= count; b++) {
        const quoted = quote(text, [a, b]);
        if (quoted?.reply !== undefined) {
          for (const line of quoted.reply.split(BETWEEN_LINES)) {
            for (const piece of piecesOf(line)) assert.ok(text.includes(piece.text), piece.text);
          }
        }
      }
    }
  }
});

// ---- Through /ask ---------------------------------------------------------------------

test("a pick with sentence numbers comes with their quote", async () => {
  const { env } = stubs({ run: models(toolCall("acme.1", [1])) });
  assert.deepEqual(await askJson(env, "Since when is Alex at Acme?"), {
    id: "acme.1",
    reply: "Alex has been at Acme since 2024.",
  });
  const ja = stubs({ run: models(toolCall("acme.1", [2])) });
  assert.deepEqual(await askJson(ja.env, "何をした？", "ja"), {
    id: "acme.1",
    reply: "Webアプリをサーバーレンダリングに移行し、初回表示までの時間を40%短縮しました。",
  });
});

test("numbers that name no line: the pick without a reply, and the log says why", async () => {
  logs.mock.resetCalls();
  const runs = [
    models(toolCall("acme.1", [1])),
    models(toolCall("acme.1", [4])),
    models(toolCall("acme.1", "1")),
    models(toolCall("acme.1", [])),
    models(toolCall("acme.1")),
    models({ response: "acme.1" }),
    models(toolCall(NONE, [1])),
  ];
  for (const run of runs) await askJson(stubs({ run }).env, "What does Alex do at Acme?");
  assert.deepEqual(lines(logs), [
    '{"ask":"acme.1","reply":"sent"}',
    '{"ask":"acme.1","reply":"dropped","check":"range"}',
    '{"ask":"acme.1","reply":"dropped","check":"unreadable"}',
    '{"ask":"acme.1"}',
    '{"ask":"acme.1"}',
    '{"ask":"acme.1"}',
    '{"ask":"none"}',
  ]);
});

test("with few questions left, the reply and the count come together", async () => {
  const { env } = stubs({ run: models(toolCall("acme.1", [1])), guardSays: okLeft(3) });
  assert.deepEqual(await askJson(env, "Since when?"), {
    id: "acme.1",
    reply: "Alex has been at Acme since 2024.",
    left: 3,
  });
});
