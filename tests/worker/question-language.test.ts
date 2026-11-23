import assert from "node:assert/strict";
import { test } from "node:test";
import { questionLanguage } from "../../src/worker/ask/question-language.ts";

const languages = ["en", "ja"];

test("a question in English on the Japanese page is answered in English", () => {
  assert.equal(questionLanguage("Does Alex have the JLPT?", "ja", languages), "en");
});

test("a question in Japanese on the English page is answered in Japanese", () => {
  assert.equal(questionLanguage("日本語は話せますか？", "en", languages), "ja");
});

test("a question in Japanese that names something in Latin letters is in Japanese", () => {
  assert.equal(questionLanguage("Reactの経験は？", "en", languages), "ja");
  assert.equal(questionLanguage("ＢＪＴを持っていますか", "en", languages), "ja");
});

test("a question in English that names something in Japanese is in English", () => {
  assert.equal(questionLanguage("Does Alex know what 日本語 means?", "ja", languages), "en");
});

test("a question in the page's own language stays in it", () => {
  assert.equal(questionLanguage("What does Alex do?", "en", languages), "en");
  assert.equal(questionLanguage("仕事は何ですか？", "ja", languages), "ja");
});

test("the page's language, for a question with no letters, or in a script the site isn't in", () => {
  assert.equal(questionLanguage("???", "ja", languages), "ja");
  assert.equal(questionLanguage("Что он делает?", "ja", languages), "ja");
});

test("the page's language, when two of the site's are in the question's script", () => {
  assert.equal(questionLanguage("¿Qué hace Alex?", "ja", ["en", "es", "ja"]), "ja");
});

test("a site in one language answers in it", () => {
  assert.equal(questionLanguage("日本語は話せますか？", "en", ["en"]), "en");
});
