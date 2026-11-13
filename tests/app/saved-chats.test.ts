/* src/app/conversation/saved-chats.ts: the chats a visitor's browser has
   kept. The golden chats are text as a page wrote it into localStorage: a
   visitor may come back with any of them, so each has to read as it did.
   A new kind of entry is added here; one that's here is never changed. */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  questionWithAnswer,
  threadChoice,
  typedQuestion,
  type Exchange,
  type Outcome,
} from "../../src/app/conversation/exchange.ts";
import {
  readExchange,
  readSavedChats,
  toSaved,
  withChat,
  withoutChat,
  type SavedChat,
  type SavedSource,
} from "../../src/app/conversation/saved-chats.ts";

const NOW = 1_800_000_000_000;

/** One chat as localStorage has it, holding one thing that was sent. */
const savedWith = (source: string): string =>
  `[{"id":"mh3k2a9x","title":null,"sources":[${source}],"created":1731500000000}]`;

/** That chat, read. */
const chatWith = (source: object): SavedChat[] => [
  { id: "mh3k2a9x", title: null, sources: [source as SavedSource], created: 1_731_500_000_000 },
];

/** Each thing a chat holds, as a page has written it, and as it's read. */
const GOLDEN_SOURCES: Record<string, { saved: string; read: object }> = {
  "a thread chosen in the question card": { saved: '{"tab":"work"}', read: { tab: "work" } },
  "a question typed with Ask off, or left before its reply came": {
    saved: '{"question":"Do you know Postgres?"}',
    read: { question: "Do you know Postgres?" },
  },
  "a question the site has no answer for": {
    saved: '{"question":"Are you free next month?","answer":null}',
    read: { question: "Are you free next month?", answer: null },
  },
  "a question with no answer, and how /ask said it to the owner": {
    saved: '{"question":"Does Sam know Rust?","answer":null,"toOwner":"Do you know Rust?"}',
    read: { question: "Does Sam know Rust?", answer: null, toOwner: "Do you know Rust?" },
  },
  "a question with the answer /ask picked": {
    saved: '{"question":"Do you know Postgres?","answer":"work.2"}',
    read: { question: "Do you know Postgres?", answer: "work.2" },
  },
  "a question with a personal answer": {
    saved: '{"question":"What do you eat?","answer":"personal-food.1"}',
    read: { question: "What do you eat?", answer: "personal-food.1" },
  },
  "a question with an answer and the reply /ask made from it": {
    saved: '{"question":"TypeScript?","answer":"work.2","reply":"Sam has written TypeScript since 2019."}',
    read: { question: "TypeScript?", answer: "work.2", reply: "Sam has written TypeScript since 2019." },
  },
  "a question with a reply and the lines it was written from": {
    saved:
      '{"question":"TypeScript?","answer":"work.2","reply":"Sam has written TypeScript since 2019.","cited":["Sam writes TypeScript.","Since 2019."]}',
    read: {
      question: "TypeScript?",
      answer: "work.2",
      reply: "Sam has written TypeScript since 2019.",
      cited: ["Sam writes TypeScript.", "Since 2019."],
    },
  },
  "a question from a blocked visitor": {
    saved: '{"question":"Where are you based?","blocked":true}',
    read: { question: "Where are you based?", blocked: true },
  },
  "a question /ask found inappropriate, kept as the words that took its place": {
    saved: '{"question":"Question removed","blocked":true}',
    read: { question: "Question removed", blocked: true },
  },
  "a question past the day's limit": {
    saved: '{"question":"One more?","limited":30}',
    read: { question: "One more?", limited: 30 },
  },
  "a question past a limit that came without its number": {
    saved: '{"question":"One more?","limited":0}',
    read: { question: "One more?", limited: 0 },
  },
};

for (const [what, { saved, read }] of Object.entries(GOLDEN_SOURCES)) {
  test(`a chat comes back with ${what}`, () => {
    assert.deepEqual(readSavedChats(JSON.parse(savedWith(saved)), NOW), chatWith(read));
  });
}

const GOLDEN_CHATS =
  '[{"id":"mh3k2a9x","title":null,"sources":[{"question":"Do you know Postgres?","answer":"work.2"},{"tab":"about"}],"created":1731500000000},' +
  '{"id":"mh3k9zzz","title":"About the work","sources":[{"question":"Are you free next month?","answer":null}],"created":1731500600000}]';

test("every chat comes back, in the order it was saved, with its name if it was given one", () => {
  assert.deepEqual(readSavedChats(JSON.parse(GOLDEN_CHATS), NOW), [
    {
      id: "mh3k2a9x",
      title: null,
      sources: [{ question: "Do you know Postgres?", answer: "work.2" }, { tab: "about" }],
      created: 1_731_500_000_000,
    },
    {
      id: "mh3k9zzz",
      title: "About the work",
      sources: [{ question: "Are you free next month?", answer: null }],
      created: 1_731_500_600_000,
    },
  ]);
});

test("a field a later version added is kept with what it was saved on, to be written back", () => {
  const saved = savedWith('{"question":"Do you know Postgres?","answer":"work.2","addedLater":{"any":"thing"}}');
  assert.deepEqual(
    readSavedChats(JSON.parse(saved), NOW),
    chatWith({ question: "Do you know Postgres?", answer: "work.2", addedLater: { any: "thing" } }),
  );
});

const NOT_CHATS: Record<string, unknown> = {
  "nothing saved": null,
  text: "chats",
  "one chat that isn't in a list": { id: "mh3k2a9x", title: null, sources: [{ tab: "work" }], created: 1 },
  "a chat that isn't an object": ["mh3k2a9x"],
  "a chat with no id": [{ title: null, sources: [{ tab: "work" }], created: 1 }],
  "a chat whose id isn't text": [{ id: 7, title: null, sources: [{ tab: "work" }], created: 1 }],
  "a chat whose id could be more than an id": [{ id: "x y", title: null, sources: [{ tab: "work" }], created: 1 }],
  "a chat whose id has a capital": [{ id: "Mh3k", title: null, sources: [{ tab: "work" }], created: 1 }],
  "a chat with nothing sent in it": [{ id: "mh3k2a9x", title: null, sources: [], created: 1 }],
  "a chat whose sources aren't a list": [{ id: "mh3k2a9x", title: null, sources: { tab: "work" }, created: 1 }],
};

for (const [what, saved] of Object.entries(NOT_CHATS)) {
  test(`no chat is read from ${what}`, () => {
    assert.deepEqual(readSavedChats(saved, NOW), []);
  });
}

const NOT_SOURCES: Record<string, unknown> = {
  text: "Do you know Postgres?",
  nothing: null,
  "an object with nothing in it": {},
  "a thread that isn't named by text": { tab: 3 },
  "a question that isn't text": { question: 42 },
  "an answer that isn't an id": { question: "Why?", answer: 2 },
  "lines that are one string": { question: "Why?", answer: "work.2", reply: "Because.", cited: "Because." },
  "a line that isn't text": { question: "Why?", answer: "work.2", reply: "Because.", cited: ["Because.", 2019] },
  "a question to the owner that isn't text": { question: "Why?", answer: null, toOwner: 42 },
  "blocked with something other than true": { question: "Why?", blocked: "yes" },
  "blocked: false": { question: "Why?", blocked: false },
  "a limit that isn't a count": { question: "Why?", limited: -1 },
  "a limit as text": { question: "Why?", limited: "30" },
};

for (const [what, source] of Object.entries(NOT_SOURCES)) {
  test(`what a chat holds is left out when it's ${what}`, () => {
    const saved = [{ id: "mh3k2a9x", title: null, sources: [source, { tab: "work" }], created: 1 }];
    assert.deepEqual(readSavedChats(saved, NOW), [
      { id: "mh3k2a9x", title: null, sources: [{ tab: "work" }], created: 1 },
    ]);
  });
}

test("a reply that isn't text stays with its question: what's shown of it is decided when it's shown", () => {
  const saved = [
    { id: "mh3k2a9x", title: null, sources: [{ question: "Why?", answer: "work.2", reply: 42 }], created: 1 },
  ];
  assert.deepEqual(readSavedChats(saved, NOW)[0]?.sources, [{ question: "Why?", answer: "work.2", reply: 42 }]);
});

test("a chat left with nothing that can be read isn't read", () => {
  const saved = [{ id: "mh3k2a9x", title: null, sources: [{ question: 42 }, "?"], created: 1 }];
  assert.deepEqual(readSavedChats(saved, NOW), []);
});

test("of two chats with one id, the first is read", () => {
  const saved = [
    { id: "mh3k2a9x", title: "First", sources: [{ tab: "work" }], created: 1 },
    { id: "mh3k2a9x", title: "Second", sources: [{ tab: "about" }], created: 2 },
  ];
  assert.deepEqual(readSavedChats(saved, NOW), [
    { id: "mh3k2a9x", title: "First", sources: [{ tab: "work" }], created: 1 },
  ]);
});

test("an id is free again after a chat with it that couldn't be read", () => {
  const saved = [
    { id: "mh3k2a9x", title: null, sources: [], created: 1 },
    { id: "mh3k2a9x", title: null, sources: [{ tab: "about" }], created: 2 },
  ];
  assert.deepEqual(readSavedChats(saved, NOW), [
    { id: "mh3k2a9x", title: null, sources: [{ tab: "about" }], created: 2 },
  ]);
});

const NOT_NAMES: Record<string, unknown> = { "left out": undefined, "a number": 7, "a list": ["Chat"] };

for (const [what, title] of Object.entries(NOT_NAMES)) {
  test(`a chat whose name is ${what} has no name of its own`, () => {
    const saved = [{ id: "mh3k2a9x", title, sources: [{ tab: "work" }], created: 1 }];
    assert.equal(readSavedChats(saved, NOW)[0]?.title, null);
  });
}

const NOT_TIMES: Record<string, unknown> = {
  "left out": undefined,
  text: "2024-11-13",
  "not a number": Number.NaN,
  "past the last day a date can be": 8.64e15 + 1,
};

for (const [what, created] of Object.entries(NOT_TIMES)) {
  test(`a chat whose time is ${what} is given the time it's read`, () => {
    const saved = [{ id: "mh3k2a9x", title: null, sources: [{ tab: "work" }], created }];
    assert.equal(readSavedChats(saved, NOW)[0]?.created, NOW);
  });
}

const REPLY = "Sam has written TypeScript since 2019.";
const CITED = ["Sam writes TypeScript.", "Since 2019."];

const typed = (question: string, outcome: Outcome): Exchange => ({ kind: "typed", question, outcome });

/** Each golden entry as the exchange it was. */
const GOLDEN_EXCHANGES: Record<keyof typeof GOLDEN_SOURCES, Exchange> = {
  "a thread chosen in the question card": threadChoice("work"),
  "a question typed with Ask off, or left before its reply came": typed("Do you know Postgres?", {
    kind: "unanswered",
  }),
  "a question the site has no answer for": typed("Are you free next month?", { kind: "unanswered" }),
  "a question with no answer, and how /ask said it to the owner": typed("Does Sam know Rust?", {
    kind: "unanswered",
    toOwner: "Do you know Rust?",
  }),
  "a question with the answer /ask picked": typed("Do you know Postgres?", { kind: "answered", answerId: "work.2" }),
  "a question with a personal answer": typed("What do you eat?", { kind: "answered", answerId: "personal-food.1" }),
  "a question with an answer and the reply /ask made from it": typed("TypeScript?", {
    kind: "replied",
    answerId: "work.2",
    reply: REPLY,
    citedLines: [],
  }),
  "a question with a reply and the lines it was written from": typed("TypeScript?", {
    kind: "replied",
    answerId: "work.2",
    reply: REPLY,
    citedLines: CITED,
  }),
  "a question from a blocked visitor": typed("Where are you based?", { kind: "blocked", isRemoved: false }),
  "a question /ask found inappropriate, kept as the words that took its place": typed("Question removed", {
    kind: "blocked",
    isRemoved: false,
  }),
  "a question past the day's limit": typed("One more?", { kind: "limited", limit: 30 }),
  "a question past a limit that came without its number": typed("One more?", { kind: "unanswered" }),
};

for (const [what, exchange] of Object.entries(GOLDEN_EXCHANGES)) {
  test(`shown again, a chat has ${what}`, () => {
    const saved: unknown = JSON.parse(GOLDEN_SOURCES[what as keyof typeof GOLDEN_SOURCES].saved);
    assert.deepEqual(readExchange(saved as SavedSource), exchange);
  });
}

/** What a page saves of each exchange, to the letter: an older page open in
    another window reads the same text. */
const SAVED_AS: Record<string, { exchange: Exchange; saved: string }> = {
  "a thread chosen in the question card": { exchange: threadChoice("work"), saved: '{"tab":"work"}' },
  "a question not asked yet": {
    exchange: typedQuestion("Do you know Postgres?"),
    saved: '{"question":"Do you know Postgres?"}',
  },
  "a question that came with its answer": {
    exchange: questionWithAnswer("What do you do?", "about.1"),
    saved: '{"question":"What do you do?","answer":"about.1"}',
  },
  "a question with the answer /ask picked": {
    exchange: typed("Do you know Postgres?", { kind: "answered", answerId: "work.2" }),
    saved: GOLDEN_SOURCES["a question with the answer /ask picked"].saved,
  },
  "a question with a reply": {
    exchange: typed("TypeScript?", { kind: "replied", answerId: "work.2", reply: REPLY, citedLines: [] }),
    saved: GOLDEN_SOURCES["a question with an answer and the reply /ask made from it"].saved,
  },
  "a question with a reply and its lines": {
    exchange: typed("TypeScript?", { kind: "replied", answerId: "work.2", reply: REPLY, citedLines: CITED }),
    saved: GOLDEN_SOURCES["a question with a reply and the lines it was written from"].saved,
  },
  "a question with no answer": {
    exchange: typed("Are you free next month?", { kind: "unanswered" }),
    saved: GOLDEN_SOURCES["a question the site has no answer for"].saved,
  },
  "a question with no answer, said to the owner": {
    exchange: typed("Does Sam know Rust?", { kind: "unanswered", toOwner: "Do you know Rust?" }),
    saved: GOLDEN_SOURCES["a question with no answer, and how /ask said it to the owner"].saved,
  },
  "a blocked visitor's question": {
    exchange: typed("Where are you based?", { kind: "blocked", isRemoved: false }),
    saved: GOLDEN_SOURCES["a question from a blocked visitor"].saved,
  },
  "a question past the day's limit": {
    exchange: typed("One more?", { kind: "limited", limit: 30 }),
    saved: GOLDEN_SOURCES["a question past the day's limit"].saved,
  },
  "a question past a limit that came without its number": {
    exchange: typed("One more?", { kind: "limited", limit: 0 }),
    saved: GOLDEN_SOURCES["a question past a limit that came without its number"].saved,
  },
};

for (const [what, { exchange, saved }] of Object.entries(SAVED_AS)) {
  test(`a page saves ${what} as it always has`, () => {
    assert.equal(JSON.stringify(toSaved(exchange)), saved);
  });
}

const question = { question: "Why?" };

/** What a page never saves together, as it's read should it be found so. */
const READ_IN_ONE_ORDER: Record<string, { saved: SavedSource; outcome: Outcome }> = {
  "a limit beside an answer is the limit": {
    saved: { ...question, answer: "work.2", limited: 5 },
    outcome: { kind: "limited", limit: 5 },
  },
  "an answer beside a block is the answer": {
    saved: { ...question, answer: "work.2", blocked: true },
    outcome: { kind: "answered", answerId: "work.2" },
  },
  "a question to the owner beside an answer isn't read": {
    saved: { ...question, answer: "work.2", toOwner: "Do you know why?" },
    outcome: { kind: "answered", answerId: "work.2" },
  },
  "a question to the owner beside a block isn't read": {
    saved: { ...question, blocked: true, toOwner: "Do you know why?" },
    outcome: { kind: "blocked", isRemoved: false },
  },
  "a reply with no answer isn't read": {
    saved: { ...question, answer: null, reply: REPLY },
    outcome: { kind: "unanswered" },
  },
  "an answer id with nothing in it is no answer": {
    saved: { ...question, answer: "" },
    outcome: { kind: "unanswered" },
  },
};

for (const [what, { saved, outcome }] of Object.entries(READ_IN_ONE_ORDER)) {
  test(`saved by no page, but read all the same: ${what}`, () => {
    assert.deepEqual(readExchange(saved), typed("Why?", outcome));
  });
}

const answeredOnly: Outcome = { kind: "answered", answerId: "work.2" };
const repliedWithoutLines: Outcome = { kind: "replied", answerId: "work.2", reply: REPLY, citedLines: [] };

/** A reply, its lines and the question to the owner are shown as text a
    visitor's browser kept, so each is checked again as /ask's are. */
const CHECKED_AGAIN: Record<string, { saved: object; outcome: Outcome }> = {
  "a reply that isn't text": { saved: { answer: "work.2", reply: 42 }, outcome: answeredOnly },
  "a reply of two lines": { saved: { answer: "work.2", reply: "Two\nlines." }, outcome: answeredOnly },
  "a reply of spaces": { saved: { answer: "work.2", reply: "  " }, outcome: answeredOnly },
  "lines without a reply": { saved: { answer: "work.2", cited: CITED }, outcome: answeredOnly },
  "lines under a reply that isn't shown": {
    saved: { answer: "work.2", reply: "Two\nlines.", cited: CITED },
    outcome: answeredOnly,
  },
  "more lines than a reply cites": {
    saved: { answer: "work.2", reply: REPLY, cited: Array.from({ length: 9 }, () => "A line.") },
    outcome: repliedWithoutLines,
  },
  "a line that is a label": {
    saved: { answer: "work.2", reply: REPLY, cited: ["(picture: The home page)"] },
    outcome: repliedWithoutLines,
  },
  "no lines at all": { saved: { answer: "work.2", reply: REPLY, cited: [] }, outcome: repliedWithoutLines },
  "a question to the owner of two lines": {
    saved: { answer: null, toOwner: "Do you\nknow?" },
    outcome: { kind: "unanswered" },
  },
  "a question to the owner of spaces": { saved: { answer: null, toOwner: "   " }, outcome: { kind: "unanswered" } },
};

for (const [what, { saved, outcome }] of Object.entries(CHECKED_AGAIN)) {
  test(`shown again, a chat doesn't show ${what}`, () => {
    assert.deepEqual(readExchange({ ...question, ...saved } as SavedSource), typed("Why?", outcome));
  });
}

const chat = (id: string, title: string | null = null): SavedChat => ({
  id,
  title,
  sources: [{ tab: "work" }],
  created: 1,
});

test("a chat is saved after the others, which stay as another window saved them", () => {
  assert.deepEqual(withChat([chat("first"), chat("second")], chat("third")), [
    chat("first"),
    chat("second"),
    chat("third"),
  ]);
});

test("a chat saved again takes the place of how it was saved, after the others", () => {
  const renamed = chat("first", "A name");
  assert.deepEqual(withChat([chat("first"), chat("second")], renamed), [chat("second"), renamed]);
});

test("a chat with nothing sent in it isn't saved", () => {
  const empty: SavedChat = { id: "third", title: "Renamed while empty", sources: [], created: 1 };
  assert.deepEqual(withChat([chat("first")], empty), [chat("first")]);
});

test("a deleted chat is taken out of what's saved, and the others stay", () => {
  assert.deepEqual(withoutChat([chat("first"), chat("second")], "first"), [chat("second")]);
});
