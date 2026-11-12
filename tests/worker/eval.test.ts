/* The eval (tests/ask-eval.ts) reads /ask's replies as the page would, and
   stops at a limit instead of counting what's left as "none". */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readSaid } from "../ask-eval.ts";

test("a pick, a block, and no pick, as /ask sends them", () => {
  assert.deepEqual(readSaid({ id: "about.1", reply: "Alex is a senior software engineer." }), {
    id: "about.1",
    why: undefined,
    reply: "Alex is a senior software engineer.",
    cited: undefined,
  });
  assert.deepEqual(readSaid({ blocked: true, flagged: true }), { id: "blocked" });
  assert.deepEqual(readSaid({ id: null, why: "error" }), {
    id: "none",
    why: "error",
    reply: undefined,
    cited: undefined,
  });
  assert.deepEqual(readSaid("not JSON"), { id: "none" });
});

test("a written reply comes with the lines it cites; lines with no reply, or not as the page takes them, are dropped", () => {
  const reply = "Yes, Alex is a senior software engineer.";
  const cited = ["Alex is a senior software engineer."];
  assert.deepEqual(readSaid({ id: "about.1", reply, cited }), { id: "about.1", why: undefined, reply, cited });
  for (const said of [
    { id: "about.1", cited },
    { id: "about.1", reply, cited: "Alex is a senior software engineer." },
    { id: "about.1", reply, cited: [] },
    { id: "about.1", reply, cited: ["(picture: Alex)"] },
  ]) {
    assert.equal("stop" in readSaid(said) ? "stopped" : (readSaid(said) as { cited?: unknown }).cited, undefined);
  }
});

test("past the visitor's limit, or the site's, the run stops", () => {
  assert.ok("stop" in readSaid({ id: null, limited: true, limit: 30 }));
  assert.ok("stop" in readSaid({ id: null, why: "budget" }));
});
