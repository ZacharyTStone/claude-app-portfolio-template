# What the site says

Everything a visitor reads is in `site.config.ts`. This guide is the map:
which part of that file is which part of the page, and what to touch to
add, change or remove a thing. The fields themselves are documented where
their types are, in `src/config/`, and an editor shows that text as you
hover over a field or complete one.

`npm run dev` shows the site as you edit. Both it and `npm run build`
type-check `site.config.ts` first and print the compiler's line for a
field that is missing or misspelt; the dev server checks again each time
you save, in its terminal. The file ends `satisfies SiteConfig`, which is
what gives it that check: keep it. The build then checks what a type
can't: it stops, and names the row, when something points at a thread, an
icon or a file that isn't there.

## Start with `me`

The starter config begins with an object called `me`: your name, email,
profiles, city and jobs. The rest of the file reads them from there, so
changing `name` and `first` renames the person in every tab. Sentences
are written out in full further down, so read them through after changing
a fact.

## Which part is which

| On the page | In the config | Its type is in |
| --- | --- | --- |
| The address, the host, your name, links and time zone | the top level | `src/config/site-config.ts` |
| The home screen: greeting, intro, questions to start with | `home` | `src/config/home.ts` |
| The sidebar's rows and groups | `sidebar` | `src/config/sidebar.ts` |
| The tabs, each a short conversation | `threads` | `src/config/language.ts` |
| The question card under every thread, and the personal answers | `questions` | `src/config/question-card.ts` |
| "Something else", the reply to a question the site can't answer | `asked` | `src/config/asked.ts` |
| The details panel on the right | `panel` | `src/config/language.ts` |
| The account menu and its clock | `account` | `src/config/language.ts` |
| The 404 page | `notFound` | `src/config/language.ts` |
| Buttons, tooltips and what the script says | `strings` | `src/config/strings.ts` |
| What an answer is made of | a message's `a` | `src/config/blocks.ts` |

Everything from `home` down belongs to one language: it is inside
`languages.en`, and again inside each other language
([Languages](languages.md)).

## Wording

English has defaults for every string (`src/config/english-strings.ts`),
so an English page's `strings` states only the ones it changes; the
starter config changes one, `askLimited`. A page in any other language
states every string itself, and the build names one that is missing.

The home screen's greeting is picked by the visitor's time of day:
`morning` from 5:00, `afternoon` from 12:00, `evening` from 18:00 and
`late` from 23:00. The page is built with `default`, which is what shows
without JavaScript. The account menu's clock says what you're likely
doing by your own time: `morning` from 5:00, `day` from 10:00, `evening`
from 18:00 and `late` from 23:00.

## Threads

A thread is one tab: an `id`, a `title` and `messages`, each a question
(`q`) and its answer (`a`). The `id` is the tab's address (`#about`), and
everything else names the thread by it.

To add a thread, add it to `threads`, then say where a visitor finds it:

- a row in `sidebar.nav` (an icon and a label), or in one of
  `sidebar.groups` (a title over a subtitle);
- if you like, a choice in `questions.topics`, a step in `panel.progress`,
  or a link in another answer: `[my talks](#talks)`.

A thread no row names is still at its address, but nothing leads to it.

To remove a thread, delete it and build: the build names every row,
prompt and link that still points at it.

## Answers

An answer is a list of blocks, shown top to bottom:

| Block | Written as |
| --- | --- |
| A paragraph | a string |
| A list | an array of strings, an item each |
| A file card | `{ card: { file, lines } }` |
| A link card | `{ link: { name, kind, href, icon } }` |
| Bars, two to six amounts on one scale | `{ bars: { title, rows } }` |
| A flow, two to five steps in order | `{ flow: { title, steps } }` |
| A picture, or pictures side by side | `{ image: { src, alt, width, height } }`, `{ images: [ … ] }` |
| A quote | `{ quote: { text, by } }` |
| A heading inside a long answer | `{ heading: { title } }` |

Text is a little Markdown and never HTML: `**bold**`, `*italic*`, code
between backticks, and `[a link](#about)`. A link goes to a thread
(`#about`), a web address, `mailto:` or a file on the site.

An answer has an id, which the home screen's `prompts` and Ask name it
by: `acme.2` is the second answer in the thread `acme`, and
`personal-coffee.1` the personal answer `coffee`. An answer added before
another renumbers the ones after it, so check `home.prompts` when you
insert one.

## Pictures, icons and files

A picture is a file in `public/assets/`, named in the config by its
address on the site: `src: "/assets/app.webp"`, with its `width` and
`height` in pixels and an `alt` that says what it shows. The social card
(`social.image`) is 1200×630; a screenshot of your home screen works. A
diagram that moves is a picture too: see [Diagrams](diagrams.md).

Sidebar rows, panel rows and link cards name an icon: `about`, `skills`,
`file`, `contact`, `work` or `globe`. Panel rows and link cards can also be
`github` or `linkedin`.

## The question card and personal answers

`questions.topics` are the choices under every thread. A topic opens a
thread (`tab`), or asks a second question (`ask`) and lists `choices`; four
or fewer fit on a phone. `questions.personal` are answers that aren't in a
thread: each gets a tab of its own, and the topic with `personal: true`
lists them. One marked `hidden` stays out of the card, but a home prompt
can name it and Ask can pick it.

A question a visitor types gets the `asked` reply, "Something else": how
to reach you, with their question in an email and a message to copy.
With [Ask](ask.md) on, it gets an answer first where the site has one.

In `asked.email` and `asked.message.text`, `{question}` is what the
visitor asked. On an English page with Ask on it is said to you ("Do
you…?" for "Does Alex…?"); otherwise it is the question as they typed it,
about you rather than to you, and for a visitor who has been blocked it is
empty. So give it a line of its own ("A question from your portfolio:",
then `{question}`) rather than a place in a sentence.

## The viewer

A link listed in `viewer` opens in a panel beside the conversation (the
whole screen on a phone), in a frame, instead of a new tab:

```ts
viewer: {
  "https://docs.google.com/document/d/YOUR-DOC-ID/edit": "https://docs.google.com/document/d/YOUR-DOC-ID/preview",
},
```

Each entry is a link's `href`, exactly as a link card, a picture or a row
of the details panel has it, then the address the frame shows. A Google
Doc, Sheet or Slides deck that anyone with the link can view is shown at
its address ending `/preview`. Not every site lets itself be shown in a
frame (GitHub and LinkedIn don't, and neither does a file on your own
site): open the viewer once and look.

The build refuses an address that isn't `https://` with a plain domain
name as its host, one on the site itself, and a link that nothing links
to. With JavaScript off, or clicked with a modifier key, the link opens as
any link does. Its two buttons are `viewerOpen` and `viewerClose` in
`strings`: English has them, and another language states its own.

A viewer is the one thing that makes a page of yours load anything from
another site: [Security](security.md) says what that changes. If your site
says it loads nothing from elsewhere, make that sentence true again.

## Colours and styles of your own

`src/styles/site.css` is yours and loads last, so what it says wins. A
colour is changed there by giving one of the variables in
`src/styles/tokens.css` another value. An update never replaces that file
([Updating](updating.md)).
