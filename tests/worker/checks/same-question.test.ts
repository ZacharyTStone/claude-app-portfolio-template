/* Whether what the model wrote may go in the message to the owner in place
   of the visitor's question: only if it's the same question, give or take
   who it's about. Each table is a rule, and each row a question and its
   rewrite. */
import assert from "node:assert/strict";
import { MAX_QUESTION_LENGTH } from "../../../src/contracts/ask.ts";
import { checkSameQuestion, type Refused } from "../../../src/worker/ask/checks/same-question.ts";
import { eachRow } from "../rows.ts";

const OWNER = "Alex Example";
const OWNER_IN_TWO_LANGUAGES = "Alex Example アレックス・イグザンプル";

type Row = readonly [question: string, rewrite: string, owner?: string];

const mayBeUsed = (says: string, rows: readonly Row[]) =>
  eachRow(
    says,
    rows,
    ([question, rewrite]) => `${question} → ${rewrite}`,
    ([question, rewrite, owner = OWNER]) =>
      assert.deepEqual(checkSameQuestion(rewrite, question, owner), { toOwner: rewrite }),
  );

const refused = (why: Refused, says: string, rows: readonly Row[]) =>
  eachRow(
    says,
    rows,
    ([question, rewrite]) => `${why}: ${question} → ${JSON.stringify(rewrite)}`,
    ([question, rewrite, owner = OWNER]) => assert.deepEqual(checkSameQuestion(rewrite, question, owner), { why }),
  );

mayBeUsed("a rewrite that says the question to the owner, and changes nothing else, may be used", [
  ["Does Alex know testing?", "Do you know testing?"],
  ["Is Alex available?", "Are you available?"],
  ["What does he think about X?", "What do you think about X?"],
  ["Tell me about Alex's testing", "Tell me about your testing"],
  ["Has she used Vue?", "Have you used Vue?"],
  ["Alex knows Rust?", "You know Rust?"],
  ["What is Alex Example's email?", "What is your email?"],
  ["Alex tries new tools often?", "You try new tools often?"],
  ["Doesn't he like C++?", "Don't you like C++?"],
  ["Was Alex a teacher?", "Were you a teacher?"],
  ["Did they teach themselves?", "Did you teach yourself?"],
  ["Is that code theirs?", "Is that code yours?"],
]);

mayBeUsed(
  "what isn't about the owner stays: a verb that goes with something else, a you that was there, another's her",
  [
    ["How does his app make its questions?", "How does your app make its questions?"],
    ["Can you tell me if Alex knows Rust?", "Can you tell me if you know Rust?"],
    ["Does Alex work with his wife and her team?", "Do you work with your wife and her team?"],
  ],
);

mayBeUsed("each word for the owner may give way to a word for you: their names, in every language, and", [
  ["Is he available?", "Are you available?"],
  ["Is she available?", "Are you available?"],
  ["Are they available?", "Are you available?"],
  ["Tell me about him", "Tell me about you"],
  ["Is this her code?", "Is this your code?"],
  ["Should we hire them?", "Should we hire you?"],
  ["Is this his code?", "Is this your code?"],
  ["Is that code hers?", "Is that code yours?"],
  ["What's their stack?", "What's your stack?"],
  ["Is that code theirs?", "Is that code yours?"],
  ["Did he teach himself?", "Did you teach yourself?"],
  ["Did she teach herself?", "Did you teach yourself?"],
  ["Did they teach themselves?", "Did you teach yourself?"],
  ["Does Example know Rust?", "Do you know Rust?"],
  ["アレックス・イグザンプル knows Rust?", "You know Rust?", OWNER_IN_TWO_LANGUAGES],
  ["Does イグザンプル know Rust?", "Do you know Rust?", OWNER_IN_TWO_LANGUAGES],
]);

mayBeUsed("a verb may take the form that goes with you, where the question has its third-person form", [
  ["Alex is available?", "You are available?"],
  ["Alex is available?", "You're available?"],
  ["Isn't he available?", "Aren't you available?"],
  ["Alex was a teacher?", "You were a teacher?"],
  ["Wasn't Alex a teacher?", "Weren't you a teacher?"],
  ["Alex has shipped it?", "You have shipped it?"],
  ["Alex has shipped it?", "You've shipped it?"],
  ["Hasn't he used Vue?", "Haven't you used Vue?"],
  ["Alex does it?", "You do it?"],
  ["Alex doesn't like it?", "You don't like it?"],
  ["Alex knows Rust?", "You know Rust?"],
  ["Alex watches films?", "You watch films?"],
  ["Alex tries new tools?", "You try new tools?"],
]);

mayBeUsed("a contraction is its word and its ending: either may change with who it's about", [
  ["What's he working on?", "What are you working on?"],
  ["What's he built with Rust?", "What have you built with Rust?"],
  ["Where's Alex based?", "Where're you based?"],
  ["What's he shipped?", "What've you shipped?"],
  ["He's available in May?", "You're available in May?"],
  ["She's shipped it?", "You have shipped it?"],
  ["Alex's available?", "You are available?"],
  ["They're open to contracts?", "You're open to contracts?"],
  ["They've shipped it?", "You've shipped it?"],
  ["He'd relocate?", "You'd relocate?"],
  ["He'll relocate?", "You'll relocate?"],
  // An ending that isn't the owner's stays where it is.
  ["What's Alex's favorite of Acme's tools?", "What's your favorite of Acme's tools?"],
  ["Tell me about Alex’s work", "Tell me about your work"],
  ["Tell me about Alex‘s work", "Tell me about your work"],
]);

mayBeUsed("words are compared without capitals, and with one form of each character", [
  ["does alex know testing", "Do you know testing?"],
  ["Does ALEX know “testing”?", "Do you know testing"],
  ["Does Ａｌｅｘ know testing?", "Do you know testing?"],
]);

mayBeUsed("space, a slash, a long dash or the dot in a katakana name is between words, not part of one", [
  ["Does he/she know CI/CD?", "Do you know CI/CD?"],
  ["Does Alex—or his team—know Rust?", "Do you—or your team—know Rust?"],
  ["Does Alex–or his team–know Rust?", "Do you–or your team–know Rust?"],
  ["Does Alex\tknow Rust?", "Do you know Rust?"],
]);

/** The punctuation round a word that isn't part of it. */
const ROUND_A_WORD = [
  '"',
  "'",
  "“",
  "”",
  "«",
  "»",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "<",
  ">",
  ",",
  ".",
  ";",
  ":",
  "!",
  "?",
  "…",
  "-",
];

mayBeUsed(
  "the punctuation round a word isn't part of it, before the word or after",
  ROUND_A_WORD.map((mark) => [`Does Alex know ${mark}testing${mark} well`, "Do you know testing well"] as const),
);

refused("added", "but a mark inside a word, or one that's part of a name, is: C++ isn't C#, and $50 isn't 50", [
  ["Does Alex know C++?", "Do you know C#?"],
  ["Is Alex's rate $50?", "Is your rate 50?"],
  ["Does Alex know test-ing?", "Do you know testing?"],
]);

refused("added", "a rewrite with a word the question doesn't have may not be used", [
  ["Does Alex know testing?", "Hi Alex! Do you know testing?"],
  ["What is his email?", "Hi, what is your email?"],
  ["Does Alex know testing?", "Yes, Alex knows testing."],
  ["Does Alex know testing?", "I don't have that information."],
  ["Does Alex know testing?", "Do you know Jest testing?"],
  ["Has Alex worked 3 years?", "Have you worked 5 years?"],
  ["Does Alex know testing?", "Do you know testing? (rewritten)"],
  ["Does Alex know testing?", "Do you know testing? https://example.com"],
  ["Does Alex know testing?", "Do you like testing?"],
]);

refused("added", "nor one whose verb takes a form that isn't its own with you", [
  ["Was Alex a teacher?", "Are you a teacher?"],
  ["Is Alex a teacher?", "Were you a teacher?"],
  ["Has Alex a degree?", "Do you a degree?"],
  ["Does Alex teach?", "Have you teach?"],
  ["Hasn't he used Vue?", "Aren't you used Vue?"],
  ["Is his app live?", "Is hi app live?"],
  ["Does Alex know Rust?", "Doe you know Rust?"],
  ["He'll relocate?", "You will relocate?"],
]);

refused("added", "nor one with an ending on a word that isn't a word for you", [
  ["Does Alex know testing?", "Do you know testing're?"],
  ["Does Alex know testing?", "Do you know testing's?"],
]);

refused("dropped", "nor one that leaves out a word of the question's", [
  ["Does Alex know testing and has he led a team?", "Do you know testing?"],
  ["Does Alex know testing?", "Do you know?"],
  ["Has Alex not used Vue?", "Have you used Vue?"],
  ["Does Alex know testing?", "You testing?"],
  ["What's Acme's best tool for Alex?", "What Acme best tool for you?"],
]);

refused("moved", "nor one that says the question's words in another order", [
  ["Is Alex better than Sam?", "Is Sam better than you?"],
  ["Does Alex love cats and hate dogs?", "Do you hate cats and love dogs?"],
  ["Does Alex know testing?", "Do you know testing testing?"],
  ["Does Alex know testing?", "Alex, do you know testing?"],
]);

refused("about", "nor one that's said to no one: the owner left out, or a verb changed, with no you put in", [
  ["Does Alex know testing?", "Does know testing?"],
  ["Does Alex know testing?", "Do Alex know testing?"],
  ["Can you tell me if Alex knows Rust?", "Can you tell me if knows Rust?"],
  ["Alex?", "?"],
]);

refused("same", "the same words aren't worth sending: already said to the owner, or not about them", [
  ["Does Alex know testing?", "Does Alex know testing?"],
  ["Does Alex know testing?", "does alex know testing"],
  ["Does Alex know testing?", "“Does Alex know testing?!”"],
  ["Do you know Rust?", "Do you know Rust?"],
  ["What's the weather in Tokyo?", "What's the weather in Tokyo?"],
]);

const TOO_LONG = `Do you know ${"testing and ".repeat(MAX_QUESTION_LENGTH / 12)}testing?`;

refused("long", "what the page wouldn't take isn't sent: too long, on two lines, with a hidden character, or empty", [
  ["Does Alex know testing?", TOO_LONG],
  ["Does Alex know testing?", "Do you know\ntesting?"],
  ["Does Alex know testing?", "Do you know testing?​"],
  ["Does Alex know testing?", ""],
  ["Does Alex know testing?", "   "],
]);
