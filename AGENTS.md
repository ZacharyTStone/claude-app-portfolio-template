# AGENTS.md

A portfolio site laid out like the Claude app: a sidebar of tabs, each a
short conversation about the site's owner, in one or more languages.
Everything the site says is in `site.config.ts`. Astro builds it into
static HTML and CSS that work without JavaScript; one small script adds
polish, and an optional `/ask` Worker runs on Cloudflare.

## What you may change here

This code lives in many repos: a public template with a sample person
(Alex Example), and every site made from it. The paths in the `shared`
list of `scripts/shared-files.json` are the same in all of them. A site
takes the template's latest with `npm run update-template`, which replaces
them. Updates go one way, from the template to a site.

- **In a site made from the template**, change its own files:
  `site.config.ts`, `src/styles/site.css`, its diagrams in `diagrams/`, its
  pictures in `public/assets/`, `wrangler.jsonc`, `README.md` and
  `tests/ask-questions.json`. A change to a shared file is replaced by the
  next update, and so is a file added inside a shared folder.
- **In the template**, any file can change, and shared code never names a
  person: it holds only the sample one. A new file is the template's own
  until it is in the `shared` list. A shared path that goes moves to the
  `retired` list, so an update deletes it from older sites.

## Commands

Node 24 (`.node-version`; `engine-strict` refuses an older one). Run
`npm ci` once. `npm run dev` serves the site as you edit it. Before you
call anything done, run `npm run verify`.

| Command | What it does |
| --- | --- |
| `npm run verify` | Everything CI checks, in order, stopping at the first failure: the eight scripts below it |
| `npm run format:check` | Prettier, on TypeScript, JavaScript, JSON, CSS and `.astro` (`npm run format` applies it) |
| `npm run lint` | ESLint (`eslint.config.js`): the rules under "Rules" |
| `npm run knip` | Fails on a file, an export or a dependency nothing uses: remove it |
| `npm run typecheck` | `astro check` for the components, then `tsc` for the browser code, the Worker and the tests |
| `npm test` | Builds, then runs the unit tests (`tests/**/*.test.ts`); some read `dist/`, some build `tests/sample` |
| `npm run lint:html` | Validates every built page |
| `npm run fonts:check` | The Japanese fonts have every character the built Japanese page uses |
| `npm run test:browser` | The built pages in Chromium, with the real security headers, on the site and on the sample |
| `npm run build` | Type-checks `site.config.ts`, checks what a type can't, then builds `dist/` |
| `npm run diagrams` | Writes each diagram in `diagrams/` as SVG files in `public/assets/` |
| `npm run deploy` | Deploys to Cloudflare with one pinned Wrangler (`npm run wrangler` for its other commands) |
| `npm run update-template` | In a site: replaces the shared files with the template's latest |

- `npm run lint:html`, `npm run fonts:check` and `npm run test:browser`
  read `dist/` and say so when there is none: run `npm run build` first.
- The browser checks need Chromium, once: `npx playwright install chromium`
  (CI adds `--with-deps`). Run one file with
  `npx playwright test viewer.spec`.
- `SITE_CONFIG=<a config file> npm run build` builds that config, as the
  tests do with `tests/sample/site.config.ts`.

## Layout

| Path | What is there |
| --- | --- |
| `site.config.ts` | Everything the site says, in every language (each site's own) |
| `src/config/` | The config's types: a doc comment on every field, which an editor shows on hover; English wording's defaults |
| `src/contracts/` | What the pages, the script, the Worker and the tests agree on: ids, classes, data attributes, selectors, `/ask`'s wire format |
| `src/site/` | What the build reads and writes, as plain TypeScript: `site.ts`, the config's checks (`checks/`), each file it writes (`files/`), the security headers |
| `src/pages/`, `src/layouts/` | The routes (each language's page, 404, llms.txt, sitemap.xml, robots.txt, `[ask].json.ts`) and the `<head>` |
| `src/components/` | The page's parts: `Name.astro`, its rules in `Name.css` beside it |
| `src/integrations/` | Astro hooks: check the config before a build, write the host's files after |
| `src/styles/` | Shared rules, and the rules for what the script makes; `app.css` lists every stylesheet in order |
| `src/app/` | The browser code: `main.ts` starts it; a feature of several files is a folder |
| `src/worker/` | `POST /ask`, the only server code; its settings are `src/worker/settings.ts` |
| `src/shared/config.ts` | Only the path an older site's config imports its types from |
| `public/` | Files served as they are: favicons, the social card, pictures, icons, fonts |
| `diagrams/` | Pictures that move, as code (each site's own) |
| `scripts/` | The diagram kit (`diagram.ts`), the fonts (`fonts.ts`), the update and its list |
| `tests/` | Unit tests mirroring `src/`, the browser checks (`tests/browser/`), the sample site, Ask's eval |
| `playwright.config.ts` | How the browser checks run: the two sites, the visitor's time zone |
| `docs/` | The guides: see the last section |

`dist/` is what Astro builds and the host serves. It is never committed.

## Rules

- **Nothing inline, and no HTML from strings in the browser.** The
  Content-Security-Policy allows only the site's own files (and, on a site
  with a `viewer`, frames from the sites it lists) and requires Trusted
  Types with no policy. So a component has no `style` attribute, no
  `<style>`, no `is:inline`, and no `<script>` or `set:html` but the three
  in the page: the one that brings in `src/app/` and the two JSON data
  blocks. In the browser code, `innerHTML`, `outerHTML`,
  `insertAdjacentHTML` and `document.write` throw: make elements with
  `make()` from `src/app/lib/dom.ts`. Icons are CSS masks over the files in
  `public/assets/icons/`. ESLint refuses each of these.
- **No framework code reaches the browser.** No `client:` directives, view
  transitions or UI-framework integrations, and no schema library
  (`tests/contracts/page-script.test.ts`).
- **A space between elements is written on one line.** Astro keeps
  whitespace between elements only when it has no line break in it.
  Prettier writes a space it has to move as `{" "}`; write a needed one
  the same way. Inside `<pre>` every character counts: build its lines as
  an array.
- **Small units.** ESLint fails more than 4 parameters, complexity over
  10, nesting deeper than 3, a nested ternary and a `----` banner, and,
  outside `tests/`, a function of more than 50 lines or a file of more
  than 300. Split the code; never add an `eslint-disable` comment.
- **Each folder of `src/` imports only from the folders below it**
  (`MAY_IMPORT` in `eslint.config.js`), and imports name the `.ts` file.
- **Every fact has one home.** Ids, data attributes, classes, storage
  keys, wording, headers and limits are defined once and imported wherever
  they're needed, tests included. A class's key is its value in whole
  words (`rowName` is `row-name`), in `src/contracts/page-classes.ts`;
  `tests/styles/names.test.ts` holds the classes and the stylesheets
  together. Site facts (names, threads, questions) come from
  `site.config.ts` or the built page, never from a literal, so the tests
  pass on any site.
- **The type checker carries a contract's change.** Change a type in
  `src/config/` or a name in `src/contracts/`, and it shows every side that
  has to follow. Saved chats only ever grow by optional fields.
- **Ask answers only from what the site says, and shows it.** What its
  models are told and what is checked in a reply are a safety property:
  change them only as `docs/changing-the-code.md` says.
- **Nothing built is committed**, but for two things a script writes into
  `public/`: the Japanese font subsets (`npm run fonts`) and the diagrams'
  SVG files (`npm run diagrams`). A test fails while either is out of date.
- **The update runs on Node alone.** `scripts/template.ts` and
  `scripts/update-template.ts` import only `node:` modules and each other.
- **TypeScript that Node runs as is** (outside `.astro` files): no enums,
  namespaces or parameter properties. The tests and scripts import the
  build's code straight into Node.

## Before you do it, read its guide

| Before you… | Read |
| --- | --- |
| change what the site says: a thread, an answer, a picture, a link, the viewer | `docs/content.md` |
| add a language, or change Japanese text | `docs/languages.md` |
| draw or change a diagram | `docs/diagrams.md` |
| turn Ask on, or change its limits or its cost | `docs/ask.md` |
| change a header, the policy, or what a page loads | `docs/security.md` |
| deploy, or change `host` or `url` | `docs/deploy.md` |
| take the template's updates | `docs/updating.md` |
| add a config field, a string, a stylesheet or a browser check, or change a prompt or what Ask may say | `docs/changing-the-code.md` |
