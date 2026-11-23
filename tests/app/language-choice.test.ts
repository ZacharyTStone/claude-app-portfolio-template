import assert from "node:assert/strict";
import { test } from "node:test";
import { preferredLanguage } from "../../src/app/language-choice.ts";

const offered = ["en", "ja"];

test("the first of the visitor's languages the site has is theirs", () => {
  assert.equal(preferredLanguage(["fr", "ja", "en"], offered), "ja");
  assert.equal(preferredLanguage(["en", "ja"], offered), "en");
});

test("a regional tag finds its language, and a language its regional page", () => {
  assert.equal(preferredLanguage(["ja-JP"], offered), "ja");
  assert.equal(preferredLanguage(["EN-gb"], offered), "en");
  assert.equal(preferredLanguage(["pt"], ["en", "pt-BR"]), "pt-BR");
});

test("the same tag is chosen before another in its language", () => {
  assert.equal(preferredLanguage(["pt-PT"], ["pt-BR", "pt-PT"]), "pt-PT");
});

test("none, for a visitor whose languages the site isn't in", () => {
  assert.equal(preferredLanguage(["de", "fr"], offered), undefined);
  assert.equal(preferredLanguage([], offered), undefined);
});
