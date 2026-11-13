/* JSON a page carries in a <script> element (src/site/json.ts), and the
   schema.org Person written that way (src/site/structured-data.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { scriptJson } from "../../src/site/json.ts";
import { makePage, makeSite } from "../../src/site/site.ts";
import { structuredData } from "../../src/site/structured-data.ts";
import { sampleConfig } from "./sample.ts";

const ENDS_A_SCRIPT = { text: "</script><script>alert(1)</script> & <!--" };

test("JSON in a <script> has no < in it, so nothing in it can end the element", () => {
  assert.doesNotMatch(scriptJson(ENDS_A_SCRIPT), /</);
});

test("JSON in a <script> reads back as it was", () => {
  assert.deepEqual(JSON.parse(scriptJson(ENDS_A_SCRIPT)), ENDS_A_SCRIPT);
});

const siteWhoseNameEndsAScript = makeSite(sampleConfig({ name: "</script>Sam" }));
const person = structuredData(siteWhoseNameEndsAScript, makePage(siteWhoseNameEndsAScript, "en"));

test("the schema.org Person has no < in it either", () => {
  assert.doesNotMatch(person, /</);
});

test("the schema.org Person has the site's name beside the language's own, as it was written", () => {
  assert.equal((JSON.parse(person) as { alternateName: string }).alternateName, "</script>Sam");
});
