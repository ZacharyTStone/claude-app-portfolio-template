import assert from "node:assert/strict";
import { test } from "node:test";
import { kebabCase } from "es-toolkit";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";

test("a class's key is its name: rowName is row-name", () => {
  const namedOtherwise = Object.entries(PAGE_CLASSES).filter(([key, name]) => kebabCase(key) !== name);
  assert.deepEqual(namedOtherwise, []);
});
