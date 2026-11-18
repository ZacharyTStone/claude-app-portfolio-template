/* What the places the panel's activity is read from share
   (src/site/activity/repo.ts): which the config names, in what order, as
   words, and a push's time in UTC. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { inUtc, servicesInWords, sourcesOf } from "../../../src/site/activity/repo.ts";

test("the places are in one order, whatever the config's, and one with no user name isn't one", () => {
  assert.deepEqual(sourcesOf({ codeberg: "sams", github: "sam-sample", gitlab: "" }), [
    { service: "github", user: "sam-sample" },
    { service: "codeberg", user: "sams" },
  ]);
});

for (const [activity, words] of [
  [{ github: "sam" }, "GitHub"],
  [{ gitlab: "sam", codeberg: "sam" }, "GitLab and Codeberg"],
  [{ github: "sam", gitlab: "sam", codeberg: "sam" }, "GitHub, GitLab and Codeberg"],
] as const) {
  test(`the places are said as words: ${words}`, () => {
    assert.equal(servicesInWords(activity), words);
  });
}

test("a push's time is in UTC, written as GitHub writes one", () => {
  assert.equal(inUtc("2026-10-31T14:32:23+01:00"), "2026-10-31T13:32:23Z");
  assert.equal(inUtc("2026-11-12T23:30:00Z"), "2026-11-12T23:30:00Z");
  assert.equal(inUtc("2026-11-18T04:11:40.937Z"), "2026-11-18T04:11:40.937Z");
});
