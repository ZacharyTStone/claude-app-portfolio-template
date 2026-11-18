/* The checks of the config's `writing` (src/site/checks/writing.ts): each
   problem's wording, and what's allowed. */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Writing } from "../../../src/config/writing.ts";
import { sampleConfig } from "../sample.ts";
import { problemsIn, testEachProblem } from "./problems.ts";

/** The sample with `writing` as a test has it, and no other wording to ask for. */
const withWriting = (writing: Writing) => sampleConfig({ writing });

testEachProblem([
  {
    wrong: "writing names nowhere to fetch posts from",
    change: (sample) => (sample.writing = { viewer: true }),
    problems: [
      "writing should name at least one place your posts are: qiita, zenn, dev, note, medium, substack, hatena or feeds",
    ],
  },
  {
    wrong: "the Zenn user is its profile's whole address",
    change: (sample) => (sample.writing = { zenn: "https://zenn.dev/sam_sample" }),
    problems: [
      `writing.zenn should be a Zenn user name, as in your profile's address (zenn.dev/alex_example is "alex_example")`,
    ],
  },
  {
    wrong: "the DEV user is written with an @",
    change: (sample) => (sample.writing = { dev: "@sam-sample" }),
    problems: [
      `writing.dev should be a DEV user name, as in your profile's address (dev.to/alex-example is "alex-example")`,
    ],
  },
  {
    wrong: "the note id has a slash in it",
    change: (sample) => (sample.writing = { note: "sam/rss" }),
    problems: [
      `writing.note should be a note id, as in your profile's address (note.com/alex_example is "alex_example")`,
    ],
  },
  {
    wrong: "the Medium user is written with its @",
    change: (sample) => (sample.writing = { medium: "@sam" }),
    problems: [
      `writing.medium should be a Medium user name, without its "@" (medium.com/@alex-example is "alex-example")`,
    ],
  },
  {
    wrong: "the Substack is its whole address",
    change: (sample) => (sample.writing = { substack: "samsample.substack.com" }),
    problems: [
      `writing.substack should be a Substack's name, as in its address (alexexample.substack.com is "alexexample")`,
    ],
  },
  {
    wrong: "the Hatena Blog has https:// in front",
    change: (sample) => (sample.writing = { hatena: "https://sam.hatenablog.com" }),
    problems: [
      `writing.hatena should be a Hatena Blog's address, without "https://", like "alex-example.hatenablog.com"`,
    ],
  },
  {
    wrong: "a feed isn't a web address",
    change: (sample) => (sample.writing = { feeds: [{ url: "blog.example.com/rss" }] }),
    problems: [`writing.feeds[0].url should be a feed's web address, like "https://…"`],
  },
  {
    wrong: "the most posts the tab lists isn't a count",
    change: (sample) => (sample.writing = { qiita: "sam-sample", latest: 2.5 }),
    problems: ["writing.latest should be how many posts the tab lists at most, a whole number like 30"],
  },
  {
    wrong: "the tab is to list no posts at all",
    change: (sample) => (sample.writing = { qiita: "sam-sample", latest: 0 }),
    problems: ["writing.latest should be how many posts the tab lists at most, a whole number like 30"],
  },
  {
    wrong: "a feed's name is blank",
    change: (sample) => (sample.writing = { feeds: [{ url: "https://blog.example.com/rss", name: " " }] }),
    problems: ["writing.feeds[0].name should have words in it"],
  },
]);

test("any place, or any mix of them, is allowed", () => {
  for (const writing of [
    { qiita: "sam-sample" },
    { zenn: "sam_sample", dev: "sam-sample" },
    { note: "sam_sample", medium: "sam.sample", substack: "samsample", hatena: "sam.hatenablog.com" },
    { feeds: [{ url: "https://blog.example.com/rss/", name: "Sam's blog" }] },
  ]) {
    assert.deepEqual(problemsIn(withWriting(writing)), [], JSON.stringify(writing));
  }
});
