/* src/app/conversation/exchange.ts: what a reply from /ask comes to for the
   question it answers, what goes to the owner of a question with no
   answer, and which tabs a chat's answers are from. */

import assert from "node:assert/strict";
import { test } from "node:test";
import type { AskResponse } from "../../../src/contracts/ask.ts";
import {
  isRemoved,
  isUnasked,
  outcomeOf,
  questionForOwner,
  questionWithAnswer,
  tabAnsweredFrom,
  tabsAnsweredFrom,
  threadChoice,
  typedQuestion,
  withOutcome,
  type Outcome,
  type TypedQuestion,
} from "../../../src/app/conversation/exchange.ts";

const REPLY = "Sam has written TypeScript since 2019.";
const CITED = ["Sam writes TypeScript.", "Since 2019."];
const TO_OWNER = "Do you know Rust?";

const everyAnswerIsOnThePage = (): boolean => true;
const noAnswerIsOnThePage = (): boolean => false;

const OUTCOMES: Record<string, { response: AskResponse | null; outcome: Outcome }> = {
  "an answer": { response: { id: "work.2" }, outcome: { kind: "answered", answerId: "work.2" } },
  "an answer, with the questions left": {
    response: { id: "work.2", left: 3 },
    outcome: { kind: "answered", answerId: "work.2" },
  },
  "an answer with a reply": {
    response: { id: "work.2", reply: REPLY },
    outcome: { kind: "replied", answerId: "work.2", replyText: REPLY, citedLines: [] },
  },
  "an answer with a reply and the lines it was written from": {
    response: { id: "work.2", reply: REPLY, cited: CITED },
    outcome: { kind: "replied", answerId: "work.2", replyText: REPLY, citedLines: CITED },
  },
  "no answer": { response: { id: null }, outcome: { kind: "unanswered" } },
  "no answer, with the question said to the owner": {
    response: { id: null, toOwner: TO_OWNER, left: 1 },
    outcome: { kind: "unanswered", toOwner: TO_OWNER },
  },
  "no pick, and why": { response: { id: null, why: "busy" }, outcome: { kind: "unanswered" } },
  "no reply at all": { response: null, outcome: { kind: "unanswered" } },
  "a blocked visitor": { response: { blocked: true }, outcome: { kind: "blocked", isRemoved: false } },
  "a question found inappropriate": {
    response: { blocked: true, flagged: true },
    outcome: { kind: "blocked", isRemoved: true },
  },
  "a visitor past the day's questions": {
    response: { id: null, limited: true, limit: 30 },
    outcome: { kind: "limited", limit: 30 },
  },
};

for (const [what, { response, outcome }] of Object.entries(OUTCOMES)) {
  test(`what comes of ${what}`, () => {
    assert.deepEqual(outcomeOf(response, everyAnswerIsOnThePage), outcome);
  });
}

const ANSWERS_THE_PAGE_HASNT: Record<string, AskResponse> = {
  "an answer": { id: "gone.3" },
  "an answer with a reply and its lines": { id: "gone.3", reply: REPLY, cited: CITED },
  "an answer whose id is nothing": { id: "" },
};

for (const [what, response] of Object.entries(ANSWERS_THE_PAGE_HASNT)) {
  test(`${what} that the page hasn't is no answer, and nothing of it is kept`, () => {
    assert.deepEqual(outcomeOf(response, noAnswerIsOnThePage), { kind: "unanswered" });
  });
}

test("the page is asked whether it has the answer by the answer's id", () => {
  const askedFor: string[] = [];
  outcomeOf({ id: "work.2" }, (answerId) => askedFor.push(answerId) > 0);
  assert.deepEqual(askedFor, ["work.2"]);
});

const asked = typedQuestion("Does Sam know Rust?");

test("a question typed in starts out unasked", () => {
  assert.equal(isUnasked(asked), true);
});

test("a question that comes with its answer isn't one to ask", () => {
  assert.equal(isUnasked(questionWithAnswer("What do you do?", "about.1")), false);
});

test("a thread chosen in the card isn't one to ask", () => {
  assert.equal(isUnasked(threadChoice("work")), false);
});

test("a question keeps its words with what came of it", () => {
  const answered = withOutcome(asked, { kind: "answered", answerId: "work.2" }, "Question removed");
  assert.deepEqual(answered, {
    kind: "typed",
    question: "Does Sam know Rust?",
    outcome: { kind: "answered", answerId: "work.2" },
  });
});

test("a question found inappropriate is kept nowhere: the wording for one removed takes its place", () => {
  const removed = withOutcome(asked, { kind: "blocked", isRemoved: true }, "Question removed");
  assert.equal(removed.question, "Question removed");
});

test("a blocked visitor's question, not itself found inappropriate, keeps its words", () => {
  const blocked = withOutcome(asked, { kind: "blocked", isRemoved: false }, "Question removed");
  assert.equal(blocked.question, "Does Sam know Rust?");
});

const REMOVED_OR_NOT: Record<string, { outcome: Outcome; removed: boolean }> = {
  "found inappropriate": { outcome: { kind: "blocked", isRemoved: true }, removed: true },
  "from a visitor blocked for an earlier one": { outcome: { kind: "blocked", isRemoved: false }, removed: false },
  "with no answer": { outcome: { kind: "unanswered" }, removed: false },
};

for (const [what, { outcome, removed }] of Object.entries(REMOVED_OR_NOT)) {
  test(`a question ${what} ${removed ? "is" : "isn't"} shown as removed`, () => {
    assert.equal(isRemoved(withOutcome(asked, outcome, "Question removed")), removed);
  });
}

const withThisOutcome = (outcome: Outcome): TypedQuestion => ({
  kind: "typed",
  question: "Does Sam know Rust?",
  outcome,
});

const FOR_THE_OWNER: Record<string, { outcome: Outcome; goesToOwner: string }> = {
  "a question never asked": { outcome: { kind: "unasked" }, goesToOwner: "Does Sam know Rust?" },
  "a question with no answer": { outcome: { kind: "unanswered" }, goesToOwner: "Does Sam know Rust?" },
  "a question /ask said to the owner": { outcome: { kind: "unanswered", toOwner: TO_OWNER }, goesToOwner: TO_OWNER },
  "a blocked visitor's question": { outcome: { kind: "blocked", isRemoved: false }, goesToOwner: "" },
  "a question found inappropriate": { outcome: { kind: "blocked", isRemoved: true }, goesToOwner: "" },
};

for (const [what, { outcome, goesToOwner }] of Object.entries(FOR_THE_OWNER)) {
  test(`what goes in the email and the message for ${what}`, () => {
    assert.equal(questionForOwner(withThisOutcome(outcome)), goesToOwner);
  });
}

const FROM_A_TAB: Record<string, { outcome: Outcome; tab: string | null }> = {
  "the site's answer": { outcome: { kind: "answered", answerId: "work.2" }, tab: "work" },
  "a personal answer": { outcome: { kind: "answered", answerId: "personal-food.1" }, tab: "personal-food" },
  "/ask's reply from an answer": {
    outcome: { kind: "replied", answerId: "work.2", replyText: REPLY, citedLines: CITED },
    tab: "work",
  },
  "no answer": { outcome: { kind: "unanswered" }, tab: null },
  "nothing asked yet": { outcome: { kind: "unasked" }, tab: null },
  "a blocked question": { outcome: { kind: "blocked", isRemoved: false }, tab: null },
  "the day's limit": { outcome: { kind: "limited", limit: 3 }, tab: null },
};

for (const [what, { outcome, tab }] of Object.entries(FROM_A_TAB)) {
  test(`a question that got ${what} is answered from ${tab ?? "no tab"}`, () => {
    assert.equal(tabAnsweredFrom(withThisOutcome(outcome), everyAnswerIsOnThePage), tab);
  });
}

test("a thread chosen in the card is answered from its tab", () => {
  assert.equal(tabAnsweredFrom(threadChoice("work"), noAnswerIsOnThePage), "work");
});

test("an answer the page hasn't is from no tab", () => {
  assert.equal(tabAnsweredFrom(questionWithAnswer("Rust?", "work.9"), noAnswerIsOnThePage), null);
});

test("a chat's answers are from each tab once, in the order the chat comes to them, and none from what wasn't answered", () => {
  const chat = [
    questionWithAnswer("Rust?", "work.2"),
    typedQuestion("Anything else?"),
    threadChoice("about"),
    withThisOutcome({ kind: "replied", answerId: "work.1", replyText: REPLY, citedLines: [] }),
    questionWithAnswer("Food?", "personal-food.1"),
    threadChoice("about"),
  ];
  assert.deepEqual(tabsAnsweredFrom(chat, everyAnswerIsOnThePage), ["work", "about", "personal-food"]);
  assert.deepEqual(tabsAnsweredFrom([], everyAnswerIsOnThePage), []);
});
