import assert from "node:assert/strict";
import { test } from "node:test";
import { sectionOrder } from "../../src/app/panel-order.ts";

const IN_PAGE = ["panel-progress", "panel-outputs", "panel-context"];

test("with nothing remembered, the sections stay as the page has them", () => {
  assert.deepEqual(sectionOrder(IN_PAGE, null), IN_PAGE);
});

test("the sections are shown in the order they were left in", () => {
  const left = ["panel-context", "panel-progress", "panel-outputs"];
  assert.deepEqual(sectionOrder(IN_PAGE, left), left);
});

test("a section the browser doesn't remember comes ahead of those it does", () => {
  assert.deepEqual(sectionOrder(IN_PAGE, ["panel-context", "panel-progress"]), [
    "panel-outputs",
    "panel-context",
    "panel-progress",
  ]);
});

test("a remembered section the page no longer has is passed over", () => {
  assert.deepEqual(sectionOrder(IN_PAGE, ["panel-context", "panel-gone", "panel-progress", "panel-outputs"]), [
    "panel-context",
    "panel-progress",
    "panel-outputs",
  ]);
});

test("of a section remembered twice, the later place counts", () => {
  assert.deepEqual(sectionOrder(IN_PAGE, ["panel-context", "panel-progress", "panel-outputs", "panel-context"]), [
    "panel-progress",
    "panel-outputs",
    "panel-context",
  ]);
});

for (const [what, remembered] of [
  ["a list with something that isn't an id in it", ["panel-context", null, "panel-progress"]],
  ["something that isn't a list", { 0: "panel-context" }],
  ["a string", "panel-context"],
] as const) {
  test(`${what} is no order at all`, () => {
    assert.deepEqual(sectionOrder(IN_PAGE, remembered), IN_PAGE);
  });
}
