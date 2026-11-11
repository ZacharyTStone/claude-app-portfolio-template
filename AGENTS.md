# AGENTS.md

A portfolio site laid out like the Claude app: a sidebar of tabs, each a
short conversation about the site's owner, in one or more languages.
Everything the site says is in `site.config.ts`. Astro builds it into
static HTML and CSS that work without JavaScript; one small script adds
polish, and an optional `/ask` Worker runs on Cloudflare.

The same code runs two repos: a person's own site, and a public template
with a sample person. The shared files (`SHARED` in `scripts/template.ts`)
are byte for byte the same in both. A site made from the template takes
the template's changes with `npm run update-template`; the site the
template is made from sends its own with `scripts/sync-template.ts`.

## Commands

Run `npm ci` once. `npm run dev` serves the site as you edit it. Before you
call anything done:

```sh
npm run verify   # everything CI checks, in order; stops at the first failure and names the script to rerun
```

It needs `npx playwright install chromium` (the browser checks) and, on a
site with a Japanese page, Python with `pip install fonttools brotli` (the
font check). Its steps, one by one:

| Command                           | What it does                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `npm run lint` / `npm run format` | Checks or applies Prettier (TypeScript, JSON and `.astro`)                      |
| `npm run typecheck`               | `astro check` for the components, then `tsc` for the rest                       |
| `npm run build`                   | Checks `site.config.ts`, then Astro builds the site into `dist/`                |
| `npm run lint:html`               | Validates every built page                                                      |
| `npm test`                        | Unit tests (`tests/**/*.test.ts`): some read `dist/`, one builds `tests/sample` |
| `npm run fonts:check`             | The Japanese fonts have every character the Japanese page uses                  |
| `npm run test:browser`            | The built pages in Chromium, with the real security headers                     |

`npm run update-template` (in a site made from the template) replaces the
shared files with the template's latest; it needs a clean working tree.

After changing Japanese text: `npm run build`, `npm run fonts` (it reads the
built page and rewrites the font subsets in `public/`), then build again.

`SITE_CONFIG=path/to/another.config.ts npm run build` builds another
config, as the sample-site test does.

## Layout

```
site.config.ts    Everything the site says, in every language (each repo's own)
astro.config.ts   How Astro builds it: static files, nothing inline
src/pages/        The routes: each language's page, 404, llms.txt, sitemap.xml, robots.txt, ask.json
src/layouts/      Document.astro: the <head> every page starts with
src/components/   The page's parts, one .astro file each
src/site/         What the pages are built from, as plain TypeScript: the site's links and addresses,
                  the config's checks (validate.ts), its Markdown, llms.txt, Ask's answers
src/integrations/ Astro hooks: check the config before a build, write the host's _headers after
src/shared/       The contracts between the pages, the browser code and the Worker
src/styles/       The stylesheet in parts; app.css imports them in order, a site's own (site.css) last
src/app/          The browser code; Astro bundles it into the pages' one script
src/worker/       POST /ask, the only server code (Cloudflare Workers, bundled by wrangler)
public/           Files served as they are: favicons, the social card, pictures, icons, fonts
dist/             What Astro builds and the host serves (never committed)
scripts/          template.ts (the shared list), update-template.ts, verify.ts, fonts.ts and ja-font.py
                  (font subsets); in the site the template is made from, sync-template.ts
tests/            Unit tests (*.test.ts), browser/ (Playwright checks), sample/ (a made-up site the
                  tests build with SITE_CONFIG), the Ask eval
examples/         (template) Sample content to import into the config, such as a second language
```

## Rules

- **Nothing inline, and no HTML from strings in the browser.** The CSP
  allows only the site's own files and requires Trusted Types with no
  policy (`trusted-types 'none'`). So a component has no `style` attribute,
  no `<style>`, no `is:inline`, and no `<script>` or `set:html` but the
  three in the page: the one that brings in `src/app` (Astro writes it to a
  file) and the two JSON data blocks. In `src/app`, `innerHTML`,
  `outerHTML`, `insertAdjacentHTML` and `document.write` throw: make
  elements with `make()` from `src/app/lib/dom.ts`. Icons are CSS masks
  over files in `public/assets/icons`.
- **A space between elements is written on one line.** Astro keeps
  whitespace between elements only when it has no line break in it.
  Prettier (`htmlWhitespaceSensitivity: "strict"`) writes a space it has
  to move as `{" "}`; write a needed one the same way. Inside `<pre>`
  every character counts: build its lines as an array (`Card.astro`).
- **No framework code reaches the browser.** No `client:` directives, view
  transitions or UI-framework integrations: the pages' only script is
  `src/app`.
- **Nothing built is committed.** `dist/` is Astro's. `public/` holds only
  files served as they are.
- **Shared code never names a person.** Shared files (`SHARED`) go to the
  public template; the sync refuses to copy a shared file that names the
  owner (the name whole and in parts in every language, the domain, email,
  profile handles, employer and school), and `tests/sync-template.test.ts`
  fails CI on one. The template's address in `scripts/template.ts` is the
  one exception. Everything else (`site.config.ts`, `README.md`,
  `wrangler.jsonc`, images, `tests/ask-questions.json`, and `OWN` in
  `scripts/template.ts`: `src/styles/site.css` and the Japanese font
  subsets) is each repo's own. A new file is each repo's own until it's in
  `SHARED`.
- **Every fact has one home.** Ids, data attributes, classes, storage keys,
  wording, headers and limits are defined once and imported wherever they're
  needed, tests included: a name a component writes into the page and the
  script or the browser checks rely on is in `src/shared/page-data.ts`; what
  the script makes, and the classes the checks find on it, are in
  `src/app/constants.ts` (`CLASS`). Site facts (names, threads, questions)
  come from `site.config.ts` or the built page, never from a literal, so the
  tests pass on any site.
- **The contracts are in `src/shared`:** `config.ts` (the config's shape,
  documented field by field), `page-data.ts` (what a page hands the script:
  `SCRIPT_STRINGS`, the question card, and the names both find their way
  by: `PAGE_IDS`, `DATA`, `PAGE_CLASSES`, `ID_PREFIX`, `HOURS` and the
  rest), `ask.ts` (`/ask`'s path, request, reply, index and limits),
  `headers.ts` (the security headers), `content.ts` (an answer's blocks),
  `markdown.ts` (the config's Markdown, read one way by the pages, the
  script and the checks). Change one, and the type checker shows every
  side that has to follow.
- **Ask only quotes.** The model reads every answer, says what it makes of
  the question (its thinking, which goes to the log), then picks an answer
  and the numbers of its lines; the Worker builds the reply from those lines
  (`src/worker/ask/quote.ts`), and from the sentence before one that opens
  by pointing back at it ("It shipped…"), so a reply reads on its own. No
  text the model writes reaches a visitor.
- **TypeScript that Node runs as is** (outside `.astro` files): no enums,
  namespaces or parameter properties, and imports name the `.ts` file. The
  tests and scripts import `src/site` and `src/shared` straight into Node.

## Adding a config field

1. Add it, with a doc comment, to its type in `src/shared/config.ts`.
   Make it optional unless every site must set it (the template's config
   has to have it too).
2. Set it in `site.config.ts`.
3. If it can be wrong (it names a thread, a file, an icon), check it in
   `src/site/validate.ts`, with a test in `tests/config.test.ts`.
4. Show it in the component it belongs to, in `src/components/`. Astro
   escapes text; the config's Markdown goes through `<Inline>`.
5. If the script needs it, it goes through `src/shared/page-data.ts`:
   wording the script shows is a `SCRIPT_STRINGS` entry (each language's
   `strings` then needs it; the page carries it as a `data-*` on `<html>`,
   and the script reads it as `words` in `src/app/page.ts`); another
   `data-*` attribute is a `DATA` entry, spread onto its element
   (`{...{ [DATA.prompt]: value }}`, or `flag(DATA.copyLink)` for a bare
   one); data with a shape goes in a type there that both sides import.
6. `npm run verify`.

## Adding a browser check

- Add `{ name, url, device?, skip?, allowAsk?, test(page) }` to the list in
  the `tests/browser/checks/` file for its area (`home`, `ask`, `chats`,
  `sidebar`, `views`); a new area is a new file there, listed in `run.ts`.
- Find what to look for through `site` (`tests/browser/site.ts`): its
  threads (`A`, `B`, `C`), `words`, `questions`, `languages`, `ask`. When a
  site might not have the thing, set `skip` to say why.
- Select by `ID` and `CLASS` (the page's ids, and its and the script's
  classes, as selectors, from `site.ts`) and `DATA` (the data attributes,
  from `src/shared/page-data.ts`, with `LOCAL_ZONE`, `MENU_KEYS`, `HOURS`
  and the other names the page has), not by ids, classes or attributes
  typed out. A new chat is `askInNewChat(page, question)`, and the open
  chat is `OPEN_CHAT` (`helpers.ts`).
- Stand in for `/ask` with `askReturns(page, site.askUrl, replies)`; the
  checks never use the network.
- Wait for anything that changes a moment after an action (`waitFor()`,
  `eventually()`, `settledTitle()`) instead of reading it straight away.
  Waits time out after 10 s (`run.ts`); pass a timeout only when a check
  needs another.
- Callbacks that run in the page are compiled with Node's types, not the
  DOM's: type their arguments structurally (`Attributed`, `lastText`).
- Run `npm run test:browser` a few times: a check that passes once may
  still race.
