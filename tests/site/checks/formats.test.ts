/* What a value has to look like (src/site/checks/formats.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isSafeHref } from "../../../src/site/checks/formats.ts";

for (const href of ["https://example.com", "mailto:you@example.com", "#about", "/resume.pdf", "resume.pdf"]) {
  test(`"${href}" is a link that's safe to follow`, () => {
    assert.ok(isSafeHref(href));
  });
}

for (const href of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,x", "java\tscript:x", " https://x"]) {
  test(`${JSON.stringify(href)} isn't a link that's safe to follow, whatever its letters' case`, () => {
    assert.ok(!isSafeHref(href));
  });
}
