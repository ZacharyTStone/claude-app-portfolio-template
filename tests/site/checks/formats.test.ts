/* What a value has to look like (src/site/checks/formats.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { isPathOnSite, isSafeHref } from "../../../src/site/checks/formats.ts";

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

/** No scheme, but a browser reads each as an address on another site. */
const ANOTHER_SITES_ADDRESSES = ["//example.com/x", "\\\\example.com/x", "/\\example.com/x"];

for (const href of ANOTHER_SITES_ADDRESSES) {
  test(`${JSON.stringify(href)} isn't a link that's safe to follow, since a browser reads it as another site`, () => {
    assert.ok(!isSafeHref(href));
  });

  test(`${JSON.stringify(href)} isn't a path on this site`, () => {
    assert.ok(!isPathOnSite(href));
  });
}
