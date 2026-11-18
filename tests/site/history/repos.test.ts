/* The public repos the calendar shows (src/site/history/repos.ts): none
   unless the config asks, every one with `true`, and all but those it
   hides, named in any case. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { hiddenButNotFound, shownRepos } from "../../../src/site/history/repos.ts";
import { madeUp } from "./made-up.ts";

const repo = (name: string) => ({ name, url: `https://github.com/sam-sample/${name}`, madeOn: "2023-01-01" });
const history = madeUp({ 2023: [1] }, { repos: [repo("dotfiles"), repo("Notes"), repo("site")] });
const names = (repos: Array<{ name: string }>) => repos.map(({ name }) => name);

test("without repos in the config, the calendar shows none", () => {
  assert.deepEqual(shownRepos(history, undefined), []);
});

test("with repos: true, it shows every one", () => {
  assert.deepEqual(names(shownRepos(history, true)), ["dotfiles", "Notes", "site"]);
});

test("with repos to hide, it shows all but those, named in any case, as GitHub matches them", () => {
  assert.deepEqual(names(shownRepos(history, { hide: ["DOTFILES", "notes"] })), ["site"]);
});

test("a hidden name that's none of the repos is found out, in the case it was hidden in", () => {
  assert.deepEqual(hiddenButNotFound(history, { hide: ["dotfiles", "Old-Site"] }), ["old-site"]);
  assert.deepEqual(hiddenButNotFound(history, true), []);
  assert.deepEqual(hiddenButNotFound(history, undefined), []);
});
