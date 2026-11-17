/* Builds the sample as it is before its first post on Qiita
   (tests/sample/qiita-no-posts.json): it has no Writing tab, and nothing
   on the site points at the tab's page, which isn't there. */
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { ASK_INDEX_FILE } from "../../src/contracts/ask.ts";
import { WRITING_TAB } from "../../src/config/writing.ts";
import { folderForConfigs, SAMPLE_CONFIG } from "../sample/as-a-file.ts";
import { buildSample } from "../sample/build.ts";
import { SAMPLE_QIITA_WITH_NO_POSTS, sampleFixture } from "../sample/qiita.ts";
import sampleConfig from "../sample/site.config.ts";
import { builtSite, testBuiltSite } from "./built-site.ts";

const BUILD_FOLDER = join(folderForConfigs(), "dist");
const built = buildSample(BUILD_FOLDER, SAMPLE_CONFIG, SAMPLE_QIITA_WITH_NO_POSTS);
const sample = builtSite("the sample before its first post", BUILD_FOLDER, sampleConfig);

/** Anything that names the Writing tab's page, its answer or its id. */
const WRITING_TAB_NAMED = new RegExp(`/${WRITING_TAB}/|"${WRITING_TAB}\\.1"|id="${WRITING_TAB}"`);

test("the sample builds before its first post, saying it has no Writing tab until then", () => {
  assert.equal(built.status, 0, built.stderr || built.stdout);
  assert.match(
    built.stdout,
    new RegExp(
      `${sampleFixture().user} has no public posts on Qiita yet, so the site has no Writing tab until the first`,
    ),
  );
});

test("the sample before its first post has no page for the Writing tab, in any language", () => {
  const writingPages = sample.languagePages.map(({ file }) => file.replace(/index\.html$/, WRITING_TAB));
  assert.deepEqual(writingPages.filter(sample.hasFolder), []);
});

testBuiltSite(sample);

for (const file of [...sample.pages.map((page) => page.file), "sitemap.xml", "llms.txt", ASK_INDEX_FILE]) {
  test(`the sample before its first post: ${file} has no Writing tab, no row or link for it, and no answer from it`, () => {
    assert.doesNotMatch(sample.read(file), WRITING_TAB_NAMED);
  });
}
