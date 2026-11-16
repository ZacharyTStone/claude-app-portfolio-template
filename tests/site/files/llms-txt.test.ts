/* llms.txt, as the build writes it for the sample site (src/site/files/llms-txt.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { llmsTxt } from "../../../src/site/files/llms-txt.ts";
import { FAVICONS } from "../../../src/site/icons.ts";
import { plainAnswers } from "../../../src/site/plain-answers.ts";
import { makeSite } from "../../../src/site/site.ts";
import { samplePosts } from "../../sample/qiita.ts";
import { sampleConfig } from "../sample.ts";

/** The sample's posts in its Writing tab, as its build has them. */
const posts = await samplePosts();

/** The sample with Ask on, on the one host that runs it. */
const withAsk = makeSite(sampleConfig({ host: "cloudflare", ask: { role: "an engineer" } }), posts);
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
  assert.equal(llmsTxt(makeSite(sampleConfig({ host: "static", ask: undefined }), posts)), llmsText);
});

test("llms.txt has no Links section for a site whose panel links nowhere", () => {
  const withoutPanel = sampleConfig();
  for (const language of Object.values(withoutPanel.languages)) language.panel = {};
  assert.ok(!llmsTxt(makeSite(withoutPanel)).includes("## Links"));
});

test("llms.txt lists each language's home page, then the page of each of the main language's tabs", () => {
  const site = "https://example.com/portfolio";
  const pages = [
    `- [Portfolio (EN)](${site}/)`,
    `- [Portfolio (FR)](${site}/fr/)`,
    `- [About](${site}/about/)`,
    `- [Work](${site}/work/)`,
    `- [Writing](${site}/writing/)`,
    `- [for fun?](${site}/personal-fun/)`,
  ];
  assert.ok(llmsText.includes(`## Pages\n\n${pages.join("\n")}\n\n`));
});

test("a panel row that links to a tab is listed at the tab's page", () => {
  const withALinkToATab = sampleConfig();
  for (const language of Object.values(withALinkToATab.languages)) {
    language.panel.outputs?.rows.push({ label: "My work", meta: "Tab", icon: "work", href: "#work" });
  }
  assert.ok(llmsTxt(makeSite(withALinkToATab)).includes("- [My work](https://example.com/portfolio/work/): Tab\n"));
});

test("llms.txt lists the Writing tab's posts, newest first, each by its title with its address, day and tags", () => {
  assert.ok(
    llmsText.includes(
      [
        "\n## Writing\n",
        "- [Astroで静的サイトを組み立てる](https://qiita.com/sam-sample/items/c0ffee0000000000c0f1): 2026-10-01 · Astro, TypeScript",
        "- [Testing a static site in Playwright](https://qiita.com/sam-sample/items/c0ffee0000000000c0f3): 2026-06-15 · Playwright\n",
      ].join("\n"),
    ),
  );
});

test("a post's title can't end the link it's written in", () => {
  const [first] = posts;
  assert.ok(first);
  const bracketed = llmsTxt(makeSite(sampleConfig(), [{ ...first, title: "Arrays [] and ](links)" }]));
  assert.ok(bracketed.includes(`- [Arrays \\[\\] and \\](links)](${first.url}): `));
});

test("llms.txt has no Writing section for a site with no posts, or no Writing tab", () => {
  assert.ok(!llmsTxt(makeSite(sampleConfig(), [])).includes("\n## Writing\n"));
  assert.ok(!llmsTxt(makeSite(sampleConfig({ writing: undefined }), posts)).includes("\n## Writing\n"));
});
