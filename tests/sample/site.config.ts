/* A made-up site with what the template's own one-language site can't
   show, for the tests to check and to build (build.ts): it's served under
   a path, in two languages, with Ask on, the contact form, a link that
   opens in the viewer, a panel whose Context gathers the answers' links,
   one of each kind of figure, a picture that moves all the time, a
   Writing tab of posts on Qiita, Zenn and note, each Qiita post with a page
   of its own that the viewer shows, its recent public activity on GitHub,
   GitLab and Codeberg in the panel, and its whole history on GitHub as the
   four parts of an answer, which the tests' builds are given from
   writing.json, activity.json and github-history.json: no test reaches any
   of them.

   tests/sample/ask-answers.ts has its English answers word for word, for
   the Worker's tests: a change to an answer here is a change there. */
import { mapValues } from "es-toolkit";
import { ENGLISH_STRINGS } from "../../src/config/english-strings.ts";
import type { Language } from "../../src/config/language.ts";
import type { SiteConfig } from "../../src/config/site-config.ts";
import type { Strings } from "../../src/config/strings.ts";
import { FAVICONS } from "../../src/site/icons.ts";

/** The one picture the sample uses, for its social card too: a file every
    site has, so the sample builds in any repo. */
const icon = FAVICONS.appleTouch;
/** That file's width and height, in pixels. */
const ICON_SIZE = 180;
const iconPicture = { src: icon, alt: "Sam's icon", width: ICON_SIZE, height: ICON_SIZE };
/** The sample's own picture, which moves, and the same picture still. No
    site's public/ has them: build.ts puts them in the sample's build. */
const movingIcon = { src: "/assets/sample-icon-moving.svg", still: "/assets/sample-icon-still.svg" };

/** A document on another site: the address the sample's link card has, and
    the address that shows the document in the viewer's frame. */
const notes = { href: "https://docs.example.com/d/notes/edit", inFrame: "https://docs.example.com/d/notes/preview" };

/** Sam's profiles. */
const github = "https://github.com/example";
const linkedin = "https://www.linkedin.com/in/example";
/** Links in the text, for the panel's Context to gather: one to GitHub,
    which its own row has, a site linked again from the personal answer,
    and an address long enough to have to fit the panel. */
const blog = "https://blog.example.com/";
const aboutLinks = `[the blog](${blog}), and is on [GitHub](${github})`;
const readingLinks = `[the blog](${blog}), and [a list](https://a-very-long-subdomain-for-a-reading-list.example.com/lists/sam-sample-reading-list-for-2026)`;

/** Every string of the interface as a language other than English has to
    state it, told apart from English's own: "Share (fr)". */
const stringsMarked = (label: string): Strings => mapValues(ENGLISH_STRINGS, (wording) => `${wording} (${label})`);

/** One language of the sample. Its content is the same in each: only the
    label, the locale and the interface's strings tell them apart. */
function sampleLanguage(label: string, locale: string, strings?: Strings): Language {
  return {
    label,
    name: label,
    locale,
    meta: {
      title: "Sam Sample",
      description: "A sample",
      imageAlt: "Sam's icon",
      preload: ["/assets/fonts/inter.woff2"],
    },
    person: { name: "Sam Sample", jobTitle: "Engineer" },
    home: {
      greeting: { default: "Hi", morning: "Morning", afternoon: "Afternoon", evening: "Evening", late: "Late" },
      intro: `Sam builds things: [the work](#work), and [the icon](${icon}).`,
      hint: "Pick a tab.",
      place: "London",
      prompts: [{ q: "What does Sam do?", answer: "work.1" }],
    },
    sidebar: {
      newTab: "New tab",
      nav: [{ tab: "about", icon: "about", label: "About" }],
      groups: [
        { id: "work", label: "Work", tabs: [{ tab: "work", title: "Work", subtitle: "2020 – now", live: "Now" }] },
      ],
    },
    threads: [
      {
        id: "about",
        title: "About",
        messages: [
          { q: "who is sam?", a: ["Sam is **an engineer**.", ["One", "Two"], `Sam writes at ${aboutLinks}.`] },
        ],
      },
      {
        id: "work",
        title: "Work",
        pill: { label: "Now", live: true },
        messages: [
          {
            q: "what does sam do?",
            read: { file: "work.md", card: { file: "role.yaml", lines: [["role", "Engineer", "for now"]] } },
            a: [
              { card: { file: "skills.yaml", lines: [["skills", ["TypeScript", "Astro"]]] } },
              { link: { name: "The icon", kind: "Image", href: icon, icon: "file" } },
              {
                bars: {
                  title: "Time to load",
                  note: "63% faster",
                  rows: [
                    { label: "Before", value: "1.04 s", amount: 1040 },
                    { label: "After", value: "385 ms", amount: 385, accent: true },
                  ],
                },
              },
              { flow: { title: "The pipeline", steps: [{ name: "Draft", note: "by hand" }, { name: "Publish" }] } },
              { link: { name: "Sam's notes", kind: "Document", href: notes.href, icon: "file" } },
              { link: { name: "Sam on LinkedIn", kind: "Profile", href: linkedin, icon: "linkedin" } },
              { image: { ...iconPicture, caption: "Sam's icon.", href: icon } },
              { image: { ...iconPicture, ...movingIcon, caption: "Sam's icon, as if it moved." } },
              {
                images: [
                  { ...iconPicture, href: "https://pictures.example.com/sam" },
                  { ...iconPicture, round: true },
                ],
              },
              { quote: { text: "Sam got it done.", by: "A coworker" } },
              { heading: { label: "Project", title: "The icon" } },
              { github: "stats" },
              { github: "calendar" },
              { github: "languages" },
              { github: "rhythm" },
            ],
          },
        ],
      },
    ],
    asked: {
      title: "Something else",
      q: "a question",
      answer: "Ask Sam.",
      mail: "Email it",
      subject: "A question",
      email: "{question}",
      linkedin: "Message on LinkedIn",
      message: { label: "To copy", text: "{question}", copy: "Copy" },
    },
    panel: {
      progress: { title: "Career", steps: [{ tab: "work", title: "Work", when: "2020", now: true }] },
      outputs: { title: "Files", rows: [{ label: "The icon", meta: "Image", icon: "file", href: icon }] },
      // Above its own rows, the links the open tab's answers use. A row
      // that isn't a link stays in its place.
      context: {
        title: "Links",
        fromAnswers: true,
        rows: [
          { label: "GitHub", meta: "example", icon: "github", href: github },
          { label: "Remote", meta: "Based in", icon: "globe" },
        ],
      },
    },
    account: {
      initial: "S",
      name: "Sam",
      sub: "Remote",
      label: "Account",
      clock: {
        me: "Sam",
        zone: "UTC",
        you: "You",
        ahead: "{n}h ahead",
        behind: "{n}h behind",
        same: "Same time",
        moods: { morning: "Up", day: "Busy", evening: "Done", late: "Asleep" },
      },
      language: "Language",
      upgrade: { label: "Upgrade", hire: "Hire", tab: "about" },
      logout: { label: "Log out", title: "Bye", text: "Bye.", back: "Back" },
    },
    questions: {
      ask: "What would you like to know?",
      topics: [
        { label: "About", tab: "about" },
        { label: "Work", tab: "work" },
        { label: "Something personal", ask: "Such as?", personal: true },
      ],
      personal: [{ id: "fun", q: "for fun?", a: ["Reading.", `Mostly ${readingLinks}.`] }],
      ui: { else: "Else", elseLabel: "Else", send: "Send", back: "Back", step: "{n} of {total}", followUp: "More" },
    },
    notFound: { title: "Not found.", text: "Nothing here.", back: "Back" },
    strings,
  };
}

const config: SiteConfig = {
  url: "https://example.com/portfolio/",
  host: "cloudflare",
  name: "Sam Sample",
  timezone: "UTC",
  links: { email: "sam@example.com", github, linkedin },
  social: { image: icon, width: ICON_SIZE, height: ICON_SIZE },
  themeColor: "#191919",
  ask: { role: "an engineer" },
  // From New York to London, where its clock is.
  globe: { here: [-0.13, 51.51], from: [-74.01, 40.71] },
  // Under the About thread, the one thread with one answer.
  contactForm: { tab: "about" },
  // Sam's notes open in the viewer, at the address that shows them in a frame.
  viewer: { [notes.href]: notes.inFrame },
  // Its posts are made up, on Qiita, Zenn and note: the tests' builds read
  // them from writing.json. Each Qiita post opens in the viewer too, as a
  // page of the site's own.
  writing: { qiita: "sam-sample", zenn: "sam_sample", note: "sam_sample", viewer: true },
  // So is its activity on all three places, read from activity.json: on
  // Codeberg, Sam has another name. And its whole history on GitHub, from
  // github-history.json, with two moments marked on it.
  activity: { github: "sam-sample", gitlab: "sam-sample", codeberg: "sams" },
  githubHistory: {
    user: "sam-sample",
    marks: [
      { at: "2021-06", label: "Sample Co" },
      { at: "2024-02", label: "Example Labs" },
    ],
    repos: { hide: ["dotfiles"] },
  },
  llms: { summary: "A sample.", about: "Sam is a sample." },
  // English leaves the interface's strings to English's own.
  languages: {
    en: sampleLanguage("EN", "en_US"),
    fr: sampleLanguage("FR", "fr_FR", stringsMarked("fr")),
  },
};

export default config;
