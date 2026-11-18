/* The panel's activity as rows (src/site/activity/rows.ts): what each says,
   the day by the owner's clock in the page's language, and the place,
   on a site that reads more than one. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_ICON } from "../../../src/config/activity.ts";
import type { Repo } from "../../../src/site/activity/repo.ts";
import { activityRows, dayPushed, repoLabel } from "../../../src/site/activity/rows.ts";

const ON_GITHUB = { github: "sam-sample" };
const ON_ALL_THREE = { github: "sam-sample", gitlab: "sam-sample", codeberg: "sams" };

/** Pushed late on the 12th in London, which is already the 13th in Tokyo. */
const notes: Repo = {
  service: "github",
  name: "sam-sample/notes",
  url: "https://github.com/sam-sample/notes",
  pushed: "2026-11-12T23:30:00Z",
};
const anothers: Repo = {
  service: "github",
  name: "sample-org/tool",
  url: "https://github.com/sample-org/tool",
  pushed: "2026-11-08T15:45:00Z",
};
/** In a subgroup of someone else's group, on GitLab. */
const nested: Repo = {
  service: "gitlab",
  name: "sample-group/tools/linter",
  url: "https://gitlab.com/sample-group/tools/linter",
  pushed: "2026-11-10T08:15:00Z",
};
/** The user's own, on Codeberg, where their name is another. */
const zine: Repo = {
  service: "codeberg",
  name: "sams/zine",
  url: "https://codeberg.org/sams/zine",
  pushed: "2026-11-09T20:00:00Z",
};

test("one of the owner's own repos is named without the owner, another's with it", () => {
  assert.equal(repoLabel(notes, ON_GITHUB), "notes");
  assert.equal(repoLabel(notes, { github: "Sam-Sample" }), "notes");
  assert.equal(repoLabel(anothers, ON_GITHUB), "sample-org/tool");
});

test("the owner is the user on the repo's own place: their name on another is someone else", () => {
  assert.equal(repoLabel(zine, ON_ALL_THREE), "zine");
  assert.equal(repoLabel(zine, { github: "sams", codeberg: "sam-sample" }), "sams/zine");
});

test("a repo in a subgroup is named by its whole path, as GitLab writes it", () => {
  assert.equal(repoLabel(nested, ON_ALL_THREE), "sample-group/tools/linter");
  assert.equal(repoLabel(nested, { gitlab: "sample-group" }), "tools/linter");
});

test("the day is the owner's, by the config's time zone, as the page's language writes it", () => {
  assert.equal(dayPushed(notes, "en", "Europe/London"), "Nov 12, 2026");
  assert.equal(dayPushed(notes, "en", "Asia/Tokyo"), "Nov 13, 2026");
  assert.equal(dayPushed(notes, "ja", "Asia/Tokyo"), "2026/11/13");
});

test("for a language the platform doesn't know, the day is written as the place has it, in UTC", () => {
  assert.equal(dayPushed(notes, "not a language", "UTC"), "2026-11-12");
});

test("each repo is a row that links to it, with its day on the right, in the order the build listed them", () => {
  assert.deepEqual(activityRows([notes, anothers], ON_GITHUB, "en", "UTC"), [
    { label: "notes", meta: "Nov 12, 2026", icon: ACTIVITY_ICON, href: notes.url },
    { label: "sample-org/tool", meta: "Nov 8, 2026", icon: ACTIVITY_ICON, href: anothers.url },
  ]);
});

test("on a site that reads more than one place, each row names its place before the day", () => {
  assert.deepEqual(
    activityRows([notes, nested, zine], ON_ALL_THREE, "en", "UTC").map((row) => [row.label, row.meta, row.href]),
    [
      ["notes", "GitHub · Nov 12, 2026", notes.url],
      ["sample-group/tools/linter", "GitLab · Nov 10, 2026", nested.url],
      ["zine", "Codeberg · Nov 9, 2026", zine.url],
    ],
  );
});

test("the place is named on every row, even when every row listed is on one", () => {
  const rows = activityRows([notes, anothers], { github: "sam-sample", codeberg: "sams" }, "ja", "Asia/Tokyo");
  assert.deepEqual(
    rows.map((row) => row.meta),
    ["GitHub · 2026/11/13", "GitHub · 2026/11/09"],
  );
});
