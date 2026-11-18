/* A post's Markdown read into the parts of its page (src/site/writing/body.ts):
   what each kind of Markdown becomes, what's left out, and that no markup,
   and no link but one to a web address, comes through. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { postBlocks, type PostBlock, type PostSpan } from "../../../src/site/writing/body.ts";
import { sampleFixture } from "../../sample/writing.ts";

const paragraph = (...spans: PostSpan[]): PostBlock => ({ type: "paragraph", spans });
const link = (href: string, ...spans: PostSpan[]): PostSpan => ({ type: "link", href, spans });
const strong = (...spans: PostSpan[]): PostSpan => ({ type: "strong", spans });
const BREAK: PostSpan = { type: "break" };

const lines = (...each: string[]): string => each.join("\n");

for (const [what, markdown, blocks] of [
  ["words alone are a paragraph", "Hello.", [paragraph("Hello.")]],
  ["a blank line starts another paragraph", "One.\n\nTwo.", [paragraph("One."), paragraph("Two.")]],
  [
    "a new line in a paragraph is a new line on the page, as on Qiita",
    "One,\ntwo.",
    [paragraph("One,", BREAK, "two.")],
  ],
  [
    "bold, italics, struck-out words and code are marked as they are",
    "**Bold**, *slanted*, ~~gone~~ and `code`.",
    [
      paragraph(
        strong("Bold"),
        ", ",
        { type: "em", spans: ["slanted"] },
        ", ",
        { type: "del", spans: ["gone"] },
        " and ",
        { type: "code", text: "code" },
        ".",
      ),
    ],
  ],
  [
    "a link to a web address is a link, and an address written out is one too",
    "See [the docs](https://docs.example.com/a?b=1&c=2) or https://example.com/x.",
    [
      paragraph(
        "See ",
        link("https://docs.example.com/a?b=1&c=2", "the docs"),
        " or ",
        link("https://example.com/x", "https://example.com/x"),
        ".",
      ),
    ],
  ],
  [
    "a link to anything but a web address is just its words",
    "[run](javascript:alert(1)), [mail](mailto:sam@example.com), [here](#part), [there](/sam/items/1), [file](file:///etc/passwd), [empty]()",
    [paragraph("run", ", ", "mail", ", ", "here", ", ", "there", ", ", "file", ", ", "empty")],
  ],
  [
    "a link by reference goes where its definition says",
    "[the docs][d] and [nowhere][x]\n\n[d]: https://docs.example.com/",
    [paragraph(link("https://docs.example.com/", "the docs"), " and [nowhere][x]")],
  ],
  [
    "a picture is a link to it, called by what it shows, or by its address",
    "![The build](https://img.example.com/a.png) ![](https://img.example.com/b.png)",
    [
      paragraph(
        link("https://img.example.com/a.png", "The build"),
        " ",
        link("https://img.example.com/b.png", "https://img.example.com/b.png"),
      ),
    ],
  ],
  [
    "a picture written as HTML, as Qiita's editor writes one given a width, is a link to it too",
    '<img width="400" alt="The files" src="https://img.example.com/a.png?x=1&amp;y=2">',
    [paragraph(link("https://img.example.com/a.png?x=1&y=2", "The files"))],
  ],
  [
    "any other HTML is left out: a block of it whole, and inside a line its tags",
    lines(
      "<script>alert(1)</script>",
      "",
      "Some <b>bold</b> words.<br>",
      "",
      '<img src="javascript:alert(1)" alt="x">',
    ),
    [paragraph("Some ", "bold", " words.")],
  ],
  [
    "each of the post's headings is under the page's own, and none skips a level",
    lines("## Two", "## Two again", "#### Four", "### Three", "# One", "###### Six"),
    [
      { type: "heading", level: 2, spans: ["Two"] },
      { type: "heading", level: 2, spans: ["Two again"] },
      { type: "heading", level: 3, spans: ["Four"] },
      { type: "heading", level: 3, spans: ["Three"] },
      { type: "heading", level: 2, spans: ["One"] },
      { type: "heading", level: 3, spans: ["Six"] },
    ],
  ],
  ["a heading with no words is left out", "#\n\n## ![](nowhere)\n\nWords.", [paragraph("Words.")]],
  [
    "a list keeps its order, where it starts and the lists inside it",
    lines("3. three", "4. four", "   - inside"),
    [
      {
        type: "list",
        ordered: true,
        start: 3,
        items: [
          [paragraph("three")],
          [paragraph("four"), { type: "list", ordered: false, items: [[paragraph("inside")]] }],
        ],
      },
    ],
  ],
  [
    "a box to tick is written out before its item",
    lines("- [x] done", "- [ ] to do"),
    [{ type: "list", ordered: false, items: [[paragraph("[x] ", "done")], [paragraph("[ ] ", "to do")]] }],
  ],
  [
    "a block of code keeps its lines, less the spaces they end with, under its file's name",
    lines("```ts:src/app.ts", "const a = 1;  ", "", "  <b>not markup</b>\t", "```"),
    [{ type: "code", text: "const a = 1;\n\n  <b>not markup</b>", file: "src/app.ts" }],
  ],
  [
    "code with a language and no file has no name",
    "```ts\nconst a = 1;\n```",
    [{ type: "code", text: "const a = 1;" }],
  ],
  ["a block of code with nothing in it is left out", "```\n   \n```", []],
  [
    "a quote keeps its parts, and a heading in it is a line in bold",
    lines("> ## Said", "> So it goes.", ">", "> - one"),
    [
      {
        type: "quote",
        blocks: [
          paragraph(strong("Said")),
          paragraph("So it goes."),
          { type: "list", ordered: false, items: [[paragraph("one")]] },
        ],
      },
    ],
  ],
  [
    "one of Qiita's notes is a note, whatever kind it says it is",
    lines("Before.", "", ":::note warn", "Take **care**.", "", "## In it", ":::", "", "After."),
    [
      paragraph("Before."),
      { type: "note", blocks: [paragraph("Take ", strong("care"), "."), paragraph(strong("In it"))] },
      paragraph("After."),
    ],
  ],
  [
    "a note's marks inside a block of code are code, and a note never closed isn't one",
    lines("```", ":::note", "in code", ":::", "```", "", ":::note", "never closed"),
    [{ type: "code", text: ":::note\nin code\n:::" }, paragraph(":::note", BREAK, "never closed")],
  ],
  [
    "a table has a head and its rows, each as wide as the head",
    lines("| a | b |", "|---|---|", "| **1** | `2` | 3 |", "| only |"),
    [
      {
        type: "table",
        head: [["a"], ["b"]],
        rows: [
          [[strong("1")], [{ type: "code", text: "2" }]],
          [["only"], []],
        ],
      },
    ],
  ],
  ["a rule is a rule", "One.\n\n---\n\nTwo.", [paragraph("One."), { type: "rule" }, paragraph("Two.")]],
  [
    "a footnote is numbered where it's made and where it's written",
    lines("So it's said[^1].", "", "[^1]: By [someone](https://example.com/)."),
    [paragraph("So it's said", "[1]", "."), paragraph("[1] ", "By ", link("https://example.com/", "someone"), ".")],
  ],
  [
    "a colon in the text is a colon: a time, a face, a pair of them",
    "At 12:30, :smile: and a::b.",
    [paragraph("At 12:30, :smile: and a::b.")],
  ],
  [
    "three dashes at the top are a rule, not settings",
    "---\ntitle: x\n---",
    [{ type: "rule" }, { type: "heading", level: 2, spans: ["title: x"] }],
  ],
  [
    "lines that end the Windows way are read as any other",
    "One.\r\n\r\nTwo,\r\nthree.",
    [paragraph("One."), paragraph("Two,", BREAK, "three.")],
  ],
  ["a post with no words has no parts", " \n\n<!-- nothing -->\n", []],
] as const satisfies ReadonlyArray<readonly [string, string, readonly PostBlock[]]>) {
  test(what, () => assert.deepEqual(postBlocks(markdown), blocks));
}

/** Every string anywhere in a post's parts: its words, its code, its links' addresses. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (typeof value === "object" && value !== null) return Object.values(value).flatMap(stringsIn);
  return [];
}

/** Every link anywhere in a post's parts, by its address. */
function linksIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(linksIn);
  if (typeof value !== "object" || value === null) return [];
  const own = "type" in value && value.type === "link" && "href" in value ? [String(value.href)] : [];
  return [...own, ...Object.values(value).flatMap(linksIn)];
}

const fixtureBodies = ((sampleFixture().qiita?.posts ?? []) as Array<{ body?: string }>).flatMap(
  (item) => item.body ?? [],
);

test("every link in the sample's posts is to a web address", () => {
  const links = fixtureBodies.flatMap((body) => linksIn(postBlocks(body)));
  assert.ok(links.length, "the sample's posts have links");
  assert.deepEqual(
    links.filter((href) => !/^https?:\/\//.test(href)),
    [],
  );
});

test("the sample's posts have every kind of part, so a page built from them shows each", () => {
  const kinds = new Set(fixtureBodies.flatMap((body) => postBlocks(body)).map((block) => block.type));
  assert.deepEqual([...kinds].sort(), ["code", "heading", "list", "note", "paragraph", "quote", "rule", "table"]);
});

test("no tag of a post's HTML is among its parts, but as the code it's written as", () => {
  const htmlAndCode = lines("<details><summary>More</summary>", "", "Inside.", "", "</details>", "", "`<b>`");
  const strings = stringsIn(postBlocks(htmlAndCode));
  assert.deepEqual(
    strings.filter((text) => text.includes("<")),
    ["<b>"],
  );
  assert.ok(strings.includes("Inside."));
});
