/* src/contracts/links.ts: the question put into "Something else"'s wording,
   and the email link made from it. Asked.astro makes the link as the page
   is built, with the config's sample question; the browser code makes it
   again with the visitor's own. Each test pins what both make today. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { emailLink, newTabAttributes, QUESTION_PLACEHOLDER, withQuestion } from "../../src/contracts/links.ts";

const EMAIL_TEMPLATE = "Hi Sam,\n\nA question from your portfolio:\n{question}\n\nThanks!";
const SUBJECT = "A question & a hello";
const QUESTION = "Does Sam know C++, $& all?";

test("the placeholder is the one the config's wording is written with", () => {
  assert.equal(QUESTION_PLACEHOLDER, "{question}");
});

test("the question goes where the placeholder is", () => {
  assert.equal(withQuestion("Asked: {question}", "Where is Sam based?"), "Asked: Where is Sam based?");
});

test("every placeholder in the wording gets the question", () => {
  assert.equal(withQuestion("{question} ({question})", "Why?"), "Why? (Why?)");
});

test("a $ in the question is put in as it is, not read as a replacement pattern", () => {
  assert.equal(withQuestion("Asked: {question}", "$& $1 $$"), "Asked: $& $1 $$");
});

test("wording without the placeholder is left as it is", () => {
  assert.equal(withQuestion("No question here.", "Why?"), "No question here.");
});

test("a blocked visitor's question is nothing at all, and the wording keeps its place for one", () => {
  assert.equal(withQuestion("A question:\n{question}\nThanks!", ""), "A question:\n\nThanks!");
});

test("the page's email link: mailto: and the address, then the subject and the body, each encoded", () => {
  const link = emailLink("mailto:sam@example.com", SUBJECT, withQuestion(EMAIL_TEMPLATE, QUESTION));
  assert.equal(
    link,
    "mailto:sam@example.com?subject=A%20question%20%26%20a%20hello&body=Hi%20Sam%2C%0A%0AA%20question%20from%20your%20portfolio%3A%0ADoes%20Sam%20know%20C%2B%2B%2C%20%24%26%20all%3F%0A%0AThanks!",
  );
});

test("the link is what Asked.astro writes into the page today", () => {
  const email = "sam@example.com";
  const asked = { subject: SUBJECT, email: EMAIL_TEMPLATE, q: QUESTION };
  // Asked.astro, as it is before it uses these functions.
  const withSampleQuestion = (template: string) => template.replaceAll("{question}", () => asked.q);
  const mailSubject = encodeURIComponent(asked.subject);
  const mailBody = encodeURIComponent(withSampleQuestion(asked.email));
  const writtenToday = `mailto:${email}?subject=${mailSubject}&body=${mailBody}`;
  assert.equal(emailLink(`mailto:${email}`, asked.subject, withQuestion(asked.email, asked.q)), writtenToday);
});

test("the link is what the browser code sets for a visitor's question today", () => {
  const pageHref = "mailto:sam@example.com?subject=Old&body=Old%20body";
  const question = "Where is Sam based?";
  // src/app/replies.ts, as it is before it uses these functions.
  const fill = (template: string) => template.replaceAll("{question}", () => question);
  const [address = ""] = pageHref.split("?");
  const setToday = `${address}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(fill(EMAIL_TEMPLATE))}`;
  assert.equal(emailLink(address, SUBJECT, withQuestion(EMAIL_TEMPLATE, question)), setToday);
});

for (const href of ["https://example.com/x", "//example.com/x", "\\\\example.com/x", "/\\example.com/x"]) {
  test(`${JSON.stringify(href)} goes to another site, so it opens in a new tab and tells that site nothing`, () => {
    assert.deepEqual(newTabAttributes(href), { target: "_blank", rel: "noopener noreferrer" });
  });
}

for (const href of ["#about", "/resume.pdf", "resume.pdf", "mailto:sam@example.com"]) {
  test(`${JSON.stringify(href)} stays on this site or opens mail, so it gets no attributes`, () => {
    assert.deepEqual(newTabAttributes(href), {});
  });
}
