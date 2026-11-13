/* What the config's checks say of the sample site once a test has made
   something in it wrong. */
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import type { Block } from "../../../src/config/blocks.ts";
import type { Language } from "../../../src/config/language.ts";
import type { SiteConfig } from "../../../src/config/site-config.ts";
import { checkSite } from "../../../src/site/checks/check-site.ts";
import type { Findings } from "../../../src/site/checks/reporting.ts";
import { iconsIn, readStylesheet, STYLES_FOLDER } from "../../../src/site/icons.ts";
import { ROOT } from "../../../src/site/repo.ts";
import { makeSite } from "../../../src/site/site.ts";
import { languageOf, sampleConfig } from "../sample.ts";

const stylesheetIcons = iconsIn(readStylesheet(join(ROOT, STYLES_FOLDER)));

/** What the checks find in a config: its problems, and their advice. */
export const findingsIn = (config: SiteConfig): Findings => checkSite(makeSite(config), stylesheetIcons);

export const problemsIn = (config: SiteConfig): string[] => findingsIn(config).problems;

/** A change to the sample: to the config as a whole, or to its English
    alone (so the languages may no longer match). */
export type Change = (sample: SiteConfig, english: Language) => void;

/** The sample once `change` is made to it. */
export function sampleAfter(change: Change): SiteConfig {
  const sample = sampleConfig();
  change(sample, languageOf(sample, "en"));
  return sample;
}

export const problemsAfter = (change: Change): string[] => problemsIn(sampleAfter(change));

/** A change made to every language of the sample, so they still match. */
export const inEveryLanguage =
  (change: (language: Language) => void): Change =>
  (sample) =>
    Object.values(sample.languages).forEach(change);

/** A change made to the sample's French, the language that isn't its main one. */
export const inFrench =
  (change: (french: Language) => void): Change =>
  (sample) =>
    change(languageOf(sample, "fr"));

/** The blocks of the answer in a language's "work" thread. */
export function workAnswer(language: Language): Block[] {
  const blocks = language.threads.find((thread) => thread.id === "work")?.messages[0]?.a;
  assert.ok(blocks, 'the sample has a thread "work" with an answer');
  return blocks;
}

/** A change that adds `block` to the answer in the sample's "work" thread, in English alone. */
export const withBlock =
  (block: Block): Change =>
  (_, english) =>
    workAnswer(english).push(block);

/** One way a config goes wrong, and all the checks then say, word for word. */
export type ProblemRow = {
  /** What's wrong, which names the test. */
  wrong: string;
  change: Change;
  problems: string[];
};

/** A test for each row: the problems after its change are exactly the row's. */
export function testEachProblem(rows: ProblemRow[]): void {
  for (const { wrong, change, problems } of rows) {
    test(wrong, () => assert.deepEqual(problemsAfter(change), problems));
  }
}

/** A problem as each language of the sample reports it: "en: …", then "fr: …". */
export const inBothLanguages = (problem: string): string[] => [`en: ${problem}`, `fr: ${problem}`];
