/* The tests' stand-in for every place the Writing tab's posts come from
   (src/site/writing/fixture.ts): it answers for its own users and feeds, as
   each place would, and for no other. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { devArticlesAddress, devUserAddress } from "../../../src/site/writing/dev.ts";
import { fixtureFetch, readFixture } from "../../../src/site/writing/fixture.ts";
import { qiitaItemsAddress } from "../../../src/site/writing/qiita.ts";
import { zennArticlesAddress, zennUserAddress } from "../../../src/site/writing/zenn.ts";
import { folderForConfigs } from "../../sample/as-a-file.ts";
import sample from "../../sample/site.config.ts";
import { sampleFixture } from "../../sample/writing.ts";

const FEED = "https://blog.example.com/feed.xml";

const fixture = {
  qiita: { user: "sam-sample", posts: ["first", "second", "third"] },
  zenn: { user: "sam_sample", posts: ["an article"] },
  dev: { user: "sam-sample", posts: ["one", "two", "three"] },
  feeds: { [FEED]: "<rss/>" },
};
const ask = (address: string) => fixtureFetch(fixture)(address, {});

test("it answers its Qiita user's items a page at a time, as Qiita does", async () => {
  const pages = await Promise.all(
    [1, 2, 3].map(async (page) => (await ask(qiitaItemsAddress(fixture.qiita.user, page, 2))).json()),
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

test("it answers for its Zenn user, and their articles with no next page after the last", async () => {
  assert.deepEqual(await (await ask(zennUserAddress("sam_sample"))).json(), { user: { username: "sam_sample" } });
  assert.deepEqual(await (await ask(zennArticlesAddress("sam_sample", 1))).json(), {
    articles: ["an article"],
    next_page: null,
  });
  assert.equal((await ask(zennUserAddress("someone_else"))).status, 404);
});

test("it answers for its DEV user, their articles a page at a time, and anyone else's as an empty list, as DEV does", async () => {
  assert.deepEqual(await (await ask(devUserAddress("sam-sample"))).json(), { username: "sam-sample" });
  assert.deepEqual(await (await ask(devArticlesAddress("sam-sample", 2, 2))).json(), ["three"]);
  assert.equal((await ask(devUserAddress("someone-else"))).status, 404);
  assert.deepEqual(await (await ask(devArticlesAddress("someone-else", 1))).json(), []);
});

test("it answers each of its feeds with the feed, and any other feed with a 404", async () => {
  assert.equal(await (await ask(FEED)).text(), "<rss/>");
  assert.equal((await ask("https://blog.example.com/other.xml")).status, 404);
});

test("the sample's fixture is a fixture, for the sample's own users", () => {
  const { qiita, zenn, feeds } = sampleFixture();
  assert.deepEqual([qiita?.user, zenn?.user], [sample.writing?.qiita, sample.writing?.zenn]);
  assert.ok(Object.values(feeds).every((feed) => feed.includes("<rss")));
});

test("a fixture's feeds are read from files beside it", () => {
  const folder = join(folderForConfigs(), "a-fixture");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "blog.xml"), "<rss/>");
  writeFileSync(join(folder, "fixture.json"), JSON.stringify({ feeds: { [FEED]: "blog.xml" } }));
  assert.deepEqual(readFixture(join(folder, "fixture.json")).feeds, { [FEED]: "<rss/>" });
});

test("a file that isn't a fixture is refused", () => {
  const file = join(folderForConfigs(), "not-a-fixture.json");
  writeFileSync(file, JSON.stringify({ qiita: [{ title: "A post" }] }));
  assert.throws(() => readFixture(file));
});
