/* sitemap.xml, as the build writes it (src/site/files/sitemap-xml.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { sitemapXml } from "../../../src/site/files/sitemap-xml.ts";
import { makeSite } from "../../../src/site/site.ts";
import { samplePosts } from "../../sample/qiita.ts";
import { sampleConfig, sampleInEnglishOnly } from "../sample.ts";

const posts = await samplePosts();

/** A page's <url>, with its versions by language and the main one's for any other. */
const entry = (loc: string, en: string, fr: string): string =>
  `  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${en}" />
    <xhtml:link rel="alternate" hreflang="fr" href="${fr}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${en}" />
  </url>`;

test("sitemap.xml has each language's pages, the home page and each tab's, each with all its versions by language and the main one for any other", () => {
  const site = "https://example.com/portfolio";
  const pages = ["/", "/about/", "/work/", "/writing/", "/personal-fun/"];
  const enPages = pages.map((path) => `${site}${path}`);
  const frPages = pages.map((path) => `${site}/fr${path}`);
  const entries = [
    ...enPages.map((en, nth) => entry(en, en, frPages[nth] ?? "")),
    ...frPages.map((fr, nth) => entry(fr, enPages[nth] ?? "", fr)),
  ];
  assert.equal(
    sitemapXml(makeSite(sampleConfig(), posts)),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`,
  );
});

test("a site in one language has each of its pages once, each also the one for any other language", () => {
  const sitemap = sitemapXml(makeSite({ ...sampleInEnglishOnly(), url: "https://example.com" }));
  assert.deepEqual(sitemap.match(/<(loc|xhtml:link)[^\n]*/g)?.slice(0, 6), [
    "<loc>https://example.com/</loc>",
    '<xhtml:link rel="alternate" hreflang="en" href="https://example.com/" />',
    '<xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/" />',
    "<loc>https://example.com/about/</loc>",
    '<xhtml:link rel="alternate" hreflang="en" href="https://example.com/about/" />',
    '<xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/about/" />',
  ]);
});

test("what XML reads as markup in an address is written as an entity", () => {
  const sitemap = sitemapXml(makeSite({ ...sampleInEnglishOnly(), url: "https://example.com/a&b" }));
  assert.deepEqual(sitemap.match(/<(loc|xhtml:link)[^\n]*/g)?.slice(0, 3), [
    "<loc>https://example.com/a&amp;b/</loc>",
    '<xhtml:link rel="alternate" hreflang="en" href="https://example.com/a&amp;b/" />',
    '<xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/a&amp;b/" />',
  ]);
});

test("before the first post, sitemap.xml has no Writing tab's page", () => {
  assert.doesNotMatch(sitemapXml(makeSite(sampleConfig(), [])), /\/writing\//);
});
