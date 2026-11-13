/* The interface's wording in English, and which pages fall back on it
   (src/config/english-strings.ts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ENGLISH_STRINGS, isEnglish } from "../../src/config/english-strings.ts";
import type { Strings } from "../../src/config/strings.ts";

for (const code of ["en", "en-GB", "en-US"]) {
  test(`a page whose language is "${code}" is in English`, () => {
    assert.ok(isEnglish(code));
  });
}

for (const code of ["fr", "ja", "eng", "ENGLISH", "pt-BR"]) {
  test(`a page whose language is "${code}" isn't`, () => {
    assert.ok(!isEnglish(code));
  });
}

/** Where the page or the script puts something into a string. */
const PLACES_TO_FILL: Array<[name: keyof Strings, place: string]> = [
  ["status", "{file}"],
  ["moveSection", "{name}"],
  ["askFrom", "{tab}"],
  ["askFromPersonal", "{tab}"],
  ["askLimited", "{limit}"],
  ["askLeft", "{n}"],
];

for (const [name, place] of PLACES_TO_FILL) {
  test(`English's own "${name}" says where its ${place} goes`, () => {
    assert.ok(ENGLISH_STRINGS[name].includes(place));
  });
}

test("no string of English's is empty", () => {
  assert.deepEqual(
    Object.entries(ENGLISH_STRINGS).filter(([, wording]) => !wording),
    [],
  );
});

test("none of English's own words links anywhere, since no thread is in every site", () => {
  assert.deepEqual(
    Object.values(ENGLISH_STRINGS).filter((wording) => wording.includes("](")),
    [],
  );
});
