# Claude-app portfolio template

A portfolio laid out like the Claude app: a sidebar of tabs, each a short
conversation about you.

![The sample site's home screen: a sidebar of tabs, a greeting, a box to type a question in, and a details panel](docs/screenshots/home.png)

Everything the site says is in one file, `site.config.ts`. Astro builds it
into static HTML and CSS that work with JavaScript off, plus one small
script for the chats, menus and question card. An optional Worker on
Cloudflare, Ask, answers typed questions by quoting your own answers.

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

With Ask on, a small model on Cloudflare Workers AI picks which of your
answers fits the question, and which one or two of its sentences answer it
most directly. The Worker (`src/worker`) replies by quoting those
sentences, so nothing the model writes reaches a visitor. No good fit, or
Ask over its limits, and the reply is "Something else". Llama Guard reads
every question; an inappropriate one blocks that visitor for a day.

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

**What is logged.** One line per question, under the Worker's
Observability tab: which answer was picked and what it cost in Neurons, or
why the question was turned away. Never the visitor's address. What was asked and what was quoted back
are logged only if you set `ASK_LOG_QUESTIONS` to `"true"`; if you do, say
so on your site.

To see how well it picks, put questions about you in
`tests/ask-questions.json`, raise `ASK_VISITOR_LIMIT` above their number,
and run `node tests/ask-eval.ts https://<your site>`. The ones that should
be blocked run last, and block your address for a day.

### What Ask can cost

Ask keeps count of what the day's questions cost. Each question makes two
model calls (the pick with GLM-4.7-Flash, and Llama Guard), each reports
the tokens it used, and the Worker prices them in Neurons. Past
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

Everything that protects a site made from the template, its visitors and
its bill, in one list. The numbers are the defaults, from `wrangler.jsonc`.
See `.github/SECURITY.md` to report a problem.

**The pages**

- **A strict Content-Security-Policy.** `default-src 'none'`, with only
  the site's own scripts, styles, images and fonts; nothing inline; the
  page may fetch only from the site itself, and only with Ask on; no
  `<base>`, no form posts, no framing.
- **Trusted Types, with no policy.** The script can't turn a string into
  markup: it builds elements, and shows a reply from `/ask` as text.
- **The other headers.** HTTPS only for two years (HSTS; subdomains and
  preloading if you ask for them with `hsts`); `nosniff`;
  `X-Frame-Options: DENY`; a referrer policy that gives another site the
  origin at most; a Permissions-Policy that turns off the camera,
  microphone, location, payments, USB and ad topics; and
  `Cross-Origin-Opener-Policy: same-origin`. All of them are in
  `src/shared/headers.ts`. A host that reads no `_headers` file gets the
  Content-Security-Policy and the referrer policy in `<meta>` tags, and
  the rest are yours to set there (see [Deploy](#deploy)).
- **Nothing from anyone else.** No analytics, no cookies, no third-party
  requests: the fonts and icons are the site's own files. Chats and
  layout are kept in `localStorage`, in the visitor's browser only. A
  link to another site opens with `noopener noreferrer`.
- **A config that's checked.** The build stops on a link that isn't a web,
  mailto, #tab or site address (so no `javascript:`), and on a value that
  doesn't look like what it's used as. The config's Markdown is bold,
  italic, code and links, never HTML.

**Ask's requests** (Ask is off as shipped: then there is no Worker, and
nothing below to protect)

- **Only a small JSON POST gets in.** Another method, another content
  type (which a page on another site can't send) or a body over 2,048
  bytes is refused before anything is spent on it, and a question is cut
  to 300 characters.
- **The model can't write to a visitor.** It may only name one of your
  answers, from a fixed list, and number its sentences. The Worker quotes
  those sentences: at most two, at most 280 characters, as text.
- **A pick has to cover the question.** One that doesn't name the tool,
  company or place the question names is dropped, so a near miss doesn't
  read as a "no".
- **Two checks on every question.** The picker flags a rude question, or
  one that tries to give it other orders, and Llama Guard reads each
  question too. Either blocks the visitor from Ask for 24 hours.
- **Visitors aren't identified.** A visitor is counted by a salted hash
  of their address (an IPv6 address by its /64). Set your own salt as a
  secret (`ASK_SALT`). The address is never stored or logged; what was
  asked is logged only if you turn `ASK_LOG_QUESTIONS` on; and an error
  is logged by its number or kind, never its message.

**Ask's cost**

- **A visitor's limits.** 10 questions a minute and 30 a day.
- **The site's limits.** 200 questions a day, and 9,000 Neurons a day,
  counted from the tokens each question's model calls used.
- **Small model calls.** The picker may write 256 tokens, and Llama Guard
  10.
- **It fails closed.** With the rate limiter, the Durable Object or a
  model missing or failing, no model is called, and the visitor gets the
  "Something else" reply.
- **A switch.** `ASK_ENABLED` set to `"false"` turns Ask off without a
  code change.
- **The plan.** On Workers Free, Cloudflare refuses what it would
  otherwise bill, and the pages are files that never run the Worker (see
  [What Ask can cost](#what-ask-can-cost)).
- **Rules at the edge**, which you set by hand in the Cloudflare
  dashboard: a rate limit on `/ask`, and a block on requests the site has
  no use for (see [Rules at the edge](#rules-at-the-edge)).

**The code**

- **Every change is checked.** `npm run verify` runs on each pull
  request: formatting, types, the build, the HTML, the unit tests, and
  the browser checks, which are served with the real security headers.
  The workflow's token can only read the repository.
- **Dependencies are kept current.** Dependabot opens a pull request each
  month for the npm packages and the GitHub Actions. None of the packages
  reaches the browser: only Astro's build of the site does.
- **Nothing built is committed.** Your host builds the site from source.

## Credits and licence

Design inspired by the Claude app. Not affiliated with Anthropic. The fonts
are Inter, Source Serif 4, Geist Mono, Noto Sans JP and Noto Serif JP,
under the SIL Open Font License (texts in `public/assets/fonts/`).

MIT licensed: see `LICENSE`.
