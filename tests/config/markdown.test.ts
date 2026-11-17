/* The config's Markdown (src/config/markdown.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { linksIn, plainText, spans } from "../../src/config/markdown.ts";

test("Markdown is read into words, code, bold, italic and links, nested but for code", () => {
  assert.deepEqual(spans("<b>Hi</b> **bold [a *link*](#about)** and `*code*`"), [
    "<b>Hi</b> ",
    {
      type: "strong",
      spans: ["bold ", { type: "link", href: "#about", spans: ["a ", { type: "em", spans: ["link"] }] }],
    },
    " and ",
    { type: "code", text: "*code*" },
  ]);
});

test("Markdown as plain text is its words, without what marks them", () => {
  assert.equal(plainText("**Bold**, *italic*, `code` and [a link](#about)"), "Bold, italic, code and a link");
});

test("a code span as plain text is its words as they are, asterisks and all", () => {
  assert.equal(plainText("`tests/**/*.test.ts` and `a*b*c`"), "tests/**/*.test.ts and a*b*c");
});

test("the links in Markdown are each where it goes and its words, in order, inside bold too, but not in code", () => {
  assert.deepEqual(linksIn("See **[my *work*](#work)**, `[not](a link)` and [the `PDF`](/b.pdf)"), [
    { href: "#work", text: "my work" },
    { href: "/b.pdf", text: "the PDF" },
  ]);
});
