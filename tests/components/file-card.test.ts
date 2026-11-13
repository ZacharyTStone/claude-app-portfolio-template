/* A file card's lines, as they're laid out (src/components/file-card.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileCard } from "../../src/config/blocks.ts";
import { cardRows } from "../../src/components/file-card.ts";

/** The card's lines as they show, tags aside. */
const linesAsDrawn = (lines: FileCard["lines"]): string[] =>
  cardRows({ file: "role.yaml", lines }).map((row) => {
    const key = row.key ? `${row.key}:` : "";
    const comment = row.comment ? `${row.beforeComment}# ${row.comment}` : "";
    return `${key}${row.indent}${row.value}${comment}`;
  });

test("a card's values start in one column, and so do its comments", () => {
  assert.deepEqual(
    linesAsDrawn([
      ["company", "Acme", "a comment"],
      ["role", "Engineer", "another"],
    ]),
    ["company: Acme      # a comment", "role:    Engineer  # another"],
  );
});

test("a card's comments each follow their value when one has wide characters", () => {
  assert.deepEqual(
    linesAsDrawn([
      ["company", "アクメ", "a comment"],
      ["role", "Engineer", "another"],
    ]),
    ["company: アクメ  # a comment", "role:    Engineer  # another"],
  );
});

test("a list's other lines sit under its first, and an uncommented value can be any length", () => {
  assert.deepEqual(
    linesAsDrawn([
      ["stack", ["TypeScript,", "Workers"], "daily"],
      ["a", "a value longer than any with a comment"],
    ]),
    ["stack: TypeScript,  # daily", "       Workers", "a:     a value longer than any with a comment"],
  );
});
