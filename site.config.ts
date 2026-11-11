/* site.config.ts: everything the site says. Replace the sample person,
   Alex Example, with yourself.

   `npm run dev` shows the site as you edit, and the build stops with a
   clear message if something here points at a thread that doesn't exist.
   Every field is documented in src/shared/config.ts (SiteConfig), so your
   editor completes and checks this file as you type; the blocks an answer
   can hold (cards, bars, flows, pictures, quotes…) are in
   src/shared/content.ts.

   - A thread's `id` is its address (#about). The sidebar, the panel, the
     question card and links in answers name threads by id.
   - Markdown is only **bold**, *italic*, `code` and [links](#thread or
     https://…).
   - Icons are about, skills, file, contact, work and globe; panel rows and
     link cards can also be github or linkedin.
   - To add a language, see examples/ja.ts. */
import type { SiteConfig } from "./src/shared/config.ts";

/* Facts that appear in many places, written once. Sentences are written
   out in full below, so read them through after changing a fact. */
const me = {
  name: "Alex Example",
  first: "Alex",
  email: "alex@example.com",
  github: "https://github.com/your-github",
  linkedin: "https://www.linkedin.com/in/your-linkedin/",
  place: "New York",
  role: "Software Engineer",
  resume: "https://example.com/resume.pdf",
  jobs: {
    acme: { company: "Acme", title: "Senior Software Engineer", years: "2024 – now" },
    globex: { company: "Globex", title: "Frontend Engineer", years: "2021 – 2024" },
  },
  project: { name: "Pocket Notes", site: "pocketnotes.example.com", href: "https://example.com" },
} as const;
const { acme, globex } = me.jobs;

/** The facts, for a language in another file (examples/ja.ts). */
export type Me = typeof me;

/** A name as a visitor types it in a question. */
const lower = (name: string) => name.toLowerCase();

export default {
  // ---- The site -----------------------------------------------------------
  // With a path if it's served under one: "https://you.github.io/portfolio/".
  url: "https://example.com",
  // Who serves the built site: "cloudflare", "netlify", "vercel",
  // "github-pages" or "static". README.md's "Deploy" has each one's steps.
  host: "cloudflare",
  name: me.name,
  nameLang: "en",
  // An IANA time zone, for the clock in the account menu.
  timezone: "America/New_York",
  links: { email: me.email, github: me.github, linkedin: me.linkedin },
  person: { worksFor: acme.company, country: "US" },
  // 1200×630; make your own from the sample in public/assets/og.png.
  social: { image: "/assets/og.png", width: 1200, height: 630 },
  themeColor: "#191919",
  // Ask (optional, Cloudflare only): typed questions get the answer here
  // that fits, quoted. Uncomment, and see "Ask" in README.md.
  // ask: { role: "a software engineer" },
  llms: {
    summary: `Portfolio of ${me.name}, a software engineer in ${me.place} who builds web apps with TypeScript, React and Node.js.`,
    about: `${me.name} is a senior software engineer at ${acme.company}, working on the web app its customers use every day. Before that, ${me.first} built sites and apps for clients at ${globex.company}, an agency, and on the side made ${me.project.name}, an offline-first notes app.`,
  },

  languages: {
    en: {
      label: "EN",
      name: "English",
      locale: "en_US",
      meta: {
        title: `${me.name} — ${me.role}`,
        description: `${me.role} · TypeScript · React · Node.js · ${me.place} · Remote`,
        imageAlt: `${me.name}, ${me.role}`,
        preload: ["/assets/fonts/inter.woff2", "/assets/fonts/source-serif-4.woff2"],
      },
      person: { name: me.name, jobTitle: me.role },

      // ---- The home screen ------------------------------------------------
      home: {
        greeting: {
          default: `Hello. Meet ${me.first}.`,
          morning: `Good morning. Meet ${me.first}.`,
          afternoon: `Good afternoon. Meet ${me.first}.`,
          evening: `Good evening. Meet ${me.first}.`,
          late: `Up late? Meet ${me.first}.`,
        },
        intro: `${me.name} is a software engineer in ${me.place} who builds web apps from the database to the button.`,
        hint: "Pick a tab on the left to learn more.",
        // Under the name at the top of a new chat, where a phone visit starts.
        tagline: `Software engineer in ${me.place}, working remotely`,
        // Questions to start with. Each gets the answer it names: "acme.2" is
        // the second answer in the thread "acme", "personal-coffee.1" the
        // personal answer "coffee".
        prompts: [
          { q: `What has ${me.first} built at ${acme.company}?`, answer: "acme.2" },
          { q: `How does ${me.project.name} work offline?`, answer: "notes.2" },
          { q: `How does ${me.first} take their coffee?`, answer: "personal-coffee.1" },
        ],
      },

      // ---- The sidebar ----------------------------------------------------
      sidebar: {
        newTab: "New tab",
        nav: [
          { tab: "about", icon: "about", label: "About" },
          { tab: "skills", icon: "skills", label: "Skills" },
          { tab: "resume", icon: "file", label: "Resume" },
          { tab: "contact", icon: "contact", label: "Contact" },
        ],
        groups: [
          {
            id: "work",
            label: "Work history",
            tabs: [
              { tab: "acme", title: acme.company, subtitle: `${acme.title} · ${acme.years}`, live: "Current role" },
              { tab: "globex", title: globex.company, subtitle: `${globex.title} · ${globex.years}` },
            ],
          },
          {
            id: "projects",
            label: "Projects",
            tabs: [{ tab: "notes", title: me.project.name, subtitle: "TypeScript · React · IndexedDB" }],
          },
        ],
      },

      // ---- The threads: one tab each, a question and its answer at a time --
      threads: [
        {
          id: "about",
          title: "About",
          messages: [
            {
              q: `who is ${lower(me.name)}?`,
              a: [
                `${me.first} is a **software engineer** who builds web apps from the database to the button, and likes working closely with the people who use them.`,
              ],
            },
            {
              q: `where’s ${lower(me.first)} based?`,
              a: [
                `In ${me.place}, working remotely with teams across time zones.`,
                {
                  card: {
                    file: "profile.yaml",
                    lines: [
                      ["based_in", me.place],
                      ["work_style", "Remote-first"],
                      ["languages", "English · Spanish"],
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          id: "acme",
          title: acme.company,
          pill: { label: "Current", live: true },
          messages: [
            {
              q: `what does ${lower(me.first)} do at ${lower(acme.company)}?`,
              // "Read experience/acme.md" above the answer, opening onto a card.
              read: {
                file: "experience/acme.md",
                card: {
                  file: "role.yaml",
                  lines: [
                    ["company", acme.company, "Developer tools · Remote"],
                    ["role", acme.title, acme.years],
                    ["focus", { accent: "the web app" }],
                  ],
                },
              },
              a: [`${me.first} joined ${acme.company} in 2024 and works on the web app its customers use every day.`],
            },
            {
              q: `what has ${lower(me.first)} built there?`,
              a: [
                [
                  "Rebuilt the main dashboard, which now loads in under a second.",
                  "Added self-serve billing, so customers change plans without contacting support.",
                  "Started the component library the whole team now uses.",
                ],
                {
                  bars: {
                    title: "Dashboard load time",
                    note: "3× faster",
                    rows: [
                      { label: "Before", value: "2.4 s", amount: 2400 },
                      { label: "After", value: "0.8 s", amount: 800, accent: true },
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          id: "globex",
          title: globex.company,
          messages: [
            {
              q: `what did ${lower(me.first)} do at ${lower(globex.company)}?`,
              read: {
                file: "experience/globex.md",
                card: {
                  file: "role.yaml",
                  lines: [
                    ["company", globex.company, "Agency · Remote"],
                    ["role", globex.title, globex.years],
                  ],
                },
              },
              a: [`At ${globex.company}, an agency, ${me.first} built sites and apps for clients.`],
            },
            {
              q: "what was the biggest project?",
              a: [
                `A booking app for a group of clinics, used by thousands of patients a week. ${me.first} led its frontend from the first prototype to launch.`,
                {
                  quote: {
                    text: "Our patients book in a minute now, not a phone call.",
                    by: "The clinics’ operations lead",
                  },
                },
              ],
            },
          ],
        },
        {
          id: "notes",
          title: me.project.name,
          pill: { label: "Side project" },
          messages: [
            {
              q: `what’s ${lower(me.project.name)}?`,
              a: [
                `A small notes app ${me.first} built to learn how offline-first web apps work.`,
                {
                  image: {
                    src: "/assets/pocket-notes.webp",
                    alt: "Pocket Notes: a list of notes on the left, and the open note on the right.",
                    width: 1280,
                    height: 800,
                    caption: `${me.project.name} in a browser.`,
                  },
                },
                { link: { name: me.project.site, kind: "Website", href: me.project.href, icon: "globe" } },
              ],
            },
            {
              q: "how does it work offline?",
              a: [
                "Every note is saved in the browser first, so typing never waits for the network. Changes queue up while offline and sync when the connection comes back.",
                {
                  flow: {
                    title: "Saving a note",
                    steps: [
                      { name: "Type", note: "saved as you go" },
                      { name: "IndexedDB", note: "in the browser" },
                      { name: "Sync queue", note: "waits for a connection" },
                      { name: "Server" },
                    ],
                  },
                },
                {
                  card: {
                    file: "stack.yaml",
                    lines: [
                      ["language", "TypeScript"],
                      ["frontend", "React"],
                      ["storage", "IndexedDB"],
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          id: "skills",
          title: "Skills",
          messages: [
            {
              q: `what’s ${lower(me.first)}’s stack?`,
              a: [
                `${me.first} works in TypeScript on the frontend and the backend, and is best at fast, accessible interfaces.`,
                {
                  card: {
                    file: "skills.yaml",
                    lines: [
                      ["languages", "TypeScript, JavaScript, HTML, CSS"],
                      ["frontend", ["React, Next.js, Tailwind CSS,", "Vite, Playwright"]],
                      ["backend", "Node.js, PostgreSQL, GraphQL"],
                      ["tooling", "GitHub Actions, Sentry, Figma"],
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          id: "resume",
          title: "Resume",
          messages: [
            {
              q: `can i see ${lower(me.first)}’s resume?`,
              a: ["Sure:", { link: { name: "Resume", kind: "Document · PDF", href: me.resume, icon: "file" } }],
            },
          ],
        },
        {
          id: "contact",
          title: "Contact",
          messages: [
            {
              q: `how do i get in touch with ${lower(me.first)}?`,
              a: [
                `Email is best: [${me.email}](mailto:${me.email})`,
                `${me.first} is also on [GitHub](${me.github}) and [LinkedIn](${me.linkedin}).`,
              ],
            },
          ],
        },
      ],

      // ---- The question card: under every thread, and in every new tab ------
      questions: {
        ask: `What would you like to know about ${me.first}?`,
        // Four or fewer topics fit on a phone; group the rest with `choices`.
        topics: [
          {
            label: "Their work",
            hint: `${acme.company}, ${globex.company} and a side project`,
            ask: "Which job or project?",
            choices: [{ tab: "acme" }, { tab: "globex" }, { tab: "notes" }],
          },
          {
            label: "About them",
            hint: "Their story, skills and resume",
            ask: "Where would you like to start?",
            choices: [
              { tab: "about", label: "Their story" },
              { tab: "skills", label: "Their skills" },
              { tab: "resume", label: "Their resume" },
            ],
          },
          {
            label: "Something personal",
            hint: "Where they’re from, what they do for fun",
            ask: "What would you like to know?",
            personal: true,
          },
          { label: "How to reach them", tab: "contact" },
        ],
        // Answers that aren't in a thread. Each gets a tab of its own.
        personal: [
          {
            id: "from",
            title: "Where they’re from",
            q: `where’s ${lower(me.first)} from?`,
            hint: "Their hometown, and home now",
            a: [`${me.first} grew up in Chicago and moved to ${me.place} in 2019.`],
          },
          {
            id: "fun",
            title: "For fun",
            q: `what does ${lower(me.first)} do for fun?`,
            hint: "Life outside work",
            a: [
              [
                "🏃 Runs a half marathon every spring.",
                "📷 Takes film photos of the city.",
                "🍜 Is always looking for the best ramen in town.",
              ],
            ],
          },
          {
            // Not listed in the card: a home prompt above names it, and Ask
            // can pick it.
            id: "coffee",
            title: "Coffee",
            q: `how does ${lower(me.first)} take their coffee?`,
            hidden: true,
            a: ["Black, from a pour-over, and never after 3 p.m."],
          },
        ],
        ui: {
          else: "Something else",
          elseLabel: "Something else: type your own question",
          send: "Ask",
          back: "Back",
          step: "{n} of {total}",
          followUp: "Ask a follow-up",
        },
      },

      // ---- "Something else": the reply to a question with no answer here ---
      // {question} is what the visitor typed, about you rather than to you
      // ("Does Alex…?"), so it gets a line of its own.
      asked: {
        title: "Something else",
        q: "i have a different question",
        answer: `That one’s best asked to ${me.first} directly. Email it, or send a message on LinkedIn.`,
        mail: "Email this question",
        subject: "A question from your portfolio",
        email: `Hi ${me.first},\n\nA question from your portfolio:\n\n{question}\n\nThanks,\n[Your name]`,
        linkedin: "Message on LinkedIn",
        message: {
          label: "A message for LinkedIn",
          text: `Hi ${me.first}, a question from your portfolio:\n\n{question}\n\nThanks!`,
          copy: "Copy the message",
        },
      },

      // ---- The details panel on the right ---------------------------------
      panel: {
        progress: {
          title: "Progress",
          steps: [
            { tab: "globex", title: globex.title, when: `${globex.company} · ${globex.years}` },
            { tab: "acme", title: acme.title, when: `${acme.company} · ${acme.years}`, now: true },
          ],
        },
        outputs: {
          title: "Outputs",
          rows: [
            { label: "Resume", meta: "PDF", icon: "file", href: me.resume },
            { label: me.project.site, meta: "Site", icon: "globe", href: me.project.href },
          ],
        },
        context: {
          title: "Context",
          rows: [
            { label: "GitHub", meta: "Link", icon: "github", href: me.github },
            { label: "LinkedIn", meta: "Link", icon: "linkedin", href: me.linkedin },
            { label: "Email", meta: "Link", icon: "contact", href: `mailto:${me.email}` },
            { label: `${me.place} · Remote`, meta: "Based in", icon: "globe" },
          ],
        },
      },

      // ---- The account menu, at the bottom of the sidebar -----------------
      account: {
        initial: me.first.charAt(0),
        name: me.first,
        sub: `· ${me.place} · Remote`,
        label: "Account",
        clock: {
          me: `${me.first}, in ${me.place}`,
          zone: `${me.place} (ET)`,
          you: "You",
          ahead: "{n}h ahead of you",
          behind: "{n}h behind you",
          same: "Same time as you",
          moods: {
            morning: "Coffee first.",
            day: "Probably deep in a pull request.",
            evening: "Probably reviewing someone’s pull request.",
            late: "Probably asleep.",
          },
        },
        language: "Language",
        upgrade: { label: `Upgrade to ${me.first} Pro`, hire: `Hire ${me.first}`, tab: "contact" },
        logout: {
          label: "Log out",
          title: "See you next time.",
          text: `Thanks for stopping by. Here’s where to find ${me.first}:`,
          back: "Log back in",
        },
      },

      notFound: {
        title: "Page not found.",
        text: "There’s nothing at this address.",
        back: "Back to the portfolio",
      },

      // ---- The interface's own words --------------------------------------
      strings: {
        skip: "Skip to content",
        tabs: "Tabs",
        hideTabs: "Hide tabs",
        closeTabs: "Close tabs",
        showTabs: "Show tabs",
        panelToggle: "Show or hide the details panel",
        panelToggleTitle: "Details",
        credit: "Design inspired by the Claude app. Not affiliated with Anthropic.",
        share: "Share",
        copyTab: "Copy link to this tab",
        copyTitle: "Copy link",
        question: "Question: ",
        followUpPlaceholder: "Ask a follow-up…",
        model: "Portfolio",
        status: "Read {file}",
        panel: "Details",
        closePanel: "Close the details panel",
        closePanelTitle: "Close",
        copied: "Copied",
        copyFailed: "Couldn’t copy",
        menuCopy: "Copy link",
        menuOptions: "Thread options",
        menuRename: "Rename",
        menuFollowUp: "Ask a follow-up",
        menuJump: "Jump to",
        menuMore: "More options",
        menuDelete: "Delete",
        thinking: "Thinking…",
        // One of these (split at |) shows while a reply is on its way.
        thinkingWords: "Thinking|Pondering|Mulling|Brewing|Tinkering|Puzzling|Wondering|Considering",
        chats: "Chats",
        chatDeleted: "Chat deleted",
        newChat: "New chat",
        moveSection: "Move {name}",
        resize: "Resize the tabs",
        // The rest show only with Ask on. Under a reply to a typed question:
        // where it's from.
        askFrom: "From the {tab} tab",
        askFromPersonal: "From “{tab}”",
        // What replaces a question found inappropriate.
        askRemoved: "Question removed",
        // Past a visitor's {limit} questions for the day, and the note under
        // replies when only {n} are left.
        askLimited: `That’s the limit for today. Asking runs on a free service, so it’s capped at {limit} questions a day. Everything about ${me.first} is in the tabs, and [Contact](#contact) has how to reach them.`,
        askLeft: "Heads up: asking runs on a free service, so it’s capped per day: {n} left today.",
      },
    },
  },
} satisfies SiteConfig;
