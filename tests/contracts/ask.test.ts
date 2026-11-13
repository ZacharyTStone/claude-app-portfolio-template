/* src/contracts/ask.ts: an answer's id read back as it was written, and
   /ask's reply, whose type and schema allow the same six kinds and nothing
   between them. */

import assert from "node:assert/strict";
import { test } from "node:test";
import * as v from "valibot";
import {
  AskResponseSchema,
  MAX_CITED_LENGTH,
  MAX_CITED_LINES,
  MAX_QUESTION_LENGTH,
  MAX_REPLY_LENGTH,
  isCitedLines,
  isLabel,
  isQuestionToOwner,
  labelled,
  parseAnswerId,
  personalAnswerId,
  threadAnswerId,
  type AskBlocked,
  type AskLimited,
  type AskPicked,
  type AskReplied,
  type AskResponse,
  type AskSkipped,
  type AskUnanswered,
} from "../../src/contracts/ask.ts";

test("a thread's answer id is read back as its tab and which answer", () => {
  assert.deepEqual(parseAnswerId(threadAnswerId("work", 2)), { tabId: "work", answerNumber: 2 });
});

test("a personal answer's id is read back as its own tab's first answer", () => {
  assert.deepEqual(parseAnswerId(personalAnswerId("food")), { tabId: "personal-food", answerNumber: 1 });
});

test("an answer past the ninth is read whole", () => {
  assert.deepEqual(parseAnswerId("work-history.12"), { tabId: "work-history", answerNumber: 12 });
});

const NOT_ANSWER_IDS = {
  "nothing at all": "",
  "a tab's id alone": "work",
  "no number after the dot": "work.",
  "no tab before the dot": ".2",
  "an answer counted from 0": "work.0",
  "a number below 1": "work.-1",
  "a number with a leading zero": "work.02",
  "a number that isn't whole": "work.2.5",
  "a number in another notation": "work.1e1",
  "a number too big to count with": "work.99999999999999999999",
  "words for a number": "work.two",
  "a tab id with a capital": "Work.2",
  "a tab id that starts with a digit": "2work.1",
  "a tab id that names an object's own parts": "__proto__.1",
  "spaces around it": " work.2 ",
  "a line break in it": "work.2\n",
};

for (const [what, id] of Object.entries(NOT_ANSWER_IDS)) {
  test(`not an answer's id: ${what}`, () => {
    assert.equal(parseAnswerId(id), null);
  });
}

const REPLY = "Sam has written TypeScript since 2019.";

/** A reply of each kind, typed as its kind: one the type refuses doesn't compile. */
const REPLIES = {
  "an answer": { id: "work.2" } satisfies AskPicked,
  "an answer, with the questions left": { id: "work.2", left: 3 } satisfies AskPicked,
  "an answer with a reply": { id: "work.2", reply: REPLY } satisfies AskReplied,
  "an answer with a reply and the lines it was written from": {
    id: "work.2",
    reply: REPLY,
    cited: ["Sam writes TypeScript.", "Since 2019."],
    left: 0,
  } satisfies AskReplied,
  "no answer": { id: null } satisfies AskUnanswered,
  "no answer, with the question said to the owner": {
    id: null,
    toOwner: "Do you know Rust?",
    left: 1,
  } satisfies AskUnanswered,
  "a blocked visitor": { blocked: true } satisfies AskBlocked,
  "a question found inappropriate": { blocked: true, flagged: true } satisfies AskBlocked,
  "a visitor past the day's questions": { id: null, limited: true, limit: 30 } satisfies AskLimited,
  "no pick, and why": { id: null, why: "budget" } satisfies AskSkipped,
} satisfies Record<string, AskResponse>;

for (const [what, reply] of Object.entries(REPLIES)) {
  test(`the schema reads ${what}`, () => {
    assert.deepEqual(v.parse(AskResponseSchema, JSON.parse(JSON.stringify(reply))), reply);
  });
}

/** Replies of no kind. The type refuses each as the schema does: every
    line marked as an expected error is one that would otherwise compile. */
const IMPOSSIBLE_REPLIES: Record<string, unknown> = {
  // @ts-expect-error A reply is written from an answer.
  "a reply with no answer": { id: null, reply: REPLY } satisfies AskResponse,
  // @ts-expect-error The lines go under a reply.
  "lines with no reply to go under": { id: "work.2", cited: ["Sam writes TypeScript."] } satisfies AskResponse,
  // @ts-expect-error The question is said to the owner in place of an answer.
  "a question to the owner beside an answer": { id: "work.2", toOwner: "Do you know Rust?" } satisfies AskResponse,
  // @ts-expect-error Nothing a blocked visitor typed is said back.
  "a question to the owner for a blocked visitor": { blocked: true, toOwner: "Hi?" } satisfies AskResponse,
  // @ts-expect-error A blocked visitor gets no answer.
  "an answer for a blocked visitor": { blocked: true, id: "work.2" } satisfies AskResponse,
  // @ts-expect-error Past the limit there is no answer.
  "an answer past the day's questions": { id: "work.2", limited: true, limit: 30 } satisfies AskResponse,
  // @ts-expect-error A limit is told with how many it is.
  "a limit without its number": { id: null, limited: true } satisfies AskResponse,
  // @ts-expect-error No pick has one of four reasons.
  "a reason /ask doesn't have": { id: null, why: "tired" } satisfies AskResponse,
  // @ts-expect-error A reply says an answer or that there is none.
  "nothing at all": {} satisfies AskResponse,
  // What only the schema can tell: text the page can't show, and counts that aren't counts.
  "a reply too long to show": { id: "work.2", reply: "x".repeat(MAX_REPLY_LENGTH + 1) },
  "a reply of two lines": { id: "work.2", reply: "One.\nTwo." },
  "lines that are one string": { id: "work.2", reply: REPLY, cited: "Sam writes TypeScript." },
  "fewer than no questions left": { id: "work.2", left: -1 },
  "a field no reply has": { id: "work.2", html: "<b>Sam</b>" },
};

for (const [what, reply] of Object.entries(IMPOSSIBLE_REPLIES)) {
  test(`the schema refuses ${what}`, () => {
    assert.equal(v.safeParse(AskResponseSchema, reply).success, false);
  });
}

test("one field tells a reply's kind: a reply's text is only read from an answer with one", () => {
  const response: AskResponse = REPLIES["an answer with a reply"];
  // Compiles only because checking `reply` leaves the one kind that has it.
  const replied: AskReplied | null = response.reply !== undefined ? response : null;
  assert.equal(replied?.reply, REPLY);
});

const LABELS = ["(picture: A)", "(link: B (C))"];
const NOT_LABELS = ["(An aside.)", "picture: A", "(picture: A) and more", "He said (link: B)"];

for (const line of LABELS) {
  test(`a label: ${line}`, () => {
    assert.equal(isLabel(line), true);
  });
}

for (const line of NOT_LABELS) {
  test(`not a label, which is a whole line that names a picture or a link: ${line}`, () => {
    assert.equal(isLabel(line), false);
  });
}

const QUESTIONS_TO_OWNER = {
  "a question": "Do you know testing?",
  "one as long as a question may be": "x".repeat(MAX_QUESTION_LENGTH),
};

const NOT_QUESTIONS_TO_OWNER: Record<string, unknown> = {
  "one too long": "x".repeat(MAX_QUESTION_LENGTH + 1),
  "two lines": "Do you know\ntesting?",
  "one with a hidden character": "Do you know testing?\u200b",
  "spaces alone": "  ",
  "a number": 42,
  "a list": ["Do you know testing?"],
  nothing: undefined,
};

for (const [what, value] of Object.entries(QUESTIONS_TO_OWNER)) {
  test(`the page takes as the question said to the owner: ${what}`, () => {
    assert.equal(isQuestionToOwner(value), true);
  });
}

for (const [what, value] of Object.entries(NOT_QUESTIONS_TO_OWNER)) {
  test(`the page doesn't take as the question said to the owner: ${what}`, () => {
    assert.equal(isQuestionToOwner(value), false);
  });
}

const LINE = "Alex has been at Acme since 2024.";

const CITED_LINES = {
  "one line": [LINE],
  "as many lines as may be cited": Array.from({ length: MAX_CITED_LINES }, () => LINE),
  "one line as long as all may be together": ["x".repeat(MAX_CITED_LENGTH)],
  "two lines that long together": ["x".repeat(MAX_CITED_LENGTH / 2), "y".repeat(MAX_CITED_LENGTH / 2)],
};

const NOT_CITED_LINES: Record<string, unknown> = {
  "text that isn't a list": LINE,
  "an object that looks like a list": { 0: LINE, length: 1 },
  "no lines": [],
  "one line too many": Array.from({ length: MAX_CITED_LINES + 1 }, () => LINE),
  "lines too long together": ["x".repeat(MAX_CITED_LENGTH / 2), "y".repeat(MAX_CITED_LENGTH / 2 + 1)],
  "a number among them": [LINE, 7],
  "null among them": [LINE, null],
  "an empty line": [LINE, "  "],
  "a line with a line break in it": [`${LINE}\n${LINE}`],
  "a line with a hidden character": [`${LINE}\u200b`],
  "a label among them": [LINE, labelled("picture", "The home page")],
};

for (const [what, lines] of Object.entries(CITED_LINES)) {
  test(`the page takes as the lines under a reply: ${what}`, () => {
    assert.equal(isCitedLines(lines), true);
  });
}

for (const [what, lines] of Object.entries(NOT_CITED_LINES)) {
  test(`the page doesn't take as the lines under a reply: ${what}`, () => {
    assert.equal(isCitedLines(lines), false);
  });
}
