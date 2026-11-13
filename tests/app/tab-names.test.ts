import assert from "node:assert/strict";
import { test } from "node:test";
import { givenNameFrom, givenNamesIn, rowTextFor } from "../../src/app/tab-names.ts";

test("the saved names are read by tab id", () => {
  assert.deepEqual(
    [...givenNamesIn({ about: "Me", work: "Jobs" })],
    [
      ["about", "Me"],
      ["work", "Jobs"],
    ],
  );
});

test("a saved value that isn't a name is left out, and the names beside it kept", () => {
  assert.deepEqual([...givenNamesIn({ about: "Me", work: 7, home: null, more: ["x"] })], [["about", "Me"]]);
});

for (const [what, saved] of [
  ["nothing", null],
  ["a string", "about"],
  ["a number", 3],
] as const) {
  test(`${what} saved where the names should be gives no names`, () => {
    assert.equal(givenNamesIn(saved).size, 0);
  });
}

test("a name typed in is the name the tab is given", () => {
  assert.equal(givenNameFrom("My work", "Work"), "My work");
});

test("nothing typed gives the tab its own name back", () => {
  assert.equal(givenNameFrom("", "Work"), null);
});

test("the tab's own title typed in gives the tab its own name back", () => {
  assert.equal(givenNameFrom("Work", "Work"), null);
});

test("a tab whose own title isn't known takes any name typed", () => {
  assert.equal(givenNameFrom("Work", undefined), "Work");
});

test("a row with no given name says its own words", () => {
  assert.equal(rowTextFor(undefined, "Work "), "Work ");
});

test("a row with a given name says it", () => {
  assert.equal(rowTextFor("Jobs", "Work"), "Jobs");
});

test("a given name keeps the space the row's own words end with", () => {
  assert.equal(rowTextFor("Jobs", "Work "), "Jobs ");
});
