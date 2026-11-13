# AGENTS.md

A portfolio site laid out like the Claude app: a sidebar of tabs, each a
short conversation about the site's owner, in one or more languages.
Everything the site says is in `site.config.ts`. Astro builds it into
static HTML and CSS that work without JavaScript; one small script adds
polish, and an optional `/ask` Worker runs on Cloudflare.

## What you may change here

This code lives in many repos: a public template with a sample person
(Alex Example), and every site made from it. The files listed in `SHARED`
(`scripts/template.ts`) are the same in all of them. A site takes the
template's latest with `npm run update-template`, which replaces them;
nothing goes the other way.

- **In a site made from the template**, change its own files:
  `site.config.ts`, `src/styles/site.css`, its diagrams in `diagrams/`, its
  pictures in `public/assets/`, `wrangler.jsonc`, `README.md` and
  `tests/ask-questions.json`. A change to a shared file is replaced by the
  next update, so make that change in the template instead.
- **In the template**, any file can change, and shared code never names a
  person: it holds only the sample one. A new file is the template's own
  until it is listed in `SHARED`.

## Commands

Run `npm ci` once. `npm run dev` serves the site as you edit it. Before
you call anything done, run `npm run verify`.

| Command | What it does |
| --- | --- |
| `npm run verify` | Everything CI checks, in order; it stops at the first failure and names the script to rerun |
| `npm run format` | Applies Prettier to TypeScript, JSON and `.astro` (`npm run lint` checks it) |
| `npm run typecheck` | `astro check` for the components, then `tsc` for the rest |
| `npm run build` | Checks `site.config.ts`, then Astro builds the site into `dist/` |
| `npm run lint:html` | Validates every built page |
| `npm test` | The unit tests in `tests/`; one builds the made-up site in `tests/sample/` |
| `npm run fonts:check` | The Japanese fonts have every character the Japanese page uses |
| `npm run test:browser` | The built pages in Chromium, with the real security headers |
| `npm run diagrams` | Writes each diagram in `diagrams/` as SVG files in `public/assets/` |
| `npm run update-template` | In a site: replaces the shared files with the template's latest |

- `npm run lint:html`, `npm test`, `npm run fonts:check` and
  `npm run test:browser` read `dist/`: run `npm run build` first, and
  again after a change.
- The browser checks need Playwright's Chromium, once:
  `npx playwright install chromium`. A site with a Japanese page also
  needs Python with `pip install fonttools brotli`, for its fonts.
- Under a coding agent, Astro starts `npm run dev` in the background and
  returns: `npx astro dev stop` ends it. If it stops before it is ready,
  `npm run build` prints why.
- `SITE_CONFIG=<a config file> npm run build` builds that config into
  `dist/`, as the sample-site test does with `tests/sample/site.config.ts`.

## Layout

| Path | What is there |
| --- | --- |
| `site.config.ts` | Everything the site says, in every language (each site's own) |
| `src/config/` | The config's manual: its types, documented field by field |
| `src/contracts/` | What the pages, the script, the Worker and the tests agree on: ids, classes, data attributes, the wire format of `/ask` |
| `src/pages/`, `src/layouts/` | The routes (each language's page, 404, llms.txt, sitemap.xml, robots.txt, ask.json) and the `<head>` they start with |
| `src/components/` | The page's parts, one `.astro` file each |
| `src/site/` | What the pages are built from, as plain TypeScript: the site's addresses, the config's checks, the security headers, llms.txt, Ask's answers |
| `src/integrations/` | Astro hooks: check the config before a build, write the host's `_headers` after |
| `src/styles/` | The stylesheet in parts; `src/styles/app.css` imports them in order, a site's own last |
| `src/app/` | The browser code; Astro bundles it into the pages' one script |
| `src/worker/` | `POST /ask`, the only server code (Cloudflare Workers, bundled by wrangler) |
| `src/shared/config.ts` | Only the path an older site's config imports its types from |
| `public/` | Files served as they are: favicons, the social card, pictures, icons, fonts |
| `diagrams/` | Pictures that move, as code (each site's own) |
| `scripts/` | The diagram kit, the font subsets, `update-template` and its list, `verify` |
| `tests/` | Unit tests, the browser checks (`tests/browser/`), the made-up site, Ask's eval |
| `docs/` | The guides: see the last section |
| `astro.config.ts` | How Astro builds it: static files, nothing inline |

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
  `public/assets/icons/`.
- **A space between elements is written on one line.** Astro keeps
  whitespace between elements only when it has no line break in it.
  Prettier writes a space it has to move as `{" "}`; write a needed one
  the same way. Inside `<pre>` every character counts: build its lines as
  an array.
- **No framework code reaches the browser.** No `client:` directives, view
  transitions or UI-framework integrations: the pages' only script is
  `src/app/`.
- **Nothing built is committed**, with two exceptions that a script
  writes into `public/`, so that a host builds nothing but the pages: the
  Japanese font subsets (`npm run fonts`) and the diagrams' SVG files
  (`npm run diagrams`). A check fails while either is out of date.
- **Every fact has one home.** Ids, data attributes, classes, storage
  keys, wording, headers and limits are defined once and imported wherever
  they're needed, tests included. A name the page writes and the script or
  a check relies on is in `src/contracts/`. Site facts (names, threads,
  questions) come from `site.config.ts` or the built page, never from a
  literal, so the tests pass on any site.
- **The type checker carries a contract's change.** Change a type in
  `src/config/` or a name in `src/contracts/`, and it shows every side
  that has to follow.
- **Ask answers only from what the site says, and shows it.** What its
  model is told and what is checked in a reply are a safety property:
  change them only as `docs/changing-the-code.md` says.
- **The update scripts run on Node alone.** `scripts/template.ts` and
  `scripts/update-template.ts` import only `node:` modules and each other:
  an update runs the template's copy from a fresh clone, where no package
  is installed.
- **TypeScript that Node runs as is** (outside `.astro` files): no enums,
  namespaces or parameter properties, and imports name the `.ts` file. The
  tests and scripts import the build's code straight into Node.

## Before you do it, read its guide

| Before you… | Read |
| --- | --- |
| change what the site says: a thread, an answer, a picture, a link, the viewer | `docs/content.md` |
| add a language, or change Japanese text | `docs/languages.md` |
| draw or change a diagram | `docs/diagrams.md` |
| turn Ask on, or change its limits or its cost | `docs/ask.md` |
| change a header, the policy, or what a page loads | `docs/security.md` |
| deploy, or change `host` or `url` | `docs/deploy.md` |
| take the template's updates, or change how they're taken | `docs/updating.md` |
| add a config field or a browser check, or change what Ask may say | `docs/changing-the-code.md` |
