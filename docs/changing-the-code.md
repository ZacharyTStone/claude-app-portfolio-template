# Changing the code

For changes to the shared code: the pages, the script, the Worker, the
checks. Make them in the template, where every site takes them with its
next update; a change made in a site's own copy is replaced by that
update ([Updating](updating.md)). [AGENTS.md](../AGENTS.md) has the layout
and the rules every change keeps to.

## Adding a config field

1. Add it to its type in `src/config/`: `src/config/site-config.ts` for a
   setting of the whole site, `src/config/language.ts` for one language's
   page (or the file of its part: `home.ts`, `sidebar.ts`, `asked.ts`,
   `question-card.ts`), `src/config/blocks.ts` for a part of an answer.
   Give it a doc comment of one to six lines, which an editor shows on
   hover; `tests/config/field-docs.test.ts` fails without one. How-to text
   longer than that belongs in a guide. Make the field optional unless
   every site must set it.
2. Set it in `site.config.ts`, and in `tests/sample/site.config.ts` if the
   sample should show it.
3. If it can be wrong (it names a thread, a file, an icon), check it in
   `src/site/checks/`: `language.ts` for one language's text,
   `whole-site.ts` for a setting of the site, `blocks.ts` for a part of an
   answer, `formats.ts` for what a value has to look like (one table).
   `src/site/checks/check-site.ts` lists the checks in the order their
   problems print. Give it a row in that file's test in
   `tests/site/checks/`: each check's problems are a table, a row per
   wording.
4. Show it in the component it belongs to, in `src/components/`. Astro
   escapes text; the config's Markdown goes through
   `src/components/Inline.astro`.
5. If the script needs it, it goes through `src/contracts/`: a `data-*`
   attribute is an entry in `DATA` (`src/contracts/page-attributes.ts`),
   spread onto its element (`{...{ [DATA.prompt]: value }}`, or
   `flag(DATA.copyLink)` for a bare one, from
   `src/components/attributes.ts`). Data with a shape is a type both sides
   import.
6. `npm run verify`.

## Adding a string

- Wording the page shows itself is a field of `PageStrings` and a name in
  `PAGE_STRING_NAMES` (`src/config/strings.ts`).
- Wording the script shows is a key of `SCRIPT_STRING_ATTRIBUTES` in the
  same file, with its `data-*` attribute as the value and its doc comment
  over it. The page carries it on `<html>`, and the script reads it as
  `words` (`src/app/page.ts`).
- Wording for a part only some sites have is also listed under its part in
  `PART_STRINGS`; the config's checks ask for it only on a site with the
  part.
- Give it its English in `src/config/english-strings.ts`. A page in
  English uses that wherever its `strings` leave one out, so a new string
  breaks no English site. A page in another language states every string
  itself: add it to `examples/ja.ts` and `tests/sample/site.config.ts`.

`tests/config/field-docs.test.ts` fails for a string that is in the type
and not in a name list.

## Adding a stylesheet or a class

- A component's rules are in `Name.css` beside `Name.astro`. What the
  script makes is styled in `src/styles/`, a file per module of
  `src/app/`. Shared rules, the tokens (`src/styles/tokens.css`) and the
  four overlays stay in `src/styles/` too.
- `src/styles/app.css` is the ordered list of every stylesheet: a new one
  is added there, before `site.css`, which loads last.
- A class is a whole word, `component` or `component-part`. One the script
  or a browser check counts on is in `src/contracts/page-classes.ts`, its
  key the same words (`rowName` is `row-name`), with its selector in
  `src/contracts/page-selectors.ts`. `tests/styles/names.test.ts` holds
  the classes both ways, every stylesheet in `app.css`, and the
  breakpoints.
- `npm run format` formats CSS too.

## Changing the browser code

`src/app/main.ts` is `start()`, in named phases. A feature that needs
several files gets a folder (`src/app/conversation/`,
`src/app/question-card/`); one that fits a file is that file. A pure
decision (the clock's arithmetic, a tab's name, how a reply from `/ask` is
read, saved chats) is a module of its own with unit tests in `tests/app/`;
the DOM, pacing and focus are held by the browser checks.

Saved chats keep their storage key, and their JSON only ever grows by
optional fields: the golden chats in
`tests/app/conversation/saved-chats.test.ts` fail otherwise.

## Changing the Worker

The Worker's settings are one table, `src/worker/settings.ts`, and
`tests/worker/wrangler.test.ts` ties `wrangler.jsonc` to it: a new setting
goes in both. What came of a question is one `Outcome`
(`src/worker/ask/outcome.ts`); the reply, the log line
(`src/worker/ask/log.ts`) and the spend each come from it once.
`src/worker/ask/model.ts` is the only caller of Workers AI.

## Changing what Ask may say

What a model is told is in `src/worker/ask/prompts/` (the reply's
instruction is `src/worker/ask/prompts/reply.ts`), held whole in
`tests/worker/prompts/`. What is checked in a reply is in
`src/worker/ask/checks/` (`grounded.ts` for the reply,
`same-question.ts` for the question said to the owner) and their tests in
`tests/worker/checks/`. A change to either is a change to what Ask may
say: make it there, with a test, and say so in [Ask](ask.md), which tells
a site's owner what a reply is held to.

To change a prompt, edit it, run
`UPDATE_PROMPTS=1 node --test tests/worker/prompts.test.ts`, and commit
`tests/worker/prompts/` with it. The diff is what a model will now be
sent.

## Adding a browser check

The checks are Playwright tests, `tests/browser/*.spec.ts`.
`npm run test:browser` runs them on two sites: the repo's own (the
project `site`) and the made-up one in `tests/sample` (the project
`sample`), which has what a starter site may not: Ask, a viewer, a second
language, a path it's served under. It needs `npm run build` first, and
says so.

- **Run less than everything while you work.**
  `npx playwright test viewer.spec` runs one file, `-g "words from its
  name"` one test, `--project=site` one site. `--ui` or `--debug` lets you
  watch, and `--repeat-each=5` looks for a race. A failure leaves a
  screenshot in `test-results/`.
- **Import `test` and `expect` from `tests/browser/fixtures.ts`**, not
  from `@playwright/test`. Its `test` serves the built site with the real
  security headers, reads it once, and fails a test on any error in the
  page or its console (a request the page's policy blocked is one).
- **Look for what the site has, never for one site's content.** The
  `site` fixture (`tests/browser/site.ts`) has its threads
  (`firstThread`, `secondThread`), `words`, `questions`, `languages` and
  the rest, read from the built page.
- **A part only some sites have is a fixture**: `viewerLink`,
  `playedPicture`, `movingPicture`, `comingIntoView`, `otherThread`,
  `clock`, `startingPrompt`, `personalAnswer`, `foldingGroup`. A test that
  asks for one is skipped, with the reason, on a site without it. For any
  other condition, `test.skip(!site.ask, "Ask is off")`. Never an `if`
  around assertions: a part that silently doesn't run reads as a pass.
- **Select by the page's names**: `CLASS_SELECTOR`, `ID_SELECTOR`,
  `ATTRIBUTE_SELECTOR` (`src/contracts/page-selectors.ts`), not by a class
  or an id typed out. Parts more than one spec looks for are in
  `tests/browser/parts.ts` (`OPEN_CHAT`, `sentInto()`); what a visitor does
  in more than one is in `tests/browser/visitor.ts` (`askIn()`,
  `askInNewChat()`, `renameTab()`, `revisit()`).
- **Stand in for `/ask` with the `ask` fixture**:
  `await ask.returns({ id: null })`, or a list of replies to give in turn;
  `ask.requests` is what the page sent. The checks never use the network.
- **Assert with `expect(locator)`**, which waits: `toBeVisible()`,
  `toHaveText()`, `toBeFocused()`, `toHaveCSS()`. Don't read a value and
  then compare it. `page.waitForTimeout()` is only for showing that
  something did not happen.
- **Stop the clock** for anything that depends on the time of day:
  `await page.clock.setFixedTime(halfPast(hour, visitorZone))` before
  `page.goto()` (`tests/browser/time.ts`).
- **One behaviour a test**, named as a sentence that says what a visitor
  does and what the page should then do. Tests that begin the same way go
  in a `test.describe` with a `test.beforeEach`. Another kind of visit is
  `test.use(A_PHONE)`, `{ javaScriptEnabled: false }` or
  `{ reducedMotion: "reduce" }` in a `describe`.
- **What the page works out without the page belongs in a unit test** in
  `tests/app/`. The browser test says the page shows it.
