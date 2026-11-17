/* The tests' stand-in for GitHub's API (src/site/activity/fixture.ts): it
   answers for its own user, and no other. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fixtureFetch, readFixture } from "../../../src/site/activity/fixture.ts";
import { eventsAddress } from "../../../src/site/activity/github.ts";
import { sampleGitHub } from "../../sample/github.ts";
import { folderForConfigs } from "../../sample/as-a-file.ts";
import sample from "../../sample/site.config.ts";

const fixture = { user: "sam-sample", events: ["first", "second", "third"] };
const ask = (address: string) => fixtureFetch(fixture)(address, {});

test("it answers its user's events a page at a time, with a Link to the next while there is one, as GitHub does", async () => {
  const first = await ask(eventsAddress(fixture.user, 2));
  assert.deepEqual(await first.json(), ["first", "second"]);
  const next = /<([^>]+)>; rel="next"/.exec(first.headers.get("link") ?? "")?.[1] ?? "";
  assert.equal(next, `${eventsAddress(fixture.user, 2)}&page=2`);
  const second = await ask(next);
  assert.deepEqual(await second.json(), ["third"]);
  assert.equal(second.headers.get("link"), null);
});

for (const [whose, address] of [
  ["another user's", eventsAddress("someone-else", 100)],
  ["another site's", "https://example.com/users/sam-sample/events/public?per_page=100"],
] as const) {
  test(`it answers a request for ${whose} events with the 404 GitHub sends`, async () => {
    const answer = await ask(address);
    assert.deepEqual([answer.status, await answer.json()], [404, { message: "Not Found", status: "404" }]);
  });
}

test("the sample's fixture is a fixture, for the sample's own user", () => {
  assert.equal(sampleGitHub().user, sample.activity?.github);
});

test("a file that isn't a fixture is refused", () => {
  const file = join(folderForConfigs(), "not-a-github-fixture.json");
  writeFileSync(file, JSON.stringify([{ type: "PushEvent" }]));
  assert.throws(() => readFixture(file));
});
