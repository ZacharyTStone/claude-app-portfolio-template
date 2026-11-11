/* The reply: the picked answer's own lines, chosen by number
   (src/worker/ask/quote.ts), or none, the pick kept. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_REPLY_LENGTH, isLabel, labelled } from "../../src/shared/ask.ts";
import {
  BETWEEN_LINES,
  MAX_QUOTED,
  neededFor,
  numbered,
  piecesOf,
  pointsBack,
  quote,
  withNumbers,
} from "../../src/worker/ask/quote.ts";
import { NONE } from "../../src/worker/constants.ts";
import { EN, JA, UNWRITTEN, askJson, captureLogs, lines, models, okLeft, stubs, toolCall } from "./fixtures.ts";

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
  const text = `${labelled("picture", "The app.")}\nHe built it:\n${long} The app works.\n${labelled("link", "Resume")}`;
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
  assert.deepEqual(quote(`The app works.\nHe built it:\n${labelled("link", "Resume")}`, [2]), {
    outcome: "dropped",
    check: "range",
  });
});

test("where only sentences will do, a card's row, a list's item or a figure isn't quoted", () => {
  const text = "role: Engineer\nAlex joined in 2024. Alex has two degrees:\nBS in Music, 2016\nAlex is in New York.";
  assert.deepEqual(quote(text, [1], { sentencesOnly: true }), { outcome: "dropped", check: "rows" });
  assert.deepEqual(quote(text, [2, 3], { sentencesOnly: true }), { outcome: "dropped", check: "rows" });
  assert.deepEqual(quote(text, [2, 4], { sentencesOnly: true }), {
    outcome: "sent",
    reply: "Alex joined in 2024. Alex is in New York.",
  });
  // Anywhere else, any line is.
  assert.deepEqual(quote(text, [1]), { outcome: "sent", reply: "role: Engineer" });
});

test("a quote that's the whole answer, or longer than MAX_REPLY_LENGTH, is dropped", () => {
  assert.deepEqual(quote("Alex is in New York. Alex works remotely.", [1, 2]), { outcome: "dropped", check: "whole" });
  // Each fits a reply; the two together don't.
  const sentence = `Long${" word".repeat(Math.ceil(MAX_REPLY_LENGTH / 10))}.`;
  assert.ok(sentence.length <= MAX_REPLY_LENGTH && sentence.length * 2 > MAX_REPLY_LENGTH);
  assert.deepEqual(quote(`${sentence} ${sentence} More.`, [1, 2]), { outcome: "dropped", check: "length" });
  // A picture or a link beside them doesn't make them any less the whole answer.
  const pictured = `Alex is in New York. Alex works remotely.\n${labelled("picture", "The skyline")}`;
  assert.deepEqual(quote(pictured, [1, 2]), { outcome: "dropped", check: "whole" });
  assert.deepEqual(quote("BS in Music, 2016\nMBA, 2020", [1, 2]), { outcome: "dropped", check: "whole" });
  assert.deepEqual(quote(pictured, [2]), { outcome: "sent", reply: "Alex works remotely." });
});

// ---- A reply reads on its own ---------------------------------------------------------

const ROLE = "Alex joined Acme in 2024. It’s a full-stack role: Alex works directly with customers. Alex is on call.";

test("a sentence that opens by pointing back is one a reply can't start with", () => {
  for (const text of [
    "It’s a full-stack role.",
    "It shipped with no downtime.",
    "Its tests run on every pull request.",
    "Those include a notes app.",
    "That workflow saved a week.",
    "This cut the load time in half.",
    "These run every night.",
    "Then Acme hired Alex directly.",
    "And it worked.",
    "Also, Alex wrote the docs.",
    "Both are live.",
    "For example, the notes app.",
    "With that workflow, Alex shipped weekly.",
    "After that, Alex moved to Kobe.",
    "Since then Alex has worked remotely.",
    "🚀 It shipped in May.",
    "その後、同社に直接雇用されました。",
    "このウィジェットは中核機能になりました。",
    "これにより表示が速くなりました。",
    "それ以外の言語にも対応しています。",
    "また、ドキュメントも書きました。",
    "たとえば、メモアプリです。",
  ]) {
    assert.ok(pointsBack({ text, sentence: true }), text);
  }
});

test("but not the owner (he, she, they), the site itself, or someone's words quoted", () => {
  for (const text of [
    "He works remotely.",
    "She works remotely.",
    "They work remotely.",
    "Their stack is TypeScript.",
    "Alex works remotely.",
    "Italy is where Alex studied.",
    "Sony was a client.",
    "IT support was Alex’s first job.",
    "In IT, Alex started on a help desk.",
    "This site is built with Astro.",
    "On this site, every answer is Alex’s own.",
    "These days Alex is in New York.",
    "Those who work with Alex say so.",
    "So far Alex has shipped three apps.",
    "In 2024 Alex joined Acme.",
    "For one team, Alex replayed seven weeks of history.",
    "The widget became a core feature.",
    "“It works great.” (A coworker)",
    "このサイトはAstroで作られています。",
    "これまでに3つのアプリを公開しました。",
    "それぞれの言語にページがあります。",
    "東京に住んでいます。",
    "また弾き始めたいと思っています。",
  ]) {
    assert.ok(!pointsBack({ text, sentence: true }), text);
  }
});

test("a sentence that points back is quoted with the one before it, whichever of the two was asked for", () => {
  const reply = "Alex joined Acme in 2024. It’s a full-stack role: Alex works directly with customers.";
  assert.deepEqual(quote(ROLE, [2]), { outcome: "sent", reply });
  assert.deepEqual(quote(ROLE, [1, 2]), { outcome: "sent", reply });
  // The sentence before it doesn't need it, and neither does the one after.
  assert.deepEqual(quote(ROLE, [1]), { outcome: "sent", reply: "Alex joined Acme in 2024." });
  assert.deepEqual(quote(ROLE, [3]), { outcome: "sent", reply: "Alex is on call." });
  assert.deepEqual(quote("Acmeに入社しました。その後、東京に移りました。今はリモートです。", [2]), {
    outcome: "sent",
    reply: "Acmeに入社しました。その後、東京に移りました。",
  });
});

test("and with the one before that, when that one points back too: as far as a sentence that doesn't", () => {
  const text =
    "Alex built a counter. It handles one request at a time. It never loses count. Alex also wrote its tests.";
  assert.deepEqual(quote(text, [3]), {
    outcome: "sent",
    reply: "Alex built a counter. It handles one request at a time. It never loses count.",
  });
  // Two that need the same sentence bring it once.
  assert.deepEqual(quote(text, [2, 3]), {
    outcome: "sent",
    reply: "Alex built a counter. It handles one request at a time. It never loses count.",
  });
});

test("the sentence before it may end the paragraph above, a picture or a link between them aside", () => {
  const text = `Alex built ten tools.\n${labelled("picture", "The tools.")}\nThose include a notes app.\nAlex is in New York.`;
  assert.deepEqual(quote(text, [2]), { outcome: "sent", reply: "Alex built ten tools. Those include a notes app." });
});

test("one that points back at no sentence has no number: at a heading, a list, a card, or its own question", () => {
  const unnumbered = (text: string, line: string) =>
    assert.equal(numbered(text).find((piece) => piece.text === line)?.n, undefined, `${line} in ${text}`);
  unnumbered("It’s a notes app. Alex built it in 2024.", "It’s a notes app.");
  unnumbered("The migration:\nIt shipped with no downtime.\nAlex led it.", "It shipped with no downtime.");
  unnumbered("role: Engineer\nIt’s a full-stack role.\nAlex is on call.", "It’s a full-stack role.");
  unnumbered("Alex has two:\nBS in Music, 2016\nThat was in Boston.", "That was in Boston.");
  // Nor one that needs it in turn; the next that doesn't is numbered as ever.
  assert.deepEqual(
    numbered("It’s a notes app. It works offline. Alex built it in 2024. Alex still runs it.").map(({ n }) => n),
    [undefined, undefined, 1, 2],
  );
  assert.equal(
    withNumbers("It’s a notes app. Alex built it in 2024. Alex still runs it."),
    "It’s a notes app. [1] Alex built it in 2024. [2] Alex still runs it.",
  );
});

test("nor one too long for a reply with the sentence it needs", () => {
  const long = `Long${" word".repeat(Math.ceil(MAX_REPLY_LENGTH / 5) - 5)}.`;
  assert.ok(long.length <= MAX_REPLY_LENGTH, "the sentence before it fits a reply on its own");
  assert.deepEqual(
    numbered(`${long} It shipped with no downtime. Alex led it.`).map(({ n }) => n),
    [1, undefined, 2],
  );
});

test("with the sentence it needs, a quote can be the whole answer: dropped, and the page shows the answer", () => {
  assert.deepEqual(quote("Alex built a notes app. It works offline.", [2]), { outcome: "dropped", check: "whole" });
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
    JSON.stringify({ ask: "acme.1", ...UNWRITTEN, reply: "sent" }),
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
