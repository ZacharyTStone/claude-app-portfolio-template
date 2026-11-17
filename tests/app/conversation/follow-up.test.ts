/* src/app/conversation/follow-up.ts: the turns a question is sent to /ask
   with from before it in its chat or tab, as the Worker reads them
   (src/worker/ask/request.ts), and never more than a request may hold. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { askRequestFor, lastTurns, turnOf } from "../../../src/app/conversation/follow-up.ts";
import {
  questionWithAnswer,
  threadChoice,
  typedQuestion,
  withOutcome,
  type Outcome,
} from "../../../src/app/conversation/exchange.ts";
import {
  MAX_EARLIER_TURNS,
  MAX_QUESTION_LENGTH,
  MAX_REQUEST_BYTES,
  threadAnswerId,
  type AskTurn,
} from "../../../src/contracts/ask.ts";

const QUESTION = "What did Sam build there?";
const REMOVED = "Question removed";

const firstQuestions: Record<string, string> = { work: "What does Sam do?" };
const firstQuestionOf = (tabId: string): string | null => firstQuestions[tabId] ?? null;

const cameTo = (outcome: Outcome) => withOutcome(typedQuestion(QUESTION), outcome, REMOVED);

test("a question /ask picked an answer for is sent with that answer's id, with a reply or without", () => {
  for (const outcome of [
    { kind: "answered", answerId: "work.2" },
    { kind: "replied", answerId: "work.2", replyText: "Sam built a site.", citedLines: [] },
  ] satisfies Outcome[]) {
    assert.deepEqual(turnOf(cameTo(outcome), firstQuestionOf), { question: QUESTION, id: "work.2" });
  }
  assert.deepEqual(turnOf(questionWithAnswer(QUESTION, "work.1"), firstQuestionOf), {
    question: QUESTION,
    id: "work.1",
  });
});

test("never with the reply's text: /ask reads the answer by its id, in the site's words", () => {
  const replied = cameTo({ kind: "replied", answerId: "work.2", replyText: "Sam built a site.", citedLines: ["X."] });
  assert.ok(!JSON.stringify(turnOf(replied, firstQuestionOf)).includes("Sam built a site."));
});

test("a question with no answer, or not asked, is sent with no id", () => {
  for (const outcome of [
    { kind: "unanswered" },
    { kind: "unanswered", toOwner: "Do you?" },
    { kind: "unasked" },
  ] satisfies Outcome[]) {
    assert.deepEqual(turnOf(cameTo(outcome), firstQuestionOf), { question: QUESTION });
  }
});

test("nothing is sent of a blocked visitor's question, a removed one, or one past the day's limit", () => {
  for (const outcome of [
    { kind: "blocked", isRemoved: false },
    { kind: "blocked", isRemoved: true },
    { kind: "limited", limit: 30 },
  ] satisfies Outcome[]) {
    assert.equal(turnOf(cameTo(outcome), firstQuestionOf), null, JSON.stringify(outcome));
  }
});

test("a thread chosen is sent as its first question, with its first answer's id; one the page hasn't, not at all", () => {
  assert.deepEqual(turnOf(threadChoice("work"), firstQuestionOf), {
    question: firstQuestions.work,
    id: threadAnswerId("work", 1),
  });
  assert.equal(turnOf(threadChoice("gone"), firstQuestionOf), null);
});

test(`the last ${MAX_EARLIER_TURNS} turns are sent, oldest first, each trimmed and cut as the Worker cuts a question`, () => {
  const many: AskTurn[] = Array.from({ length: MAX_EARLIER_TURNS + 2 }, (_, i) => ({
    question: `Q${i}?`,
    id: `t.${i + 1}`,
  }));
  assert.deepEqual(lastTurns(many), many.slice(-MAX_EARLIER_TURNS));
  const long = `  ${"x".repeat(MAX_QUESTION_LENGTH + 10)}  `;
  assert.deepEqual(lastTurns([{ question: long }]), [{ question: "x".repeat(MAX_QUESTION_LENGTH) }]);
});

test("what isn't sent takes no turn's place: the last turns are of those that are", () => {
  const turns = [{ question: "First?" }, null, { question: "Second?", id: "work.1" }, { question: "   " }, null];
  assert.deepEqual(lastTurns(turns), [{ question: "First?" }, { question: "Second?", id: "work.1" }]);
});

test("a question with no turns before it is sent as a page from before follow-ups sent it", () => {
  assert.deepEqual(askRequestFor(QUESTION, "en", []), { question: QUESTION, lang: "en" });
});

test("the turns go with the question, oldest first", () => {
  const earlier = [{ question: "First?" }, { question: "Second?", id: "work.1" }];
  assert.deepEqual(askRequestFor(QUESTION, "en", earlier), { question: QUESTION, lang: "en", earlier });
});

test("turns that would take the request past MAX_REQUEST_BYTES are left out, the oldest first", () => {
  // Three bytes a character in UTF-8: two of these fit, three don't.
  const longest = "あ".repeat(MAX_QUESTION_LENGTH);
  const earlier = [{ question: `${longest.slice(1)}1` }, { question: `${longest.slice(1)}2`, id: "work.1" }];
  const request = askRequestFor(longest, "ja", earlier);
  assert.deepEqual(request.earlier, earlier.slice(1));
  assert.ok(new TextEncoder().encode(JSON.stringify(request)).byteLength <= MAX_REQUEST_BYTES);
  const tooLong = "あ".repeat(MAX_REQUEST_BYTES);
  assert.deepEqual(askRequestFor(tooLong, "ja", earlier), { question: tooLong, lang: "ja" });
});
