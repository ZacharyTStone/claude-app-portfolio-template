/* Builds the sample site (tests/sample) and checks what the repo's own
   site may not show: a site under a path, in two languages, with Ask on, a
   viewer, a picture that has a still and a Writing tab; and the same site on
   a host that reads no headers. */
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { escapeRegExp } from "es-toolkit";
import { ASK_INDEX_FILE, ASK_PATH } from "../../src/contracts/ask.ts";
import { CONTACT_FIELDS, CONTACT_PATH } from "../../src/contracts/contact.ts";
import { DATA, REDUCED_MOTION } from "../../src/contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../../src/contracts/page-classes.ts";
import { tabPagePath } from "../../src/contracts/tab-pages.ts";
import type { SiteConfig } from "../../src/config/site-config.ts";
import { HEADERS_FILE, headersFile, pagePolicy } from "../../src/site/files/headers-file.ts";
import { frameOrigins, REFERRER_POLICY } from "../../src/site/security-headers.ts";
import { makeSite } from "../../src/site/site.ts";
import { WRITING_ICON, WRITING_TAB } from "../../src/config/writing.ts";
import { folderForConfigs, writeSampleConfig } from "../sample/as-a-file.ts";
import { buildSample } from "../sample/build.ts";
import { SAMPLE_QIITA, samplePosts } from "../sample/qiita.ts";
import sampleConfig from "../sample/site.config.ts";
import { builtSite, testBuiltSite, type BuiltSite } from "./built-site.ts";

const folder = folderForConfigs();

const BUILD_FOLDER = join(folder, "dist");
const built = buildSample(BUILD_FOLDER);
const sample = builtSite("the sample site", BUILD_FOLDER, sampleConfig);
const posts = await samplePosts();
const sampleSite = makeSite(sampleConfig, posts);

test("the sample site builds", () => {
  assert.equal(built.status, 0, built.stderr || built.stdout);
});

test("the sample site has a home page for each of its two languages, a page for each of their tabs, and a 404 page", () => {
  const tabPages = ["about/index.html", "work/index.html", "writing/index.html", "personal-fun/index.html"];
  assert.deepEqual(
    sample.pages.map(({ file }) => [file, sample.hasFile(file)]),
    [
      ["index.html", true],
      ["fr/index.html", true],
      ...tabPages.map((file) => [file, true]),
      ...tabPages.map((file) => [`fr/${file}`, true]),
      ["404.html", true],
    ],
  );
});

testBuiltSite(sample);

test("the sample's host reads a _headers file, so the build writes the site's headers there", () => {
  assert.equal(sample.read(HEADERS_FILE), headersFile(sampleSite));
});

test("the sample has a Writing tab, and the build says its posts are the tests' fixture, not Qiita's", () => {
  assert.match(
    built.stdout,
    new RegExp(`the Writing tab's posts are the fixture ${escapeRegExp(SAMPLE_QIITA)}, not Qiita's`),
  );
});

test("the sample's llms.txt lists its posts", () => {
  const llms = sample.read("llms.txt");
  assert.deepEqual(
    posts.filter((post) => !llms.includes(`](${post.url}): `)),
    [],
  );
});

test("the sample has Ask on, so the build writes what /ask picks from", () => {
  assert.equal(JSON.parse(sample.read(ASK_INDEX_FILE)).name, sampleConfig.name);
});

const frameAddresses = Object.values(sampleConfig.viewer ?? {});

/** A page's tab with this id, as built. */
const tabIn = (html: string, id: string): string =>
  html.match(new RegExp(`<article class="${PAGE_CLASSES.tab}" id="${id}".*?</article>`, "s"))?.[0] ?? "";

for (const { file, url } of sample.languagePages) {
  test(`${file} has the contact form in its thread, posting to /contact under the site's path, and back to its tab's page`, () => {
    const tabId = sampleConfig.contactForm?.tab ?? "";
    const tab = tabIn(sample.read(file), tabId);
    const opening = `<form class="${PAGE_CLASSES.contactForm}" action="${sampleSite.link(CONTACT_PATH)}" method="post">`;
    assert.ok(tab.includes(opening), "the form, in its thread");
    const backTo = tabPagePath(url.pathname, tabId);
    assert.ok(tab.includes(`name="${CONTACT_FIELDS.page}" value="${backTo}"`), "the page to come back to");
  });

  test(`${file} says where /ask is, under the site's path`, () => {
    assert.ok(sample.read(file).includes(` ${DATA.ask}="${sampleSite.link(ASK_PATH)}"`));
  });

  test(`${file} lists the sample's public posts in its Writing tab, newest first, each a card marked as fetched`, () => {
    const tab = sample.read(file).match(new RegExp(`<article class="tab" id="${WRITING_TAB}".*?</article>`, "s"))?.[0];
    assert.ok(tab, "the page has the Writing tab");
    const fetchedLinks = [...tab.matchAll(new RegExp(`<a [^>]*href="([^"]*)"[^>]*\\s${DATA.fetched}[\\s>]`, "g"))];
    assert.deepEqual(
      fetchedLinks.map(([, href]) => href),
      posts.map((post) => post.url),
    );
  });

  test(`${file} has a row in its sidebar for the Writing tab`, () => {
    const itsPage = tabPagePath(url.pathname, WRITING_TAB);
    assert.match(sample.read(file), new RegExp(`<a class="icon i-${WRITING_ICON}" href="${itsPage}">`));
  });

  test(`${file} marks the link the viewer opens with the address it shows`, () => {
    const html = sample.read(file);
    assert.ok(frameAddresses.length, "the sample has a viewer");
    const unmarked = frameAddresses.filter((address) => !html.includes(`${DATA.viewerAddress}="${address}"`));
    assert.deepEqual(unmarked, []);
  });

  test(`${file} offers a moving picture's still to a visitor who wants less motion, ahead of the moving one`, () => {
    const still = sampleSite.link("/assets/sample-icon-still.svg");
    const picture = sample.read(file).match(/<picture>.*?<\/picture>/s)?.[0] ?? "";
    assert.match(
      picture,
      new RegExp(
        `^<picture><source media="${escapeRegExp(REDUCED_MOTION)}" srcset="${escapeRegExp(still)}"[^>]*><img `,
      ),
    );
  });
}

/** The sample on a host that reads no _headers file, where neither Ask nor the contact form can run. */
const ON_A_STATIC_HOST = 'config.host = "github-pages"; delete config.ask; delete config.contactForm;';
const onAStaticHost: SiteConfig = { ...sampleConfig, host: "github-pages", ask: undefined, contactForm: undefined };

const staticConfigPath = join(folder, "static-host.config.ts");
writeSampleConfig(staticConfigPath, ON_A_STATIC_HOST);
const STATIC_BUILD_FOLDER = join(folder, "static-host-dist");
const builtForAStaticHost = buildSample(STATIC_BUILD_FOLDER, staticConfigPath);
const staticSample = builtSite("the sample on a host that reads no headers", STATIC_BUILD_FOLDER, onAStaticHost);
const policy = pagePolicy(makeSite(onAStaticHost));

/** The tags in a page's <head>, in order, as written. */
function headTagsOf(html: string): string[] {
  const head = html.match(/<head>(.*?)<\/head>/s)?.[1] ?? "";
  return [...head.matchAll(/<[a-z][^>]*>/g)].map(([tag]) => tag);
}

test("the sample builds for a host that reads no _headers file, and the build writes none", () => {
  assert.equal(builtForAStaticHost.status, 0, builtForAStaticHost.stderr || builtForAStaticHost.stdout);
  assert.ok(!staticSample.hasFile(HEADERS_FILE));
});

test("without the contact form in the config, the pages have no form at all", () => {
  for (const { file } of staticSample.pages) assert.doesNotMatch(staticSample.read(file), /<form\b/, file);
});

/** Each page of `built` carries `expectedPolicy` and the referrer policy right after its charset and viewport. */
function testPagesCarryThePolicy(built: BuiltSite, expectedPolicy: string): void {
  for (const { file } of built.pages) {
    test(`${built.name}: ${file} carries the policy and referrer policy right after its charset and viewport, before anything the policy covers`, () => {
      const headTags = headTagsOf(built.read(file));
      assert.match(headTags[0] ?? "", /^<meta charset=/);
      assert.match(headTags[1] ?? "", /^<meta name="viewport"/);
      assert.equal(headTags[2], `<meta http-equiv="Content-Security-Policy" content="${expectedPolicy}">`);
      assert.equal(headTags[3], `<meta name="referrer" content="${REFERRER_POLICY}">`);
      assert.ok(headTags.findIndex((tag) => tag.startsWith("<link")) > 3, "a <link> comes before the policy");
    });
  }
}

testPagesCarryThePolicy(sample, pagePolicy(sampleSite));
testPagesCarryThePolicy(staticSample, policy);

test("the policy a page carries lets frames come from the viewer's site and no other", () => {
  assert.match(policy, new RegExp(`(^|; )frame-src ${frameOrigins(sampleConfig.viewer).join(" ")}(;|$)`));
});
