/* What `npm run diagrams` writes, and what its check finds stale, for a site with one small diagram of its own. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { diagramFiles, staleDiagramFiles } from "../../scripts/diagrams.ts";
import { scratchFolders } from "./scratch-folders.ts";

const siteOf = scratchFolders("diagrams-test-");

/** A diagram's file, with a word to draw in two languages. It imports nothing, so it can be anywhere. */
const diagramCalled = (name: string): string => `
export default {
  name: "${name}",
  words: { en: { hello: "Hello" }, ja: { hello: "こんにちは" } },
  draw: (words) => ({
    width: 10,
    height: 10,
    shapes: [{ tag: "text", attributes: {}, children: [words.hello, { tag: "animate", attributes: {}, children: [] }] }],
  }),
};
`;
const NOT_A_DIAGRAM = "export const part = 1;";

const site = siteOf("site", {
  "diagrams/one.ts": diagramCalled("one"),
  "diagrams/two.ts": diagramCalled("two"),
  "diagrams/parts/shared.ts": NOT_A_DIAGRAM,
  "diagrams/notes.md": "not a diagram either",
  "public/assets/photo.webp": "",
});
const files = await diagramFiles(site);
const asset = (name: string): string => join("public", "assets", name);

test("A diagram is written as it moves and still, in each language, the first with no code in its files' names", () => {
  const ofOne = [...files.keys()].filter((path) => path.includes("one"));
  assert.deepEqual(ofOne, ["one.svg", "one-still.svg", "one-ja.svg", "one-ja-still.svg"].map(asset));
});

test("Each language's files have its own wording", () => {
  assert.match(files.get(asset("one.svg")) ?? "", />Hello</);
  assert.match(files.get(asset("one-ja.svg")) ?? "", />こんにちは</);
});

test("A still file is the moving one without its motion", () => {
  assert.match(files.get(asset("one.svg")) ?? "", /<animate/);
  assert.doesNotMatch(files.get(asset("one-still.svg")) ?? "", /<animate/);
});

test("A file in a folder inside diagrams/ is a part, not a diagram, and only .ts files are diagrams", () => {
  assert.equal(files.size, 8);
});

test("Asked for one diagram by name, only its files are made", async () => {
  const onlyTwo = await diagramFiles(site, "two");
  assert.deepEqual([...onlyTwo.keys()], ["two.svg", "two-still.svg", "two-ja.svg", "two-ja-still.svg"].map(asset));
});

test("A site with no diagrams has no files to write", async () => {
  assert.equal((await diagramFiles(siteOf("no-diagrams", { "site.config.ts": "" }))).size, 0);
});

test("A file that isn't written yet, or isn't what its diagram draws now, is stale", async () => {
  const stale = siteOf("stale", {
    "diagrams/one.ts": diagramCalled("one"),
    "public/assets/one.svg": "an older drawing",
  });
  assert.deepEqual(await staleDiagramFiles(stale), [...(await diagramFiles(stale)).keys()]);
});

test("Once every file is written as drawn, none is stale", async () => {
  const fresh = siteOf("fresh", { "diagrams/one.ts": diagramCalled("one"), "public/assets/photo.webp": "" });
  for (const [path, text] of await diagramFiles(fresh)) writeFileSync(join(fresh, path), text);
  assert.deepEqual(await staleDiagramFiles(fresh), []);
});
