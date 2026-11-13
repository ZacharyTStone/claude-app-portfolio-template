/* robots.txt, as the build writes it (src/site/files/robots-txt.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { robotsTxt } from "../../../src/site/files/robots-txt.ts";
import { makeSite } from "../../../src/site/site.ts";
import { sampleConfig } from "../sample.ts";

test("robots.txt lets every crawler read everything, and names the sitemap by its full address", () => {
  assert.equal(
    robotsTxt(makeSite(sampleConfig())),
    "User-agent: *\nAllow: /\n\nSitemap: https://example.com/portfolio/sitemap.xml\n",
  );
});

test("a site at the root has its sitemap at the root", () => {
  assert.equal(
    robotsTxt(makeSite(sampleConfig({ url: "https://example.com" }))),
    "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml\n",
  );
});
