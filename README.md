# Claude-app portfolio template

A portfolio laid out like the Claude app: a sidebar of tabs, each a short
conversation about you.

![The sample site's home screen: a sidebar of tabs, a greeting, a box to type a question in, and a details panel](docs/screenshots/home.png)

Everything the site says is in one file, `site.config.ts`. Astro builds it
into static HTML and CSS that work with JavaScript off, plus one small
script for the chats, menus and question card. An answer can hold more
than text: file cards, bars, flows, pictures, quotes, and diagrams that
move. A link you choose, such as a resume in Google
Docs, can open in a viewer beside the conversation instead of a new tab.
An optional Worker on Cloudflare, Ask, answers typed questions from your
own answers, and quotes the lines it answered from.

## Quick start

1. Click **Use this template** on GitHub, and clone your copy.
2. Install and run it (Node 22.23.4 or later; `.node-version` has the
   exact one):

   ```sh
   npm ci
   npm run dev
   ```

   The site is at http://localhost:4321 and reloads as you edit.
3. Edit `site.config.ts`. Every field is documented in
   `src/shared/config.ts`, so your editor completes and checks it.
4. Before you commit, run everything CI runs:

   ```sh
   npx playwright install chromium   # once
   npm run verify
   ```

   It stops at the first failing step and names the command to rerun.
   Formatting is a step: `npm run format` fixes it.

Nothing built is committed. Your host runs `npm run build` and serves
`dist/`.

More: [a thread with a figure](docs/screenshots/figure.png),
[the question card](docs/screenshots/question-card.png),
["Something else"](docs/screenshots/something-else.png),
[on a phone](docs/screenshots/phone.png),
[in Japanese](docs/screenshots/japanese.png).

## Make it yours

A copy starts as the sample person, Alex Example. Replace:

- [ ] `site.config.ts`: your facts, threads, answers and links. Delete
      what you don't use; `npm run dev` shows the result and the build
      names anything that points nowhere.
- [ ] `url` and `host` in `site.config.ts` (see [Deploy](#deploy)).
- [ ] `public/assets/og.png`, the picture link previews show (1200×630). A
      screenshot of your home screen works.
- [ ] `public/assets/pocket-notes.webp`, the sample's picture: delete it,
      or replace it with one of yours.
- [ ] The favicons, if you want your own: `public/assets/favicon.svg`,
      `favicon-32.png` and `apple-touch-icon.png`.
- [ ] `"name"` in `wrangler.jsonc`, your Worker's name on Cloudflare.
- [ ] `tests/ask-questions.json`, questions about you for the Ask eval
      (only if you use Ask).
- [ ] This README, and `.github/` (CONTRIBUTING, SECURITY, the issue and
      pull request templates), which are about the template.
- [ ] `LICENSE`: add your name to the copyright line if you like; keep the
      original notice.

## Deploy

Any host that can run `npm run build` and publish `dist/` works. The
`host` field in `site.config.ts` tells the build how the security headers
(`src/shared/headers.ts`) reach the browser: Cloudflare and Netlify read a
`_headers` file the build writes; on any other host, each page carries its
Content-Security-Policy and referrer policy in `<meta>` tags. If the site
is served under a path (a GitHub project site), put the path in `url`:
`"https://you.github.io/portfolio/"`. Every link then starts with it.

### Cloudflare (recommended)

The free plan covers it, `wrangler.jsonc` is the whole setup, and it is
the only host that runs Ask. Use an account on the free plan: there
Cloudflare refuses what it would otherwise bill, so the site can never
cost anything (see [What Ask can cost](#what-ask-can-cost)). Set
`host: "cloudflare"`, then either connect the repo in the Cloudflare
dashboard (**Workers & Pages → Create → Import a repository**; it deploys
on every push to `main`), or deploy from your machine:

```sh
npx wrangler deploy   # runs npm run build, then uploads dist/
```

`npx wrangler dev` serves it locally as Cloudflare would.

### Netlify, Vercel, or any static host

| Host | `host` | Settings |
| --- | --- | --- |
| Netlify | `"netlify"` | Build command `npm run build`, publish directory `dist`. Node comes from `.node-version`. |
| Vercel | `"vercel"` | Detected as Astro: build `npm run build`, output `dist`. Set Node 22 or later in the project's settings. |
| Anything else (S3, nginx, Caddy…) | `"static"` | Run `npm run build` and upload `dist/`. Set the headers in `src/shared/headers.ts` on the server where you can. |

### GitHub Pages

`host: "github-pages"`, and `url` with the repo's path unless you use a
custom domain. In the repo's **Settings → Pages**, set the source to
**GitHub Actions**, and add `.github/workflows/pages.yml`:

```yaml
name: Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

## Ask (optional)

With Ask off, as shipped, a question typed into the site gets the
"Something else" reply: how to reach you, with the question in an email
and a LinkedIn message to copy. Everything else works the same on any
host.

With Ask on, a small model on Cloudflare Workers AI reads every answer on
your site, notes what the visitor wants to know, then picks the answer
that says it and the one or two lines in it that answer most directly (a
sentence, an item of a list, a row of a card). From those lines it
answers the question as it was asked, in its own words, in a sentence or
two: "Does Alex know React?" gets "Yes, Alex knows React.", not the row of
the card React is in.

The Worker (`src/worker`) checks the names, numbers and addresses in that
reply before anyone sees it (`src/worker/ask/grounded.ts`). Each has to be
in the lines it was written from, their tab's name, your site's own
question or your name, and never only in what the visitor typed. A reply
that fails is asked for once more, then thrown away: the lines are quoted
as they are if they're sentences, and otherwise the page shows the whole
answer.

The reply's ordinary words are not checked, and neither is what the check
can't tell from one: a name that only starts a sentence, a name in kana or
kanji, a number in kanji. Keeping to what the lines say is only the
model's instruction (`src/worker/ask/write.ts`), so a reply can still put
something wrongly: "No" where the lines mean yes. That is why the page
quotes the lines a reply was written from under it, then links to the tab
they're in: what your site itself says is beside what the model made of
it. No good fit, or Ask over its limits, and the reply is "Something
else". Llama Guard reads every question; an inappropriate one blocks that
visitor for a day.

The check reads English and Japanese. On a page in another language no
reply is written, and the lines are quoted.

Ask finds what your site says, so write answers it can use: full
sentences that make sense on their own ("Alex joined Acme in 2024", not
"Joined in 2024"), and the facts people ask about (dates, titles, tools)
stated somewhere in words.

To turn it on (first check which plan your Cloudflare account is on:
[What Ask can cost](#what-ask-can-cost)):

1. In `site.config.ts`, uncomment `ask: { role: "a software engineer" }`
   and put who you are in a few words. It needs `host: "cloudflare"`.
2. In `wrangler.jsonc`, uncomment the Ask block and the two lines marked
   "Ask" in `"assets"`.
3. Set a salt for hashing visitors' addresses: `npx wrangler secret put
   ASK_SALT`. Without it, a salt anyone can read in the code is used.
4. Deploy. Workers AI, the rate limit and the Durable Object are set up
   from `wrangler.jsonc`.

To pause it without a code change, set `ASK_ENABLED` to `"false"` in
`wrangler.jsonc` and deploy.

One line is logged per question, under the Worker's Observability tab:
which answer was picked and what it cost in Neurons, or why the question
was turned away. The visitor's address is never logged. What was asked,
what the model made of it and what was sent back are logged only if you
set `ASK_LOG_QUESTIONS` to `"true"`; if you do, say so on your site. With
it on, the `thought` in a line tells you why Ask answered as it did.

To see how well it picks, put questions about you in
`tests/ask-questions.json`, raise `ASK_VISITOR_LIMIT` above their number,
and run `node tests/ask-eval.ts https://<your site>`. It prints each reply
the model wrote with the lines it was written from, to read one against
the other. The ones that should be blocked run last, and block your
address for a day.

### What Ask can cost

Ask keeps count of what the day's questions cost. Each question makes two
model calls (the pick with GLM-4.7-Flash, and Llama Guard) and, when
there's a reply to write, one or two more. Each reports the tokens it
used, and the Worker prices them in Neurons. Past
`ASK_DAILY_NEURONS` (9,000, inside Workers AI's free 10,000 a day) no more
are asked until midnight UTC. What one question costs depends on how much
your site says, since the model reads every answer: each log line has it,
as `neurons`. The site also takes at most 200 questions a day
(`ASK_DAILY_LIMIT`), and one visitor 10 a minute and 30 a day. All of
these are in `wrangler.jsonc`.

Those limits are the Worker's own. What happens to whatever they don't
cover depends on the Cloudflare plan your account is on:

- **Workers Free (recommended): nothing can be charged.** Past a limit,
  Cloudflare refuses instead of billing: 100,000 Worker requests a day,
  10,000 Neurons a day, and the Durable Object's free limits. A refused
  question gets the "Something else" reply, and the pages keep loading,
  because requests for files are free, unlimited and never run the Worker.
- **Workers Paid: the same flood is billed, and no account setting caps
  it.** Workers AI costs $0.011 per 1,000 Neurons past 10,000 a day,
  counted across the whole account: Ask stops at its own budget, but
  shares that allowance with everything else in the account. Worker
  requests (every `/ask`, and every address that isn't a file) cost $0.30
  per million past 10 million a month, and Durable Object requests past
  the plan's are billed too. Cloudflare's budget alerts only send an
  email, a day later.

If your account is on Workers Paid, make a charge impossible in one of two
ways:

1. **Give the site a free account of its own.** In the Cloudflare
   dashboard, **Accounts → Create Account** adds a Free account under the
   same login (up to five, once your login is a week old). Switch to it
   before you connect the repo, or deploy to it from your machine:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=<the new account's id> npx wrangler deploy
   ```

2. **Or leave Ask off.** Then there is no Worker at all, every request is
   for a file, and those are free on every plan.

If you run Ask in a paid account anyway, keep `ASK_DAILY_NEURONS` at 9,000
or less and set a $1 budget alert (**Manage Account → Billing → Billable
Usage**), so that you at least hear about it.

### Rules at the edge

Ask's limits are checked by the Worker, so a request it turns away has
still run it, and so has every address that isn't a file. On Workers Free
those use up the 100,000 requests a day, after which Ask and the 404 page
stop until midnight UTC (your pages keep loading); on Workers Paid they
are billed. Two rules on your domain's zone turn the commonest of that
traffic away before the Worker runs. Both are free, and both are set in
the Cloudflare dashboard, under **Security → Security rules**.

1. **A rate limiting rule** (the Free plan has one), for a flood of
   questions from one address:

   - When incoming requests match: `(http.request.uri.path eq "/ask")`
   - With the same characteristics: IP
   - When rate exceeds: 5 requests per 10 seconds
   - Then take action: Block, for 10 seconds

2. **A custom rule**, action Block, for requests the site has no use for:
   anything but a `POST` to `/ask`, anything but `GET` or `HEAD` to the
   rest, and the paths scanners try.

   ```txt
   (http.request.uri.path eq "/ask" and http.request.method ne "POST")
   or (http.request.uri.path ne "/ask" and not (http.request.method in {"GET" "HEAD"}))
   or (http.request.uri.path contains ".php")
   or (http.request.uri.path contains "/wp-")
   or (http.request.uri.path contains "/.env")
   or (http.request.uri.path contains "/.git")
   or (http.request.uri.path contains "/cgi-bin/")
   ```

A site served under a path has that path before `/ask` in both rules.
**Security → Events** shows what each rule has matched.

## Pictures that move, and the viewer

`AGENTS.md` has each step by step ("Adding a picture that moves", "Opening
a link in the viewer").

**A picture that moves.** A diagram is drawn by a short TypeScript file in
`diagrams/`, with the kit in `scripts/diagram.ts`: boxes, labels, lines,
and things that move along them. The sample's is "Saving a note", in the
Pocket Notes tab: lines are typed into a note, each is saved in the
browser at once, the changes wait in a queue while there's no connection,
and go to the server when it comes back. Its file,
`diagrams/saving-a-note.ts`, is written to be copied:

```sh
npm run diagrams                  # writes every diagram's files into public/assets
npm run diagrams saving-a-note    # or one
```

```ts
// site.config.ts, in an answer
image: {
  src: "/assets/saving-a-note.svg",
  still: "/assets/saving-a-note-still.svg",
  alt: "A diagram. Lines are typed into a note, and each is saved at once…",
  width: 1600,
  height: 540,
},
```

The motion is the picture's own (SVG animation), so it moves in a plain
`<img>`: the page runs no script for it, the security policy allows
nothing new, and it moves with JavaScript off. Every diagram is written
twice, moving and still, and a visitor who has asked their computer for
less motion is shown the still one. Commit the files with the diagram:
`npm test` fails while they aren't what it draws. A picture is an
illustration: Ask and `llms.txt` read its caption, so a fact belongs in
the answer's text too.

For steps in order with nothing to watch, a `flow` draws two to five boxes
with an arrow from each to the next (the sample's is in the Globex tab).

**The viewer.** A link listed in `viewer` opens in a panel beside the
conversation (the whole screen on a phone), in a frame, instead of a new
tab:

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
site): open the viewer once and look. The build refuses an address that
isn't `https://`, and a link that nothing links to. With JavaScript off,
or clicked with a modifier key, the link opens as any link does. Each
language needs `viewerOpen` and `viewerClose` in its `strings`.

The sample has no viewer, because it links to nothing that can be shown in
a frame; `site.config.ts` has one commented out. Setting one is the only
thing that makes a page of yours load anything from another site: see
[Protections](#protections).

## Languages and fonts

The first language in `languages` is the site's main one, at `/`. Each
other one is at `/<code>/` with a switch in the sidebar, and has the same
threads, answers and home prompts. `examples/ja.ts` is the sample in
Japanese. To add it:

1. In `site.config.ts`, add `import japanese from "./examples/ja.ts";` and,
   in `languages` after `en`, `ja: japanese(me),`.
2. Cut the Japanese fonts down to the characters the page uses (needs
   Python: `pip install fonttools brotli`):

   ```sh
   npm run build
   npm run fonts
   npm run verify
   ```

   Run `npm run build` and `npm run fonts` again after changing Japanese
   text; CI fails if the page uses a character the fonts lack.

The bundled Latin fonts (Inter, Source Serif 4, Geist Mono) cover Western
European letters only. Other letters (ł, ş, Greek, Cyrillic, Arabic…) show
in the visitor's system font, which works but looks different. To ship a
font for them, put its `.woff2` in `public/assets/` and an `@font-face`
for it in `src/styles/site.css`. That stylesheet is yours and loads last,
so it is also where a colour from `src/styles/tokens.css` is changed. A
right-to-left language sets `dir: "rtl"`.

## Taking the template's updates

```sh
npm run update-template
npm ci
npm run verify
git diff   # review, then commit
```

It replaces the shared files (`SHARED` in `scripts/template.ts`: the code,
tests, styles, icons and tooling) with the template's latest, and leaves
yours alone: `site.config.ts`, `README.md`, `wrangler.jsonc`,
`src/styles/site.css`, your pictures and Japanese font subsets. It needs a
clean working tree. A file you add inside a shared folder (`src/`,
`public/assets/fonts/`, `public/assets/icons/`) is removed by an update,
so keep your own files outside them.

A copy made before this command existed: copy `scripts/template.ts` and
`scripts/update-template.ts` from the template, add
`"update-template": "node scripts/update-template.ts"` to `package.json`'s
scripts, and run it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | The site at localhost:4321, rebuilt as you edit |
| `npm run build` | Checks `site.config.ts`, then builds the site into `dist/` |
| `npm run preview` | Serves `dist/` as built |
| `npm run verify` | Everything CI checks, in order: format, types, build, HTML, unit tests, fonts, browser |
| `npm run format` | Formats the code with Prettier (`npm run lint` checks) |
| `npm run fonts` | Cuts the Japanese fonts to the characters used (`fonts:check` checks) |
| `npm run update-template` | Takes the template's latest shared code |

`AGENTS.md` has each check, the layout of the code and its rules, for
people and coding agents alike.

## Why Astro

Hand-written HTML and CSS with no build step would be a little quicker to
build and simpler to host, but hard to review and edit: the same markup
again for every tab, in every language. Astro components read like the
HTML they become, and what reaches the browser is still only plain HTML,
CSS and the site's one script, with no framework code.

## Protections

What protects a site made from the template, its visitors and its bill.
The numbers are the defaults, from `wrangler.jsonc`. See
`.github/SECURITY.md` to report a problem.

**The pages**

- The Content-Security-Policy is `default-src 'none'`, with only the site's
  own scripts, styles, images and fonts. Nothing inline runs, the page may
  fetch only from the site itself, and only with Ask on, and there is no
  `<base>` and no form post. No other site can show the pages in a frame,
  and the pages show none themselves, unless you set `viewer`: then
  `frame-src` names the sites the viewer shows, and no other.
- Trusted Types is required with no policy, so the script can't turn a
  string into markup. It builds elements, and shows a reply from `/ask` as
  text.
- The other headers are in `src/shared/headers.ts`: HTTPS only for two years
  (HSTS; subdomains and preloading if you ask for them with `hsts`);
  `nosniff`; `X-Frame-Options: DENY`; a referrer policy that gives another
  site the origin at most; a Permissions-Policy that turns off the camera,
  microphone, location, payments, USB and ad topics; and
  `Cross-Origin-Opener-Policy: same-origin`. A host that reads no `_headers`
  file gets the Content-Security-Policy and the referrer policy in `<meta>`
  tags, and the rest are yours to set there (see [Deploy](#deploy)).
- The site has no analytics and no cookies, and loads nothing from another
  site by itself: the fonts and icons are its own files. The one exception
  is the viewer, and only on a site that sets `viewer` (the sample
  doesn't): when a visitor opens a link in it, that page loads from its
  own site, in a frame, and that site sees the visitor as any site they
  open does. The policy allows frames from the sites `viewer` names and no
  other; the frame is sandboxed so it can't navigate the page, is sent no
  referrer, and is thrown away when the viewer closes. Chats and layout
  are kept in `localStorage`, in the visitor's browser only. A link to
  another site opens with `noopener noreferrer`.
- The build checks the config. It stops on a link that isn't a web, mailto,
  #tab or site address (so no `javascript:`), and on a value that doesn't
  look like what it's used as. The config's Markdown is bold, italic, code
  and links, never HTML.

**Ask's requests** (Ask is off as shipped: then there is no Worker, and
nothing below to protect)

- Ask takes only a small JSON POST. Another method, another content type
  (which a page on another site can't send) or a body over 2,048 bytes is
  refused before anything is spent on it, and a question is cut to 300
  characters.
- A reply is the model's own sentence or two, held to your site in two
  ways. It names one of your answers, from a fixed list, and numbers at
  most two of its lines, then answers from them. The Worker checks the
  names, numbers and addresses in the reply against those lines, their
  tab's name, your site's own question and your name (never against what
  the visitor typed), and it's shown as text, 240 characters at most. One
  that fails twice isn't shown: the lines are quoted instead, or the whole
  answer. And the page quotes the lines a reply was written from under it
  (lines of more than 800 characters together are too long to quote: the
  reply then has only the link to their tab). The reply's ordinary words
  are not checked, so it can still put something wrongly ("No" where the
  lines mean yes): the quoted lines are what a visitor has to go by, and
  they are your site's own. What the model makes of the question goes to
  the log, if you log questions, and nowhere else. The check reads English
  and Japanese; a page in another language is quoted.
- A pick has to cover the question. One that doesn't name the tool, company
  or place the question names is dropped, so a near miss doesn't read as a
  "no".
- Two models check every question. The picker flags a rude question, or one
  that tries to give it other orders, and Llama Guard reads each question
  too. Either blocks the visitor from Ask for 24 hours.
- Visitors aren't identified. A visitor is counted by a salted hash of their
  address (an IPv6 address by its /64). Set your own salt as a secret
  (`ASK_SALT`). The address is never stored or logged; what was asked is
  logged only if you turn `ASK_LOG_QUESTIONS` on; and an error is logged by
  its number or kind, never its message.

**Ask's cost**

- A visitor may ask 10 questions a minute and 30 a day.
- The site may answer 200 questions a day and spend 9,000 Neurons a day,
  counted from the tokens each question's model calls used.
- The model calls are kept small: the picker may write 512 tokens, the
  reply's writer 320 a try, two tries at most, and Llama Guard 10.
- Ask fails closed. With the rate limiter, the Durable Object or a model
  missing or failing, no model is called, and the visitor gets the
  "Something else" reply.
- `ASK_ENABLED` set to `"false"` turns Ask off without a code change.
- On Workers Free, Cloudflare refuses what it would otherwise bill, and the
  pages are files that never run the Worker (see [What Ask can
  cost](#what-ask-can-cost)).
- Two rules are yours to set by hand in the Cloudflare dashboard: a rate
  limit on `/ask`, and a block on requests the site has no use for (see
  [Rules at the edge](#rules-at-the-edge)).

**The code**

- `npm run verify` runs on each pull request: formatting, types, the build,
  the HTML, the unit tests, and the browser checks, which are served with
  the real security headers. The workflow's token can only read the
  repository.
- Dependabot opens a pull request each month for the npm packages and the
  GitHub Actions. None of the packages reaches the browser: only Astro's
  build of the site does.
- Nothing built is committed. Your host builds the site from source.

## Credits and licence

Design inspired by the Claude app. Not affiliated with Anthropic. The fonts
are Inter, Source Serif 4, Geist Mono, Noto Sans JP and Noto Serif JP,
under the SIL Open Font License (texts in `public/assets/fonts/`).

MIT licensed: see `LICENSE`.
