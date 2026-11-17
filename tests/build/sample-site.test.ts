/* Builds the sample site (tests/sample) and checks what the repo's own
   site may not show: a site under a path, in two languages, with Ask on, a
   viewer, a picture that has a still, a Writing tab whose posts each have
   a page of the site's own for the viewer, and GitHub activity in the
   panel; the same site on a host that reads no headers; and the same site
   before its first post. The builds share Astro's working folder, so
   they're made one after another, in this file. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
import { panelId } from "../../src/contracts/page-ids.ts";
import { ACTIVITY_SECTION } from "../../src/config/activity.ts";
import { WRITING_ICON, WRITING_PLACE, WRITING_TAB } from "../../src/config/writing.ts";
import { ROOT } from "../../src/site/repo.ts";
import { postPages } from "../../src/site/writing/post-pages.ts";
import { dayPosted } from "../../src/site/writing/post.ts";
import { folderForConfigs, SAMPLE_CONFIG, writeSampleConfig } from "../sample/as-a-file.ts";
import { buildSample } from "../sample/build.ts";
import { SAMPLE_GITHUB, sampleRepos } from "../sample/github.ts";
import { SAMPLE_QIITA, SAMPLE_QIITA_WITH_NO_POSTS, sampleFixture, samplePosts } from "../sample/qiita.ts";
import sampleConfig from "../sample/site.config.ts";
import { builtSite, testBuiltSite, type BuiltSite } from "./built-site.ts";

const folder = folderForConfigs();

const BUILD_FOLDER = join(folder, "dist");
const built = buildSample(BUILD_FOLDER);
const posts = await samplePosts();
const sample = builtSite("the sample site", BUILD_FOLDER, sampleConfig, posts);
const repos = await sampleRepos();
const sampleSite = makeSite(sampleConfig, posts, repos);

test("the sample site builds", () => {
  assert.equal(built.status, 0, built.stderr || built.stdout);
});

test("the sample site has a home page for each of its two languages, a page for each of their tabs, a page for each post, and a 404 page", () => {
  const tabPages = ["about/index.html", "work/index.html", "writing/index.html", "personal-fun/index.html"];
  assert.deepEqual(
    sample.pages.map(({ file }) => [file, sample.hasFile(file)]),
    [
      ["index.html", true],
      ["fr/index.html", true],
      ...tabPages.map((file) => [file, true]),
      ...tabPages.map((file) => [`fr/${file}`, true]),
      ...posts.map((post) => [`writing/${post.id}/index.html`, true]),
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

test("the sample has GitHub activity, and the build says its repos are the tests' fixture, not GitHub's", () => {
  assert.match(
    built.stdout,
    new RegExp(`the panel's GitHub activity is the fixture ${escapeRegExp(SAMPLE_GITHUB)}, not GitHub's`),
  );
});

test("the sample's llms.txt lists its public repos", () => {
  const llms = sample.read("llms.txt");
  assert.deepEqual(
    repos.filter((repo) => !llms.includes(`- [${repo.name}](${repo.url}): `)),
    [],
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

  test(`${file} lists the sample's recent public repos last in its panel, each a row marked as fetched`, () => {
    const html = sample.read(file);
    const sections = [...html.matchAll(/<section aria-labelledby="([^"]+)"/g)].map(([, id]) => id);
    assert.equal(sections.at(-1), panelId(ACTIVITY_SECTION));
    const section = html.match(new RegExp(`<section aria-labelledby="${panelId(ACTIVITY_SECTION)}".*?</section>`, "s"));
    const fetchedLinks = [
      ...(section?.[0] ?? "").matchAll(new RegExp(`<a [^>]*href="([^"]*)"[^>]*\\s${DATA.fetched}[\\s>]`, "g")),
    ];
    assert.deepEqual(
      fetchedLinks.map(([, href]) => href),
      repos.map((repo) => repo.url),
    );
  });

  test(`${file} marks each post's card with the post's own page, for the viewer to frame, under the post's title`, () => {
    const html = sample.read(file);
    for (const { post, path } of postPages(sampleSite)) {
      const card = html.match(new RegExp(`<a [^>]*href="${escapeRegExp(post.url)}"[^>]*>`))?.[0] ?? "";
      assert.ok(card.includes(` ${DATA.viewerPost}="${sampleSite.link(path)}"`), card);
      assert.ok(card.includes(` ${DATA.viewerTitle}="${post.title}"`), card);
      assert.ok(!card.includes(` ${DATA.viewerAddress}=`), "its page is the site's own, not one a `viewer` gives");
    }
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
const staticSample = builtSite("the sample on a host that reads no headers", STATIC_BUILD_FOLDER, onAStaticHost, posts);
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

test("the policy a page carries lets frames come from the site itself, for its posts' pages, and the viewer's site, and no other", () => {
  assert.match(policy, new RegExp(`(^|; )frame-src 'self' ${frameOrigins(sampleConfig.viewer).join(" ")}(;|$)`));
});

/** Each post's own page, as built. */
const postPagesBuilt = postPages(sampleSite).map((page) => ({
  ...page,
  file: `${page.path.slice(1)}index.html`,
  html: sample.read(`${page.path.slice(1)}index.html`),
}));

test("the sample's posts each have a page of the site's own, one in Japanese and one in the main language", () => {
  assert.deepEqual(
    postPagesBuilt.map(({ html }) => html.match(/<html lang="([^"]*)"/)?.[1]),
    postPagesBuilt.map(({ lang }) => lang),
  );
  assert.deepEqual(postPagesBuilt.map(({ lang }) => lang).sort(), [sampleSite.main, "ja"].sort());
});

for (const { post, file, html } of postPagesBuilt) {
  test(`${file} is headed by the post's title, with the day it was posted and a link to it on ${WRITING_PLACE}`, () => {
    assert.ok(html.includes(`<h1>${post.title}</h1>`));
    assert.ok(html.includes(`<time datetime="${post.posted}">${dayPosted(post)}</time>`));
    assert.match(
      html,
      new RegExp(
        `<a [^>]*href="${escapeRegExp(post.url)}" target="_blank" rel="noopener noreferrer">${WRITING_PLACE}</a>`,
      ),
    );
  });

  test(`${file} names the post on ${WRITING_PLACE} as its canonical address, and is marked as made from what was fetched`, () => {
    assert.ok(html.includes(`<link rel="canonical" href="${post.url}">`));
    assert.match(html, new RegExp(`<body ${DATA.fetched}>`));
  });

  test(`${file} has no script, and links only to web addresses, each in a new tab that's told nothing`, () => {
    assert.doesNotMatch(html, /<script\b/);
    const links = [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
    assert.ok(links.length);
    assert.deepEqual(
      links.filter((tag) => !/ href="https?:\/\/[^"]+" target="_blank" rel="noopener noreferrer">$/.test(tag)),
      [],
    );
  });
}

/** What the sample's first post writes as HTML, and as code about HTML. */
const A_POSTS_OWN_MARKUP = /<script>|<details|<summary|<img\b|<b>/;
const A_POSTS_CODE_AS_TEXT = "&lt;script&gt;alert(";

test("no markup of a post's reaches its page: its HTML is left out, and the code it shows is text", () => {
  const written = posts.find((post) => A_POSTS_OWN_MARKUP.test(post.body ?? ""));
  assert.ok(written, "a post of the sample's has HTML in it");
  const page = postPagesBuilt.find(({ post }) => post === written);
  assert.ok(page, "that post has a page");
  assert.doesNotMatch(page.html, A_POSTS_OWN_MARKUP);
  assert.ok(page.html.includes(A_POSTS_CODE_AS_TEXT), "the code it shows is there, as text");
});

const HTML_VALIDATE = join(ROOT, "node_modules/html-validate/bin/html-validate.mjs");
const HTML_RULES = join(ROOT, ".htmlvalidate.json");

test("each post's page is valid HTML, as `npm run lint:html` holds a site's own pages to", () => {
  const files = postPagesBuilt.map(({ file }) => join(BUILD_FOLDER, file));
  assert.ok(files.length);
  const validated = spawnSync(process.execPath, [HTML_VALIDATE, "--config", HTML_RULES, ...files], {
    encoding: "utf8",
  });
  assert.equal(validated.status, 0, validated.stdout || validated.stderr);
});

/** The sample before its first post on Qiita (tests/sample/qiita-no-posts.json): it has no Writing tab, and
    nothing on the site points at the tab's page, which isn't there. */
const NO_POSTS_BUILD_FOLDER = join(folder, "no-posts-dist");
const builtWithNoPosts = buildSample(NO_POSTS_BUILD_FOLDER, SAMPLE_CONFIG, SAMPLE_QIITA_WITH_NO_POSTS);
const sampleWithNoPosts = builtSite("the sample before its first post", NO_POSTS_BUILD_FOLDER, sampleConfig);

/** Anything that names the Writing tab's page, its answer or its id. */
const WRITING_TAB_NAMED = new RegExp(`/${WRITING_TAB}/|"${WRITING_TAB}\\.1"|id="${WRITING_TAB}"`);

test("the sample builds before its first post, saying it has no Writing tab until then", () => {
  assert.equal(builtWithNoPosts.status, 0, builtWithNoPosts.stderr || builtWithNoPosts.stdout);
  assert.match(
    builtWithNoPosts.stdout,
    new RegExp(
      `${sampleFixture().user} has no public posts on Qiita yet, so the site has no Writing tab until the first`,
    ),
  );
});

test("the sample before its first post has no page for the Writing tab, in any language", () => {
  const writingPages = sampleWithNoPosts.languagePages.map(({ file }) => file.replace(/index\.html$/, WRITING_TAB));
  assert.deepEqual(writingPages.filter(sampleWithNoPosts.hasFolder), []);
});

testBuiltSite(sampleWithNoPosts);

for (const file of [...sampleWithNoPosts.pages.map((page) => page.file), "sitemap.xml", "llms.txt", ASK_INDEX_FILE]) {
  test(`the sample before its first post: ${file} has no Writing tab, no row or link for it, and no answer from it`, () => {
    assert.doesNotMatch(sampleWithNoPosts.read(file), WRITING_TAB_NAMED);
  });
}
