/* The answers the model picks from (src/worker/ask/answers.ts): the page's
   language's, or the site's main language's, from an ask.json that has to
   be one. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { EN, INDEX, JA } from "./support/answers.ts";
import { systemMessage, toolCall } from "./support/models.ts";
import { stubs } from "./support/worker.ts";

test("the Japanese page's answers are the ones offered for it", async () => {
  const { ask, calls } = stubs({ run: () => toolCall("skills.2") });
  await ask({ question: "日本語のレベルは？", lang: "ja" });
  const japanese = JA.find((a) => a.id === "skills.2");
  assert.ok(japanese);
  assert.ok(systemMessage(calls).includes(japanese.q));
});

test("a language the site doesn't have, or none, gets its main language's answers", async () => {
  for (const lang of ["fr", undefined, 42, "main", "__proto__"]) {
    const { ask, calls } = stubs();
    await ask({ question: "who?", lang });
    assert.ok(systemMessage(calls).includes("about.1 | About | who is alex example?"), `lang: ${lang}`);
  }
});

test("an ask.json that's missing or isn't an AskIndex is no pick, and no model call", async () => {
  const bad = [
    new Response("not found", { status: 404 }),
    { main: "en", en: EN, ja: JA }, // the shape before AskIndex
    { ...INDEX, name: undefined },
    { ...INDEX, answers: { en: [{ id: "about.1" }] } },
  ];
  for (const index of bad) {
    const { ask, calls } = stubs({ index });
    assert.deepEqual(await (await ask({ question: "who?", lang: "en" })).json(), { id: null, why: "error" });
    assert.equal(calls.length, 0);
  }
});
