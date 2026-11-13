import type { AskAnswer } from "../../src/contracts/ask.ts";

/** The sample site's English answers as the build writes them to
    /ask.json: one of every kind of block an answer can have, each as the
    line of text Ask reads. The Worker's tests can't build the site (they
    are checked with the Workers types), so they read this, and
    ask-answers.test.ts holds it to what the build writes. */
export const SAMPLE_ANSWERS: AskAnswer[] = [
  { id: "about.1", title: "About", q: "who is sam?", text: "Sam is an engineer.\nOne\nTwo" },
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
      "(picture: Sam's icon.)",
      "(picture: Sam's icon, as if it moved.)",
      "“Sam got it done.” (A coworker)",
      "The icon:",
    ].join("\n"),
  },
  { id: "personal-fun.1", title: "for fun?", q: "for fun?", text: "Reading." },
];
