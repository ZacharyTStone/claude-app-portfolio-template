/* The sample site (tests/sample/site.config.ts), for the tests of what's
   made from a config: a fresh copy each time, so a test can change its own. */
import assert from "node:assert/strict";
import type { Language } from "../../src/config/language.ts";
import type { SiteConfig } from "../../src/config/site-config.ts";
import sample from "../sample/site.config.ts";

/** The sample's config, with `overrides` in place of its own settings. An
    override of `undefined` leaves a setting out. */
export const sampleConfig = (overrides: Partial<SiteConfig> = {}): SiteConfig => ({
  ...structuredClone(sample),
  ...overrides,
});

/** One of a sample config's languages, which it has. */
export function languageOf(config: SiteConfig, code: string): Language {
  const language = config.languages[code];
  assert.ok(language, `the sample has the language "${code}"`);
  return language;
}

/** The sample's main language, English, alone: a site in one language. */
export const sampleInEnglishOnly = (): SiteConfig => {
  const config = sampleConfig();
  return { ...config, languages: { en: languageOf(config, "en") } };
};
