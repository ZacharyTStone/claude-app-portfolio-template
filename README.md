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

The free tier covers it, `wrangler.jsonc` is the whole setup, and it is
the only host that runs Ask. Set `host: "cloudflare"`, then either connect
the repo in the Cloudflare dashboard (**Workers & Pages → Create → Import
a repository**; it deploys on every push to `main`), or deploy from your
machine:

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

To turn it on:

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

**Cost.** Each question costs at most about 40 Neurons (the pick with
GLM-4.7-Flash, and Llama Guard). The site takes at most 200 questions a
day (`ASK_DAILY_LIMIT`), about 8,000 Neurons, inside Workers AI's free
10,000 a day. One visitor gets 10 a minute and 30 a day. All of these are
in `wrangler.jsonc`.

**What is logged.** One line per question, under the Worker's
Observability tab: which answer was picked, or why the question was turned
away. Never the visitor's address. What was asked and what was quoted back
are logged only if you set `ASK_LOG_QUESTIONS` to `"true"`; if you do, say
so on your site.

To see how well it picks, put questions about you in
`tests/ask-questions.json`, raise `ASK_VISITOR_LIMIT` above their number,
and run `node tests/ask-eval.ts https://<your site>`. The ones that should
be blocked run last, and block your address for a day.

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

## Privacy and security

No analytics, no cookies, no third-party requests. Fonts and icons are
served from the site itself. The Content-Security-Policy allows only the
site's own files, nothing inline, and Trusted Types with no policy. The
browser remembers chats and layout in `localStorage`, on the visitor's
device only. See `.github/SECURITY.md` to report a problem.

## Credits and licence

Design inspired by the Claude app. Not affiliated with Anthropic. The fonts
are Inter, Source Serif 4, Geist Mono, Noto Sans JP and Noto Serif JP,
under the SIL Open Font License (texts in `public/assets/fonts/`).

MIT licensed: see `LICENSE`.
