import type { AskAnswer } from "../../src/contracts/ask.ts";

/** The sample site's English answers as the build writes them to
    /ask.json: one of every kind of block an answer can have, each as the
    line of text Ask reads (the GitHub history's parts from
    github-history.json), and the Writing tab of the posts in writing.json.
    The Worker's tests can't build the site (they are checked with the
    Workers types), so they read this, and ask-answers.test.ts holds it to
    what the build writes. */
export const SAMPLE_ANSWERS: AskAnswer[] = [
  {
    id: "about.1",
    title: "About",
    q: "who is sam?",
    text: "Sam is an engineer.\nOne\nTwo\nSam writes at the blog, and is on GitHub.",
  },
  {
    id: "work.1",
    title: "Work",
    q: "what does sam do?",
    text: [
      "role: Engineer",
      "skills: TypeScript Astro",
      "(link: The icon)",
      "Time to load: Before 1.04 s, After 385 ms (63% faster)",
      "The pipeline: Draft (by hand) → Publish",
      "(link: Sam's notes)",
      "(link: Sam on LinkedIn)",
      "(picture: Sam's icon.)",
      "(picture: Sam's icon, as if it moved.)",
      "“Sam got it done.” (A coworker)",
      "The icon:",
      // The four parts of the GitHub history (github-history.json): GitHub's counts, as labels.
      "(GitHub: 5,002 contributions on GitHub since 2019, 1,099 of them in private repos (counted, not shown), as of the site's last build. Longest streak: 41 days, 2023-10-02 to 2023-11-11. Busiest day: 2023-03-18, with 31.)",
      "(GitHub: Contributions on GitHub each year, as of the site's last build: 2019 28, 2020 231, 2021 485, 2022 682, 2023 821, 2024 868, 2025 1,137, 2026 750. Marked on it: Sample Co (2021-06), Example Labs (2024-02).)",
      "(GitHub: Languages in public repos on GitHub, by size, as of the site's last build: TypeScript 50%, Go 16%, Python 10%, Rust 6%, CSS 5%, Other 13%.)",
      "(GitHub: Contributions on GitHub by day of the week, as of the site's last build: Monday 17%, Tuesday 17%, Wednesday 18%, Thursday 17%, Friday 16%, Saturday 8%, Sunday 7%; the busiest, Wednesday.)",
    ].join("\n"),
  },
  {
    id: "writing.1",
    title: "Writing",
    q: "what have they written?",
    // The public posts in writing.json, newest first: each title is a line.
    text: [
      "Posts, newest first:",
      "Astroで静的サイトを組み立てる",
      "Sam's notes on testing, on Zenn",
      "朝の散歩で考えたこと",
      "Testing a static site in Playwright",
    ].join("\n"),
  },
  { id: "personal-fun.1", title: "for fun?", q: "for fun?", text: "Reading.\nMostly the blog, and a list." },
];
