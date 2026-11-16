/* The tests' stand-in for Qiita's API (src/site/writing/fixture.ts): it
   answers for its own user, and no other. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fixtureFetch, readFixture } from "../../../src/site/writing/fixture.ts";
import { qiitaItemsAddress } from "../../../src/site/writing/qiita.ts";
import { folderForConfigs } from "../../sample/as-a-file.ts";
import { sampleFixture } from "../../sample/qiita.ts";
import sample from "../../sample/site.config.ts";

const fixture = { user: "sam-sample", items: ["first", "second", "third"] };
const ask = (address: string) => fixtureFetch(fixture)(address, {});

test("it answers its user's items a page at a time, as Qiita does", async () => {
  const pages = await Promise.all(
    [1, 2, 3].map(async (page) => (await ask(qiitaItemsAddress(fixture.user, page, 2))).json()),
  );
  assert.deepEqual(pages, [["first", "second"], ["third"], []]);
});

for (const [whose, address] of [
  ["another user's", qiitaItemsAddress("someone-else", 1, 100)],
  ["another site's", "https://example.com/api/v2/users/sam-sample/items?page=1&per_page=100"],
] as const) {
  test(`it answers a request for ${whose} items with the 404 Qiita sends`, async () => {
    const answer = await ask(address);
    assert.deepEqual([answer.status, await answer.json()], [404, { message: "Not found", type: "not_found" }]);
  });
}

test("the sample's fixture is a fixture, for the sample's own user", () => {
  assert.equal(sampleFixture().user, sample.writing?.qiita);
});

test("a file that isn't a fixture is refused", () => {
  const file = join(folderForConfigs(), "not-a-fixture.json");
  writeFileSync(file, JSON.stringify([{ title: "A post" }]));
  assert.throws(() => readFixture(file));
});
