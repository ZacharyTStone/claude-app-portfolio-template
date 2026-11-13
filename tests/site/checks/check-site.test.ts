/* Configs with nothing wrong: this site's own, the sample on every host,
   and one that leaves out all it may. */
import assert from "node:assert/strict";
import { test } from "node:test";
import ownConfig from "../../../site.config.ts";
import { HOSTS } from "../../../src/config/site-config.ts";
import { languageOf, sampleConfig } from "../sample.ts";
import { findingsIn, problemsIn } from "./problems.ts";

test("this site's config has no problems", () => {
  assert.deepEqual(problemsIn(ownConfig), []);
});

for (const host of HOSTS) {
  test(`the sample without Ask has no problems and gets no advice on the host "${host}"`, () => {
    assert.deepEqual(findingsIn(sampleConfig({ host, ask: undefined })), { problems: [], notes: [] });
  });
}

test("a config that leaves out everything it may has no problems", () => {
  const sample = sampleConfig({ links: { email: "sam@example.com" } });
  const english = languageOf(sample, "en");
  const { home, account } = english;
  const bareEnglish = {
    ...english,
    home: { greeting: home.greeting, intro: home.intro },
    panel: {},
    account: { ...account, language: undefined },
  };
  assert.deepEqual(problemsIn({ ...sample, languages: { en: bareEnglish } }), []);
});
