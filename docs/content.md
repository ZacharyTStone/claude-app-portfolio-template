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

| On the page                                                                                                                         | In the config   | Its type is in                |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------- |
| The address, the host, your name, links and time zone                                                                               | the top level   | `src/config/site-config.ts`   |
| The home screen: greeting, intro, questions to start with                                                                           | `home`          | `src/config/home.ts`          |
| The sidebar's rows and groups                                                                                                       | `sidebar`       | `src/config/sidebar.ts`       |
| The tabs, each a short conversation                                                                                                 | `threads`       | `src/config/language.ts`      |
| The question card under every thread, and the personal answers                                                                      | `questions`     | `src/config/question-card.ts` |
| "Something else", the reply to a question the site can't answer                                                                     | `asked`         | `src/config/asked.ts`         |
| The details panel on the right                                                                                                      | `panel`         | `src/config/language.ts`      |
| The account menu and its clock                                                                                                      | `account`       | `src/config/language.ts`      |
| The 404 page                                                                                                                        | `notFound`      | `src/config/language.ts`      |
| Buttons, tooltips and what the script says                                                                                          | `strings`       | `src/config/strings.ts`       |
| What an answer is made of                                                                                                           | a message's `a` | `src/config/blocks.ts`        |
| The Writing tab: your posts on Qiita, Zenn, DEV, note, Medium, Substack, Hatena Blog or any blog's feed, fetched as the site builds | `writing`       | `src/config/writing.ts`       |
| Your recent public repos on GitHub, GitLab or Codeberg, in the panel, fetched as the site builds                                    | `activity`      | `src/config/activity.ts`      |

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
without JavaScript. Under the box to type in, `prompts` are at most three
questions to start with, each a line long: the build stops at a fourth.
The account menu's clock says what you're likely doing by your own time:
`morning` from 5:00, `day` from 10:00, `evening` from 18:00 and `late`
from 23:00.

## Threads

A thread is one tab: an `id`, a `title` and `messages`, each a question
(`q`) and its answer (`a`). Everything else names the thread by its `id`,
and the `id` is its page's address: each tab has a page of its own,
`/about/` (and `/ja/about/` in another language), which is the whole site
with that tab open. A link to it previews as that tab: its title is the
tab's (`About · Your Name`), and its description the start of its first
answer, or the page's own `meta.description` when that answer is all
cards and figures. The home screen stays at `/`.

Moving between tabs, the script stays on the page and changes the address
as it goes, so Back and Forward step through the tabs; without JavaScript
each row is a link to its tab's page. An address from before tabs had
pages, `/#about`, still opens the tab (with JavaScript the address becomes
`/about/`). A visitor's own chats are kept in their browser, so a chat's
address stays a `#` on the home page.

An `id` is lowercase letters, digits and dashes. It can't be a path the
site has at its root already, and the build says so: a language's code
(`ja`), `assets`, `ask`, `blog` (kept for a blog), or the name of a
folder or a page in `public/` (a `cv.html` there takes `cv`, and a
`cv.pdf` doesn't).

To add a thread, add it to `threads`, then say where a visitor finds it:

- a row in `sidebar.nav` (an icon and a label), or in one of
  `sidebar.groups` (a title over a subtitle);
- if you like, a choice in `questions.topics`, a step in `panel.progress`,
  or a link in another answer: `[my talks](#talks)`.

A thread no row names still has its page, but nothing leads to it.

A [contact form](contact-form.md), an email box, a message box and Send,
can go under a thread's last answer: `contactForm` names the thread.

To remove a thread, delete it and build: the build names every row,
prompt and link that still points at it.

## Answers

An answer is a list of blocks, shown top to bottom:

| Block                                 | Written as                                                       |
| ------------------------------------- | ---------------------------------------------------------------- |
| A paragraph                           | a string                                                         |
| A list                                | an array of strings, an item each                                |
| A file card                           | `{ card: { file, lines } }`                                      |
| A link card                           | `{ link: { name, kind, href, icon } }`                           |
| Bars, two to six amounts on one scale | `{ bars: { title, rows } }`                                      |
| A flow, two to five steps in order    | `{ flow: { title, steps } }`                                     |
| A picture, or pictures side by side   | `{ image: { src, alt, width, height } }`, `{ images: [ … ] }`    |
| A quote                               | `{ quote: { text, by } }`                                        |
| A heading inside a long answer        | `{ heading: { title } }`                                         |
| A part of your GitHub history         | `{ github: "stats" }`, `"calendar"`, `"languages"` or `"rhythm"` |

Text is a little Markdown and never HTML: `**bold**`, `*italic*`, code
between backticks, and `[a link](#about)`. A link goes to a thread
(`#about`, which the page makes a link to that tab's page in its own
language), the home screen (`#top`), a web address, `mailto:` or a file on
the site.

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
thread: each gets a tab of its own, with a page of its own as a thread's
has (`/personal-coffee/` for the `id` `coffee`), and the topic with
`personal: true` lists them. One marked `hidden` stays out of the card,
but a home prompt can name it, Ask can pick it, and its page is there.

A question a visitor types gets the `asked` reply, "Something else": how
to reach you, with their question in an email and a message to copy.
With [Ask](ask.md) on, it gets an answer first where the site has one,
and with the [contact form](contact-form.md#a-question-ask-cant-answer)
too, the reply's first link takes the question to the form.

In `asked.email` and `asked.message.text`, `{question}` is what the
visitor asked. On an English page with Ask on it is said to you ("Do
you…?" for "Does Alex…?"); otherwise it is the question as they typed it,
about you rather than to you, and for a visitor who has been blocked it is
empty. So give it a line of its own ("A question from your portfolio:",
then `{question}`) rather than a place in a sentence.

## The Writing tab

`writing: { qiita: "your-qiita-id" }` adds a tab that lists your posts on
Qiita, newest first, each a link card to the post. It can list Zenn, DEV,
note, Medium, Substack, Hatena Blog and any blog's RSS or Atom feed too,
together (`writing: { zenn: "…", note: "…" }`). The build fetches them,
so the tab is as it was at the last build, and it comes with your first
post, with a feed of its own at `/writing/feed.xml`. Its row comes last of
the sidebar's top rows unless you give it one of your own. Its id is
`writing`, which no thread of yours can then have. With `viewer: true`, a
Qiita post opens in the viewer, as a page of the site's own.
[Writing](writing.md) has the rest: each place and what it wants, the
wording a language needs, a post in the viewer, the tab before your first
post, what happens when a place is down, and a rebuild each day that
brings new posts in.

## Activity

`activity: { github: "your-github-name" }` ends the details panel with
"Recent public repos": the public repos you pushed to most recently, each
a row that links to it, with the day. `gitlab` and `codeberg` beside it,
or in its place, read gitlab.com and codeberg.org too, and the rows are
then of all of them, each saying where it is. The build fetches them, so
the panel is as it was at the last build, and it reads only public
activity, and says so. [Activity](activity.md) has the rest: what it
shows and leaves out, a token for GitHub, and what happens when a place
is down.

## Your GitHub history

`githubHistory: { user: "your-github-name" }` has the build fetch your
whole history of contributions on GitHub, which an answer then shows in
parts, each a block you place where it fits: `{ github: "stats" }` (what
it comes to, the longest streak, the busiest day), `"calendar"` (every
week, a row a year, with moments you mark on it), `"languages"` and
`"rhythm"` (the days of the week you work on). It needs a token for
GitHub, and says how much of the count is private work.
[GitHub history](github-history.md) has the rest: each part, what it
leaves out, the token, and what happens when GitHub is down.

## A globe on the home screen

A globe behind the home screen's text, its top showing under the
questions to start with, turns to your city when the home screen first
shows, as a line draws to it from where you're from:

```ts
globe: {
  here: { latitude: 40.71, longitude: -74.01 }, // your city: New York
  from: { latitude: 41.88, longitude: -87.63 }, // where you're from: Chicago
},
```

Your city alone is enough: `globe: { here: { latitude: 40.71, longitude:
-74.01 } }` turns the globe to it and marks it with a pulsing dot. `from`
adds the line, and each language's `home.place` ("New York",
"ニューヨーク") puts the city's name beside the dot, with the time there
(the site's `timezone`). A map app shows a place's latitude and longitude
when you press and hold it, latitude first; south and west are below 0.

Day and night on it are the sun's as the visitor opens the page, with a
town's lights here and there on the night side. Its colours are the
`--globe-day`, `--globe-night` and `--globe-light` of `.globe`, and the
page's `--accent`: a site can set them in `site.css`. Only the script draws
it, so it isn't there without JavaScript; a visitor who asks for less
motion sees it already turned, and a screen too short to show it under
the text leaves it out. Its land is a script of its own (about 12 KB),
which loads only when the home screen first shows.

## The panel's Context

The details panel's `context` is your own rows: where else to find you.
With `fromAnswers: true` it also lists, above them, the links the open
tab's answers use, as the Claude app lists a conversation's sources:

```ts
context: { title: "Context", fromAnswers: true, rows: [ … ] },
```

- On a tab, it's what that tab's questions and answers link to: link
  cards, links in the text, pictures with an `href`. Each address once, in
  the order the tab first links to it.
- In a chat, it's the lists of the tabs its answers are from, one after
  another in the order the chat comes to them, each address once, with
  the rows as each tab's list has them. A chosen thread is its tab, and a
  question answered with one of your answers (as it is, or as Ask's reply)
  is that answer's tab. It grows as each reply comes in, and a chat saved
  in the browser lists its own again when it comes back.
- The home screen, "Something else", and a chat with nothing yet from a
  tab that links anywhere, list your own rows alone.
- Only what a visitor can open is listed: a web address, or a file on the
  site (`/assets/resume.pdf`). A link to one of the site's own pages
  (`#about`, `/about/`), `mailto:` and the Writing tab's posts are left
  out.
- A row is called by the name of a link card to it, wherever the card
  is, or else by the first link's words, with the host on its right. A
  picture's caption says what the picture shows, not where it goes, so a
  link with no words is called by its address, short
  (`github.com/you/app`). Its icon is its link card's, or else `github` or
  `linkedin` by the host, `file` for a file on the site, and `globe` for
  any other.
- A link one of your own rows has stays that row, so your own rows come
  last and stay put. A row without an `href` stays where you put it. A
  link the viewer lists opens there from the panel too.
- Each tab's page is built with its own list showing, and the home page
  with none, so it's right without JavaScript (where there are no chats);
  with it, the panel shows each tab's as you move between them. Every page
  carries every tab's list, a few hundred bytes for each link, and a
  chat's is made from those.
- llms.txt's Links section lists every link on the site too, the same
  way, after your Outputs.

Without `fromAnswers`, Context is your rows alone, as it always was.
"Log out" shows only your own rows' links, either way.

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
site): open the viewer once and look. Qiita doesn't either, so for your
posts there the viewer shows a page of the site's own instead: that's
`viewer: true` in `writing`, not an entry here
([Reading a post on the site](writing.md#reading-a-post-on-the-site)).

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
