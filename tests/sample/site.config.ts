/* A made-up site for tests/sample-site.test.ts to build: a GitHub project site
   (served under /portfolio/, on a host that reads no _headers file), in
   two languages, with one of each kind of figure, a picture with a still,
   and a link that opens in the viewer. */
import type { Language, SiteConfig, Strings } from "../../src/shared/config.ts";
import { PAGE_STRINGS } from "../../src/shared/config.ts";
import { SCRIPT_STRINGS } from "../../src/shared/page-data.ts";
import { ICONS } from "../../src/site/constants.ts";

/** The one picture the sample uses, for its social card too: a file every
    site has, so the sample builds in any repo. */
const icon = ICONS.appleTouch;
/** That file's width and height, in pixels. */
const ICON_SIZE = 180;
const iconPicture = { src: icon, alt: "Sam's icon", width: ICON_SIZE, height: ICON_SIZE };
/** Another file every site has, standing in for a moving picture's still. */
const stillIcon = ICONS.png;

/** A document on another site: the address the sample's link card has, and
    the address that shows the document in the viewer's frame. */
const notes = { href: "https://docs.example.com/d/notes/edit", inFrame: "https://docs.example.com/d/notes/preview" };

/** One language of the sample. Its wording is the same in each: only the
    label and the locale tell them apart. */
function sampleLanguage(label: string, locale: string): Language {
  // Every string says its own key, but for the ones set below.
  const everyKey = [...PAGE_STRINGS, ...SCRIPT_STRINGS];
  const strings = Object.fromEntries(everyKey.map((key) => [key, key]));
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
      intro: `Sam builds things. Here's [the icon](${icon}).`,
      hint: "Pick a tab.",
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
      { id: "about", title: "About", messages: [{ q: "who is sam?", a: ["Sam is **an engineer**.", ["One", "Two"]] }] },
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
              { image: { ...iconPicture, caption: "Sam's icon.", href: icon } },
              { image: { ...iconPicture, still: stillIcon, caption: "Sam's icon, as if it moved." } },
              { images: [iconPicture, { ...iconPicture, round: true }] },
              { quote: { text: "Sam got it done.", by: "A coworker" } },
              { heading: { label: "Project", title: "The icon" } },
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
      context: {
        title: "Links",
        rows: [{ label: "GitHub", meta: "example", icon: "github", href: "https://github.com/example" }],
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
      ],
      personal: [{ id: "fun", q: "for fun?", a: ["Reading."] }],
      ui: { else: "Else", elseLabel: "Else", send: "Send", back: "Back", step: "{n} of {total}", followUp: "More" },
    },
    notFound: { title: "Not found.", text: "Nothing here.", back: "Back" },
    strings: {
      ...strings,
      status: "Read {file}",
      viewerOpen: "Open in a new tab",
      viewerClose: "Close",
    } as Strings,
  };
}

const config: SiteConfig = {
  url: "https://example.com/portfolio/",
  host: "github-pages",
  name: "Sam Sample",
  timezone: "UTC",
  links: {
    email: "sam@example.com",
    github: "https://github.com/example",
    linkedin: "https://www.linkedin.com/in/example",
  },
  social: { image: icon, width: ICON_SIZE, height: ICON_SIZE },
  themeColor: "#191919",
  // Sam's notes open in the viewer, at the address that shows them in a frame.
  viewer: { [notes.href]: notes.inFrame },
  llms: { summary: "A sample.", about: "Sam is a sample." },
  languages: { en: sampleLanguage("EN", "en_US"), fr: sampleLanguage("FR", "fr_FR") },
};

export default config;
