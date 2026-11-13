/* src/app/conversation/saved-chats.ts: the chats a visitor's browser has
   kept. The golden chats are text as a page wrote it into localStorage: a
   visitor may come back with any of them, so each has to read as it did.
   A new kind of entry is added here; one that's here is never changed. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readSavedChats, type SavedChat } from "../../src/app/conversation/saved-chats.ts";

const NOW = 1_800_000_000_000;

/** One chat as localStorage has it, holding one thing that was sent. */
const savedWith = (source: string): string =>
  `[{"id":"mh3k2a9x","title":null,"sources":[${source}],"created":1731500000000}]`;

/** That chat, read. */
const chatWith = (source: object): SavedChat[] => [
  { id: "mh3k2a9x", title: null, sources: [source as SavedChat["sources"][number]], created: 1_731_500_000_000 },
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

// ---- What isn't read -----------------------------------------------------------------------

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
