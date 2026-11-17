/* The panel's GitHub activity as rows (src/site/activity/rows.ts): what each
   says, and the day by the owner's clock in the page's language. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_ICON } from "../../../src/config/activity.ts";
import type { Repo } from "../../../src/site/activity/github.ts";
import { activityRows, dayPushed, repoLabel } from "../../../src/site/activity/rows.ts";

const USER = "sam-sample";

/** Pushed late on the 12th in London, which is already the 13th in Tokyo. */
const notes: Repo = {
  name: "sam-sample/notes",
  url: "https://github.com/sam-sample/notes",
  pushed: "2026-11-12T23:30:00Z",
};
const anothers: Repo = {
  name: "sample-org/tool",
  url: "https://github.com/sample-org/tool",
  pushed: "2026-11-08T15:45:00Z",
};

test("one of the owner's own repos is named without the owner, another's with it", () => {
  assert.equal(repoLabel(notes, USER), "notes");
  assert.equal(repoLabel(notes, "Sam-Sample"), "notes");
  assert.equal(repoLabel(anothers, USER), "sample-org/tool");
});

test("the day is the owner's, by the config's time zone, as the page's language writes it", () => {
  assert.equal(dayPushed(notes, "en", "Europe/London"), "Nov 12, 2026");
  assert.equal(dayPushed(notes, "en", "Asia/Tokyo"), "Nov 13, 2026");
  assert.equal(dayPushed(notes, "ja", "Asia/Tokyo"), "2026/11/13");
});

test("for a language the platform doesn't know, the day is written as GitHub has it", () => {
  assert.equal(dayPushed(notes, "not a language", "UTC"), "2026-11-12");
});

test("each repo is a row that links to it, with its day on the right, in the order the build listed them", () => {
  assert.deepEqual(activityRows([notes, anothers], USER, "en", "UTC"), [
    { label: "notes", meta: "Nov 12, 2026", icon: ACTIVITY_ICON, href: notes.url },
    { label: "sample-org/tool", meta: "Nov 8, 2026", icon: ACTIVITY_ICON, href: anothers.url },
  ]);
});
