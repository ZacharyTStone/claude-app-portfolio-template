/* security.txt, as the build writes it (src/site/files/security-txt.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { expiryAfter, securityTxt } from "../../../src/site/files/security-txt.ts";
import { makeSite } from "../../../src/site/site.ts";
import { languageOf, sampleConfig, sampleInEnglishOnly } from "../sample.ts";

const EXPIRES = new Date("2027-11-17T09:30:00.000Z");

test("security.txt gives the site's email to report to, when it stops holding, the site's languages, and its own address under the site's path", () => {
  assert.equal(
    securityTxt(makeSite(sampleConfig()), EXPIRES),
    [
      "Contact: mailto:sam@example.com",
      "Expires: 2027-11-17T09:30:00.000Z",
      "Preferred-Languages: en, fr",
      "Canonical: https://example.com/portfolio/.well-known/security.txt",
      "",
    ].join("\n"),
  );
});

test("a site at the root has its security.txt at the root's /.well-known/", () => {
  const text = securityTxt(makeSite(sampleConfig({ url: "https://example.com" })), EXPIRES);
  assert.match(text, /^Canonical: https:\/\/example\.com\/\.well-known\/security\.txt$/m);
});

test("a site in one language prefers it alone, and one whose main language is another prefers that first", () => {
  assert.match(securityTxt(makeSite(sampleInEnglishOnly()), EXPIRES), /^Preferred-Languages: en$/m);
  const config = sampleConfig();
  const frenchFirst = { ...config, languages: { fr: languageOf(config, "fr"), en: languageOf(config, "en") } };
  assert.match(securityTxt(makeSite(frenchFirst), EXPIRES), /^Preferred-Languages: fr, en$/m);
});

test("security.txt holds for under a year after the build, as RFC 9116 asks", () => {
  const builtAt = new Date("2026-11-18T09:30:00.000Z");
  assert.equal(expiryAfter(builtAt).toISOString(), "2027-11-17T09:30:00.000Z");
  const aYearOn = new Date(builtAt);
  aYearOn.setUTCFullYear(builtAt.getUTCFullYear() + 1);
  assert.ok(expiryAfter(builtAt) < aYearOn);
});
