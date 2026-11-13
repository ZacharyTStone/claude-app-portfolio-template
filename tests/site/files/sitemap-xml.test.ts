/* sitemap.xml, as the build writes it (src/site/files/sitemap-xml.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { sitemapXml } from "../../../src/site/files/sitemap-xml.ts";
import { makeSite } from "../../../src/site/site.ts";
import { sampleConfig, sampleInEnglishOnly } from "../sample.ts";

test("sitemap.xml has every language's page, each with all of them by language and the main one for any other", () => {
  assert.equal(
    sitemapXml(makeSite(sampleConfig())),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/portfolio/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/portfolio/" />
    <xhtml:link rel="alternate" hreflang="fr" href="https://example.com/portfolio/fr/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/portfolio/" />
  </url>
  <url>
    <loc>https://example.com/portfolio/fr/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/portfolio/" />
    <xhtml:link rel="alternate" hreflang="fr" href="https://example.com/portfolio/fr/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/portfolio/" />
  </url>
</urlset>
`,
  );
});

test("a site in one language has one page in its sitemap, which is also the one for any other language", () => {
  const sitemap = sitemapXml(makeSite({ ...sampleInEnglishOnly(), url: "https://example.com" }));
  assert.deepEqual(sitemap.match(/<(loc|xhtml:link)[^\n]*/g), [
    "<loc>https://example.com/</loc>",
    '<xhtml:link rel="alternate" hreflang="en" href="https://example.com/" />',
    '<xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/" />',
  ]);
});

test("what XML reads as markup in an address is written as an entity", () => {
  const sitemap = sitemapXml(makeSite({ ...sampleInEnglishOnly(), url: "https://example.com/a&b" }));
  assert.deepEqual(sitemap.match(/<(loc|xhtml:link)[^\n]*/g), [
    "<loc>https://example.com/a&amp;b/</loc>",
    '<xhtml:link rel="alternate" hreflang="en" href="https://example.com/a&amp;b/" />',
    '<xhtml:link rel="alternate" hreflang="x-default" href="https://example.com/a&amp;b/" />',
  ]);
});
