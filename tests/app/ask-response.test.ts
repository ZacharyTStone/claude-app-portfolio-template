/* src/app/conversation/ask-response.ts: /ask's reply as the page reads it,
   whatever it's sent, and what the page keeps of a reply that ends the
   visit's asking. */

import assert from "node:assert/strict";
import { test } from "node:test";
import * as v from "valibot";
import {
  AskResponseSchema,
  MAX_CITED_LENGTH,
  MAX_CITED_LINES,
  MAX_QUESTION_LENGTH,
  MAX_REPLY_LENGTH,
  type AskResponse,
} from "../../src/contracts/ask.ts";
import { lockFor, lockedResponse, parseAskResponse } from "../../src/app/conversation/ask-response.ts";

const REPLY = "Sam has written TypeScript since 2019.";
const CITED = ["Sam writes TypeScript.", "Since 2019."];
const TO_OWNER = "Do you know Rust?";

/** What /ask sent, and what the page reads it as. */
type Reading = { sent: unknown; read: AskResponse };

const KINDS_OF_REPLY: Record<string, Reading> = {
  "an answer": { sent: { id: "work.2" }, read: { id: "work.2" } },
  "an answer, with the questions left": { sent: { id: "work.2", left: 3 }, read: { id: "work.2", left: 3 } },
  "an answer with a reply": { sent: { id: "work.2", reply: REPLY }, read: { id: "work.2", reply: REPLY } },
  "an answer with a reply and the lines it was written from": {
    sent: { id: "work.2", reply: REPLY, cited: CITED, left: 0 },
    read: { id: "work.2", reply: REPLY, cited: CITED, left: 0 },
  },
  "no answer": { sent: { id: null }, read: { id: null } },
  "no answer, with the question said to the owner": {
    sent: { id: null, toOwner: TO_OWNER, left: 1 },
    read: { id: null, toOwner: TO_OWNER, left: 1 },
  },
  "a blocked visitor": { sent: { blocked: true }, read: { blocked: true } },
  "a question found inappropriate": { sent: { blocked: true, flagged: true }, read: { blocked: true, flagged: true } },
  "a visitor past the day's questions": {
    sent: { id: null, limited: true, limit: 30 },
    read: { id: null, limited: true, limit: 30 },
  },
};

const NOT_A_REPLY: Record<string, Reading> = {
  nothing: { sent: null, read: { id: null } },
  text: { sent: "work.2", read: { id: null } },
  "a number": { sent: 2, read: { id: null } },
  "a list": { sent: [{ id: "work.2" }], read: { id: null } },
  "an object with nothing in it": { sent: {}, read: { id: null } },
  "an answer's id that isn't text": { sent: { id: 2 }, read: { id: null } },
  "no pick, and why (the reason is for the logs)": { sent: { id: null, why: "busy" }, read: { id: null } },
  "a field no reply has": { sent: { id: "work.2", html: "<b>Sam</b>" }, read: { id: "work.2" } },
};

const REPLY_NOT_TO_SHOW: Record<string, Reading> = {
  "a reply too long to show": {
    sent: { id: "work.2", reply: "x".repeat(MAX_REPLY_LENGTH + 1) },
    read: { id: "work.2" },
  },
  "a reply of two lines": { sent: { id: "work.2", reply: "Two\nlines." }, read: { id: "work.2" } },
  "a reply of spaces": { sent: { id: "work.2", reply: "   " }, read: { id: "work.2" } },
  "a reply that isn't text": { sent: { id: "work.2", reply: 42 }, read: { id: "work.2" } },
  "a reply with a hidden character": { sent: { id: "work.2", reply: "Sam​writes." }, read: { id: "work.2" } },
  "a reply with no answer": { sent: { id: null, reply: REPLY }, read: { id: null } },
};

const LINES_NOT_TO_SHOW: Record<string, Reading> = {
  "lines that are one string": {
    sent: { id: "work.2", reply: REPLY, cited: "Sam writes TypeScript." },
    read: { id: "work.2", reply: REPLY },
  },
  "no lines at all": { sent: { id: "work.2", reply: REPLY, cited: [] }, read: { id: "work.2", reply: REPLY } },
  "more lines than a reply cites": {
    sent: { id: "work.2", reply: REPLY, cited: Array.from({ length: MAX_CITED_LINES + 1 }, () => "A line.") },
    read: { id: "work.2", reply: REPLY },
  },
  "lines longer together than a reply cites": {
    sent: {
      id: "work.2",
      reply: REPLY,
      cited: ["x".repeat(MAX_CITED_LENGTH / 2), "y".repeat(MAX_CITED_LENGTH / 2 + 1)],
    },
    read: { id: "work.2", reply: REPLY },
  },
  "a line that is a label, not the owner's words": {
    sent: { id: "work.2", reply: REPLY, cited: ["Sam writes TypeScript.", "(picture: The home page)"] },
    read: { id: "work.2", reply: REPLY },
  },
  "a line that isn't text": {
    sent: { id: "work.2", reply: REPLY, cited: ["Sam writes TypeScript.", 2019] },
    read: { id: "work.2", reply: REPLY },
  },
  "lines with no reply to go under": { sent: { id: "work.2", cited: CITED }, read: { id: "work.2" } },
  "lines under a reply that isn't shown": {
    sent: { id: "work.2", reply: "Two\nlines.", cited: CITED },
    read: { id: "work.2" },
  },
};

const QUESTION_TO_OWNER_NOT_TO_USE: Record<string, Reading> = {
  "a question to the owner longer than a question": {
    sent: { id: null, toOwner: "x".repeat(MAX_QUESTION_LENGTH + 1) },
    read: { id: null },
  },
  "a question to the owner of two lines": { sent: { id: null, toOwner: "Do you know\nRust?" }, read: { id: null } },
  "a question to the owner of spaces": { sent: { id: null, toOwner: "   " }, read: { id: null } },
  "a question to the owner that isn't text": { sent: { id: null, toOwner: 42 }, read: { id: null } },
  "a question to the owner beside an answer": { sent: { id: "work.2", toOwner: TO_OWNER }, read: { id: "work.2" } },
  "a question to the owner for a blocked visitor": {
    sent: { blocked: true, toOwner: TO_OWNER },
    read: { blocked: true },
  },
};

const TURNED_AWAY_ODDLY: Record<string, Reading> = {
  "an answer for a blocked visitor": { sent: { blocked: true, id: "work.2", reply: REPLY }, read: { blocked: true } },
  "blocked, and flagged with something other than true": {
    sent: { blocked: true, flagged: "yes" },
    read: { blocked: true },
  },
  "blocked with something other than true": { sent: { blocked: "yes", id: "work.2" }, read: { id: "work.2" } },
  "an answer past the day's questions": {
    sent: { id: "work.2", limited: true, limit: 30 },
    read: { id: null, limited: true, limit: 30 },
  },
  "a limit without its number": { sent: { id: null, limited: true }, read: { id: null, limited: true, limit: 0 } },
  "a limit that isn't a count": {
    sent: { id: null, limited: true, limit: 2.5 },
    read: { id: null, limited: true, limit: 0 },
  },
  "blocked and past the day's questions": {
    sent: { blocked: true, limited: true, limit: 30 },
    read: { blocked: true },
  },
};

const QUESTIONS_LEFT_NOT_TO_SAY: Record<string, Reading> = {
  "fewer than no questions left": { sent: { id: "work.2", left: -1 }, read: { id: "work.2" } },
  "questions left that aren't a whole number": { sent: { id: null, left: 1.5 }, read: { id: null } },
  "questions left as text": { sent: { id: "work.2", reply: REPLY, left: "3" }, read: { id: "work.2", reply: REPLY } },
};

const EVERY_READING = {
  ...KINDS_OF_REPLY,
  ...NOT_A_REPLY,
  ...REPLY_NOT_TO_SHOW,
  ...LINES_NOT_TO_SHOW,
  ...QUESTION_TO_OWNER_NOT_TO_USE,
  ...TURNED_AWAY_ODDLY,
  ...QUESTIONS_LEFT_NOT_TO_SAY,
};

for (const [what, { sent, read }] of Object.entries(EVERY_READING)) {
  test(`/ask sends ${what}`, () => {
    assert.deepEqual(parseAskResponse(JSON.parse(JSON.stringify(sent))), read);
  });
}

for (const [what, { sent }] of Object.entries(EVERY_READING)) {
  test(`what the page reads is a reply of one kind, whatever /ask sends: ${what}`, () => {
    assert.ok(v.is(AskResponseSchema, parseAskResponse(sent)));
  });
}

// ---- What ends the visit's asking --------------------------------------------------------

const LOCKS: Record<string, { reply: AskResponse; kept: string; laterReply: AskResponse }> = {
  "a blocked visitor": { reply: { blocked: true }, kept: "blocked", laterReply: { blocked: true } },
  "a question found inappropriate": {
    reply: { blocked: true, flagged: true },
    kept: "blocked",
    laterReply: { blocked: true },
  },
  "a visitor past the day's questions": {
    reply: { id: null, limited: true, limit: 30 },
    kept: "limit:30",
    laterReply: { id: null, limited: true, limit: 30 },
  },
  "a limit that came without its number": {
    reply: { id: null, limited: true, limit: 0 },
    kept: "limit:0",
    laterReply: { id: null, limited: true, limit: 0 },
  },
};

for (const [what, { reply, kept }] of Object.entries(LOCKS)) {
  test(`what's kept of ${what}`, () => {
    assert.equal(lockFor(reply), kept);
  });
}

for (const [what, { kept, laterReply }] of Object.entries(LOCKS)) {
  test(`every later question gets the same, with nothing sent: ${what}`, () => {
    assert.deepEqual(lockedResponse(kept), laterReply);
  });
}

const REPLIES_THAT_LOCK_NOTHING: Record<string, AskResponse> = {
  "an answer": { id: "work.2" },
  "an answer with a reply": { id: "work.2", reply: REPLY, left: 0 },
  "no answer": { id: null },
  "no pick, and why": { id: null, why: "budget" },
};

for (const [what, reply] of Object.entries(REPLIES_THAT_LOCK_NOTHING)) {
  test(`the visit goes on asking after ${what}`, () => {
    assert.equal(lockFor(reply), null);
  });
}

const NOT_LOCKS: Record<string, string | null> = {
  "nothing kept": null,
  "nothing in it": "",
  "a word it doesn't keep": "locked",
  "a limit that isn't a number": "limit:many",
  "a limit that isn't whole": "limit:2.5",
  "a limit below none": "limit:-1",
};

for (const [what, kept] of Object.entries(NOT_LOCKS)) {
  test(`the visit isn't locked by ${what}`, () => {
    assert.equal(lockedResponse(kept), null);
  });
}
