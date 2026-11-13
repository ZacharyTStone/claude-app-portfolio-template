/* The config's Markdown (src/config/markdown.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainText, spans } from "../../src/config/markdown.ts";

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
