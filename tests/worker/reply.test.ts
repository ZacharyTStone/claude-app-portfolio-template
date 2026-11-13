/* The reply /ask sends with a picked answer: written from the lines the
   picker chose, or those lines quoted, or none (src/worker/ask/reply.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { NONE } from "../../src/worker/ask/prompts/wording.ts";
import { UNADDRESSED, UNWRITTEN, askJson, captureLogs, lines, models, okLeft, stubs, toolCall } from "./fixtures.ts";

const logs = captureLogs();

test("a pick with sentence numbers comes with their quote", async () => {
  const { env } = stubs({ run: models(toolCall("acme.1", [1])) });
  assert.deepEqual(await askJson(env, "Since when is Alex at Acme?"), {
    id: "acme.1",
    reply: "Alex has been at Acme since 2024.",
  });
  const ja = stubs({ run: models(toolCall("acme.1", [2])) });
  assert.deepEqual(await askJson(ja.env, "何をした？", "ja"), {
    id: "acme.1",
    reply: "Webアプリをサーバーレンダリングに移行し、初回表示までの時間を40%短縮しました。",
  });
});

test("numbers that name no line: the pick without a reply, and the log says why", async () => {
  logs.mock.resetCalls();
  const runs = [
    models(toolCall("acme.1", [1])),
    models(toolCall("acme.1", [4])),
    models(toolCall("acme.1", "1")),
    models(toolCall("acme.1", [])),
    models(toolCall("acme.1")),
    models({ response: "acme.1" }),
    models(toolCall(NONE, [1])),
  ];
  for (const run of runs) await askJson(stubs({ run }).env, "What does Alex do at Acme?");
  assert.deepEqual(lines(logs), [
    JSON.stringify({ ask: "acme.1", ...UNWRITTEN, reply: "sent" }),
    '{"ask":"acme.1","reply":"dropped","check":"range"}',
    '{"ask":"acme.1","reply":"dropped","check":"unreadable"}',
    '{"ask":"acme.1"}',
    '{"ask":"acme.1"}',
    '{"ask":"acme.1"}',
    JSON.stringify({ ask: NONE, ...UNADDRESSED }),
  ]);
});

test("with few questions left, the reply and the count come together", async () => {
  const { env } = stubs({ run: models(toolCall("acme.1", [1])), guardSays: okLeft(3) });
  assert.deepEqual(await askJson(env, "Since when?"), {
    id: "acme.1",
    reply: "Alex has been at Acme since 2024.",
    left: 3,
  });
});
