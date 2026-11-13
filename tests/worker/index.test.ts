/* The Worker's entry (src/worker/index.ts): /ask goes to its handler, and
   every other path to the site's files. */
import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../../src/worker/index.ts";
import { askRequest, stubs, withContext } from "./support/worker.ts";

test("other paths go to the static files", async () => {
  const { env } = stubs();
  const request = askRequest(null, { method: "GET", url: "https://site.example/nothing-here" });
  const response = await withContext((context) => worker.fetch(request, env, context));
  assert.equal(await response.text(), "a static file");
});

test("a question sent to /ask is answered, and its line goes to the console", async (t) => {
  const printed = t.mock.method(console, "log", () => {});
  const { env } = stubs();
  const request = askRequest({ question: "who?", lang: "en" });
  const response = await withContext((context) => worker.fetch(request, env, context));
  assert.deepEqual([await response.json(), printed.mock.callCount()], [{ id: "about.1" }, 1]);
});
