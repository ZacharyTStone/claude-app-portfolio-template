/* llms.txt, as the build writes it for the sample site (src/site/files/llms-txt.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { llmsTxt } from "../../../src/site/files/llms-txt.ts";
import { FAVICONS } from "../../../src/site/icons.ts";
import { plainAnswers } from "../../../src/site/plain-answers.ts";
import { makeSite } from "../../../src/site/site.ts";
import { sampleConfig } from "../sample.ts";

/** The sample with Ask on, on the one host that runs it. */
const withAsk = makeSite(sampleConfig({ host: "cloudflare", ask: { role: "an engineer" } }));
const llmsText = llmsTxt(withAsk);
const answers = plainAnswers(withAsk, "en");

test("the sample has answers in a thread, in another, and outside both, for llms.txt to list", () => {
  assert.ok(answers.length > 2);
});

for (const { id, title, q, text } of answers) {
  test(`llms.txt has the answer ${id} under its tab's name`, () => {
    assert.ok(llmsText.includes(`### ${title}\n`));
  });

  test(`llms.txt has the answer ${id} under its question, a paragraph for each line Ask reads`, () => {
    assert.ok(llmsText.includes(`**${q}**\n\n${text.split("\n").join("\n\n")}\n`));
  });
}

test("a thread's name heads its answers once, however many it has", () => {
  const withTwoAnswers = sampleConfig();
  for (const language of Object.values(withTwoAnswers.languages)) {
    language.threads[0]?.messages.push({ q: "and then?", a: ["Sam kept at it."] });
  }
  assert.equal(llmsTxt(makeSite(withTwoAnswers)).split("### About\n").length, 2);
});

test("llms.txt lists the panel's link as a full address, under the site's path", () => {
  assert.ok(
    llmsText.includes(`## Links\n\n- [The icon](https://example.com/portfolio${FAVICONS.appleTouch}): Image\n`),
  );
});

test("llms.txt lists the panel's link from the root, for a site at one", () => {
  const atTheRoot = llmsTxt(makeSite(sampleConfig({ url: "https://example.com" })));
  assert.ok(atTheRoot.includes(`](https://example.com${FAVICONS.appleTouch}): Image`));
});

test("a contact link is only under Contact, though the panel has it too", () => {
  assert.equal(llmsText.split("https://github.com/example").length, 2);
});

test("llms.txt is the same whether Ask is on or off", () => {
  assert.equal(llmsTxt(makeSite(sampleConfig({ host: "static", ask: undefined }))), llmsText);
});

test("llms.txt has no Links section for a site whose panel links nowhere", () => {
  const withoutPanel = sampleConfig();
  for (const language of Object.values(withoutPanel.languages)) language.panel = {};
  assert.ok(!llmsTxt(makeSite(withoutPanel)).includes("## Links"));
});
