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
| `npm run diagrams`                | Writes the diagrams (`diagrams/*.ts`) as SVG files in `public/assets`           |

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
                  the config's checks (validate.ts lists them; validate/ has them), its Markdown,
                  llms.txt, Ask's answers
src/integrations/ Astro hooks: check the config before a build, write the host's _headers after
src/shared/       The contracts between the pages, the browser code and the Worker
src/styles/       The stylesheet in parts; app.css imports them in order, a site's own (site.css) last
src/app/          The browser code; Astro bundles it into the pages' one script
src/worker/       POST /ask, the only server code (Cloudflare Workers, bundled by wrangler)
public/           Files served as they are: favicons, the social card, pictures, icons, fonts
diagrams/         (each repo's own) Pictures that move, as code: `npm run diagrams` writes their files
dist/             What Astro builds and the host serves (never committed)
scripts/          template.ts (the shared list), update-template.ts, verify.ts, fonts.ts and ja-font.py
                  (font subsets), diagram.ts (the kit a diagram is drawn with) and diagrams.ts (writes
                  them); in the site the template is made from, sync-template.ts
tests/            Unit tests (*.test.ts), browser/ (Playwright checks), sample/ (a made-up site the
                  tests build with SITE_CONFIG), the Ask eval
examples/         (template) Sample content to import into the config, such as a second language
```

## Rules

- **Nothing inline, and no HTML from strings in the browser.** The CSP
  allows only the site's own files (and, on a site with a `viewer`, frames
  from the sites it lists) and requires Trusted Types with no policy
  (`trusted-types 'none'`). So a component has no `style` attribute,
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
  files served as they are. Two kinds of them are written by a script and
  committed, so the host builds nothing but the pages: the Japanese font
  subsets (`npm run fonts`) and the diagrams' SVG files
  (`npm run diagrams`). A check fails while either is out of date.
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
- **Ask answers from what the site says, and shows it.** The model reads
  every answer, says what it makes of the question (its thinking, which
  goes to the log), then picks an answer and the numbers of its lines
  (`src/worker/ask/pick.ts`). A second, small call answers the question in
  a sentence or two, in its own words, from those lines (`write.ts`). The
  Worker checks the names, numbers and addresses in it (`grounded.ts`):
  each has to be in the lines, their tab's name, the site's own question or
  the owner's name, and what the visitor typed is never a source. One that
  fails is asked for once more, then dropped, and the lines are quoted as
  they are if they're sentences (`quote.ts`); a card's row is never a
  reply, so the page shows the answer. A reply the model wrote goes out
  with the lines it was written from (`cited`, in `src/shared/ask.ts`),
  and the page quotes them under it; lines too long to quote together
  (`MAX_CITED_LENGTH`) aren't sent, and the reply has only its tab's link. The reply's ordinary words are the
  model's: what it's told is in `write.ts`, and what's checked is in
  `grounded.ts` and its tests. A change to either is a change to what
  Ask may say: make it there, with a test, and say so in the README.
- **The template scripts run on Node alone.** `scripts/template.ts`,
  `update-template.ts` and `sync-template.ts` import only `node:` modules
  and each other (and the config): they run in a fresh clone of the
  template and in the sync workflow, where nothing is installed. A package
  import in one fails there, and a test says so first.
- **TypeScript that Node runs as is** (outside `.astro` files): no enums,
  namespaces or parameter properties, and imports name the `.ts` file. The
  tests and scripts import `src/site` and `src/shared` straight into Node.

## Adding a config field

1. Add it, with a doc comment, to its type in `src/shared/config.ts`.
   Make it optional unless every site must set it (the template's config
   has to have it too).
2. Set it in `site.config.ts`.
3. If it can be wrong (it names a thread, a file, an icon), check it in
   `src/site/validate/`: `language.ts` for one language's text,
   `whole-site.ts` for a setting of the site, `blocks.ts` for a part of an
   answer. `src/site/validate.ts` lists the checks in the order their
   problems print. Add a test in `tests/config.test.ts`.
4. Show it in the component it belongs to, in `src/components/`. Astro
   escapes text; the config's Markdown goes through `<Inline>`.
5. If the script needs it, it goes through `src/shared/page-data.ts`:
   wording the script shows is a `SCRIPT_STRINGS` entry (each language's
   `strings` then needs it; the page carries it as a `data-*` on `<html>`,
   and the script reads it as `words` in `src/app/page.ts`), or, for a
   part only some sites have, an `OPTIONAL_SCRIPT_STRINGS` entry listed
   under its part in `PART_STRINGS`, which the config's checks ask for only on
   a site with the part; another
   `data-*` attribute is a `DATA` entry, spread onto its element
   (`{...{ [DATA.prompt]: value }}`, or `flag(DATA.copyLink)` for a bare
   one); data with a shape goes in a type there that both sides import.
6. `npm run verify`.

## Adding a picture that moves

A diagram is a picture: boxes, lines, and things that move along them. Each
is a short TypeScript file in `diagrams/`, drawn with the kit in
`scripts/diagram.ts`. `npm run diagrams` writes it as SVG files in
`public/assets`, and an `image` in the config shows it:

```ts
// diagrams/order.ts
import { arrowhead, box, label, levelCurve, line, loopOf, moving } from "../scripts/diagram.ts";
import type { Diagram } from "../scripts/diagrams.ts";

type Words = { till: string; kitchen: string };

function draw(words: Words) {
  const loop = loopOf(6); // seconds, and then it starts again
  const road = levelCurve({ x: 520, y: 200 }, { x: 1048, y: 200 });
  return {
    width: 1600,
    height: 400,
    shapes: [
      box({ x: 120, y: 120, width: 400, height: 160 }),
      label(words.till, { x: 320, y: 214 }, { size: 46, weight: 600 }),
      box({ x: 1080, y: 120, width: 400, height: 160 }),
      label(words.kitchen, { x: 1280, y: 214 }, { size: 46, weight: 600 }),
      moving(line(road), ...loop.draw(0.5, 1.5)), // the line draws itself,
      arrowhead({ x: 1064, y: 200 }, 0),
      loop.traveller(road, 1.5, 3), // and an order travels along it
    ],
  };
}

export default {
  name: "order",
  words: { en: { till: "The till", kitchen: "The kitchen" }, ja: { till: "レジ", kitchen: "キッチン" } },
  draw,
} satisfies Diagram<Words>;
```

```ts
// site.config.ts, in an answer
{ image: { src: "/assets/order.svg", still: "/assets/order-still.svg", alt: "…", width: 1600, height: 400 } }
```

What the kit has, each documented where it's defined:

- **Shapes.**
  - To draw: `box`, `label`, `dot`, `line`, `arrowhead`, `bar` (it stands
    for words), `dots` (a map).
  - A line's path: `levelCurve`, `arc`, or any SVG path (`rounded` writes a
    number in one).
  - Where things go: `Place`, `centreOf`, `rightOf`; `aroundOrigin` and
    `placed`, for what turns or grows about its own middle.
  - Room for text: `textWidth`, `sizeToFit`, `baselineAround`.
  - Together: `group`, `moving` (a shape with motion on it),
    `onlyWhenMoving`.
- **Motion**, from `loopOf(seconds)`.
  - A value changing: `loop.track` (any attribute), `loop.transform`,
    `loop.shown`, `loop.changing` (one text after another).
  - A line: `loop.draw` draws it, `loop.along` moves a shape along one.
  - Passing through: `loop.traveller` (a dot) and `loop.carried` (any
    shapes) along a path, `loop.ripple`.
  - A light: `loop.flash`, `loop.light` (over anything), `loop.edgeLight`
    (a box's edge, as something arrives).
- **A story's loop**, for a picture that follows one thing, ends as its
  still, then clears and starts again.
  - When it clears: `loopOf(seconds, { from, to })`. What the story built
    up fades then, together.
  - Coming to stay: `loop.since`, or by `loop.popping`, `loop.rising` or
    `loop.gliding` into place.
  - Starting over: `loop.fromTheStart` (what the loop changes),
    `loop.untilClear` (what something else brought in).

- **Move things, not words.** A dot along a line, a card up a list, a box
  that lights as something reaches it. Text that fades in a row at a time
  is a list: a `flow` or a paragraph says it better, and without motion.
- **The motion is SVG's own** (`<animate>`, `<animateMotion>`), which runs
  in an `<img>`: the page needs no script for it and its policy allows
  nothing new. So a diagram has no `<style>`, `<script>`, `class` or file
  of another's (`tests/diagrams.test.ts` says so).
- **Every motion lasts the whole loop.** Say when a thing happens in
  seconds into the loop (`loop.shown(2, 5)`), never with a length of its
  own, or the parts drift apart. Make the loop's end meet its start: what
  resets does it out of sight (a story's loop does this for what's put on
  it).
- **Draw each shape the way it rests.** The `-still.svg` file is the same
  shapes without their motion, and it's what a visitor who has asked for
  less motion sees (the image's `still`; a test says if it's missing). It
  should read as a finished diagram. What only passes through is
  `onlyWhenMoving` (what's `loop.carried`, a `traveller`, a `ripple` and a
  `light` already are).
- **Big and few words.** It's shown about 700 px wide on a desktop and 340
  on a phone: draw it 1600 wide, with text at 32 or more. It's drawn in
  the visitor's own font, so leave room around text (`textWidth`
  estimates it).
- **Each language's words are in `words`.** The first language's files are
  `NAME.svg` and `NAME-still.svg`; another's have its code (`NAME-ja.svg`).
- **What two diagrams draw goes in a part:** a file in a folder inside
  `diagrams/` (say `diagrams/parts/`), named for what it draws, with a
  header that says which diagrams use it. What any diagram might need
  goes in the kit instead. A change to either shouldn't change a picture
  it wasn't meant to: `npm run diagrams -- --check` names the files that
  would change.
- **Look at it.** `npm run diagrams NAME` writes one diagram; open the SVG
  file in a browser. Commit the files with the diagram: `npm test` fails
  while they aren't what it draws.
- `alt` says what the picture shows and what moves in it, for someone who
  can't see it. Ask and llms.txt read its caption.

## Opening a link in the viewer

The viewer shows a link's page in a panel beside the conversation, in a
frame, instead of a new tab. List the link in the config's `viewer`: its
`href` exactly as a link card, a picture or a panel row has it, and the
address to show in the frame (a Google Doc's ends `/preview`).

- The build adds that address's site to the policy's `frame-src`
  (`frameOrigins` in `src/shared/headers.ts`), and nothing else changes in
  the policy. It refuses an address that isn't `https://`, one on the site
  itself (its pages refuse to be framed), and a link nothing links to.
- It's the one thing a page loads from another site, and only once a
  visitor opens it. If the site says it loads nothing from elsewhere (a
  README, an answer about privacy), make that sentence true again.
- Each language needs `strings.viewerOpen` and `strings.viewerClose`.
- Not every site lets itself be framed: open the viewer once and look.

## Adding a browser check

- Add `{ name, url, device?, skip?, allowAsk?, test(page) }` to the list in
  the `tests/browser/checks/` file for its area (`home`, `ask`, `chats`,
  `sidebar`, `figures`, `viewer`, `views`); a new area is a new file there, listed in `run.ts`.
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
  DOM's: type their arguments as `PageElement` (`helpers.ts`), adding the
  member a callback needs. `attributeOfEach`, `hasClass`, `hasFocus` and
  `computedStyle` cover the common reads.
- Give each assertion words that say what was expected. A step of more
  than a few lines is a function under the list (`check…` when it
  asserts): a failure prints the step it happened in.
- Run `npm run test:browser` a few times: a check that passes once may
  still race.
