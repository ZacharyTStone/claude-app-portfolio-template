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
  `PAGE_STRING_NAMES` (`src/config/strings.ts`). Wording the page shows
  for a part only some sites have is a type of its own, as the contact
  form's is (`ContactFormStrings` and `CONTACT_FORM_STRING_NAMES`).
- Wording the script shows is a key of `SCRIPT_STRING_ATTRIBUTES` in the
  same file, with its `data-*` attribute as the value and its doc comment
  over it. The page carries it on `<body>`, and the script reads it as
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
decision (the clock's arithmetic, a tab's name, what an address names, how
a reply from `/ask` is read, saved chats) is a module of its own with unit
tests in `tests/app/`; the DOM, pacing and focus are held by the browser
checks.

Each tab has a page of its own (`src/site/pages.ts`), and the script moves
between them in place: `src/app/address.ts` pushes a tab's address onto
the history and follows the address however it changes, and
`src/app/tabs.ts` shows the tab it names. Go to a tab with `openTab()`
(`src/app/navigation.ts`), not by setting `location`, so what was to
happen once it's open does.

Saved chats keep their storage key, and their JSON only ever grows by
optional fields: the golden chats in
`tests/app/conversation/saved-chats.test.ts` fail otherwise.

## Changing the Worker

The Worker's settings are one table, `src/worker/settings.ts`, and
`tests/worker/wrangler.test.ts` ties `wrangler.jsonc` to it: a new setting
goes in both. What came of a question is one `Outcome`
(`src/worker/ask/outcome.ts`); the reply, the log line
(`src/worker/ask/log.ts`) and the spend each come from it once.
`src/worker/ask/model.ts` is the only caller of Workers AI. The contact
form's `/contact` is built the same way, in `src/worker/contact/`: what
came of a message is one `ContactOutcome`, and the reply (JSON, or a
redirect back to the page) and the log line each come from it. Its
senders are `outbox.ts`, and `providers.ts` is the only caller of a
sender's API, whose tests pass a `fetch` of their own.

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

## What the build fetches

A build fetches two things: the Writing tab's posts
(`src/integrations/writing.ts`, `src/site/writing/`) and the panel's
activity (`src/integrations/activity.ts`, `src/site/activity/`).
The Writing tab's places are each a module of `src/site/writing/`
(`qiita.ts`, `zenn.ts`, `dev.ts`, and `feeds.ts` for every place read from
a feed), listed together in `sources.ts`; a new place is a module there
that gives `Post`s, a field of `Writing` (`src/config/writing.ts`), a row
in `src/site/checks/writing.ts`, and a part of the stand-in
(`src/site/writing/fixture.ts`). The panel's places are each a module of
`src/site/activity/` (`github.ts`, `gitlab.ts`, `codeberg.ts`), asked
together in `recent.ts`. What their requests share, the time limit and
the one more try, is `src/site/fetching.ts` (and `src/site/writing/source.ts`
and `src/site/activity/asking.ts`). No test reaches any of them. A unit
test passes a place's function (`qiitaPosts()`, `zennPosts()`,
`feedPosts()`, `githubRepos()`…) a `fetch` of its own. A build the tests
make is given `WRITING_FIXTURE` and `ACTIVITY_FIXTURE`, the paths of
`tests/sample/writing.json` and `tests/sample/activity.json`
(`tests/build/astro-build.ts`), and asks those files in place of the
places; each answers for the sample's users alone, so it can stand in for
no real site's. A new test that builds a site goes through `astroBuild()`
too; one of a site before its first post gives it
`tests/sample/writing-no-posts.json` in place of `writing.json`.
[Writing](writing.md#without-the-places-in-the-tests) and
[Activity](activity.md#without-github-gitlab-or-codeberg-in-the-tests)
say the same for a site's owner.

A site with `githubHistory` fetches a third thing, its owner's whole
history on GitHub (`src/integrations/history.ts`, `src/site/history/`),
from GitHub's GraphQL API, which needs the token in `GITHUB_TOKEN`. It
shares the time limit and the one more try, and a unit test passes
`githubHistory()` a `fetch` of its own too. A build the tests make is
given `GITHUB_HISTORY_FIXTURE`, the path of
`tests/sample/github-history.json`, which answers its two queries for
the sample's user alone, and needs no token
([GitHub history](github-history.md#without-github-in-the-tests)). What
the parts show is worked out by pure functions in `src/site/history/`,
each with its tests in `tests/site/history/`.

A post's text, which a build keeps for a site whose viewer shows its
posts, is read into parts by `src/site/writing/body.ts`, with Astro's own
Markdown reader (`satteri`, which only the build runs), and each post's
page is made from the parts (`src/site/writing/post-pages.ts`,
`src/components/PostPage.astro`). A new kind of part is a member of
`PostBlock`, a row in `tests/site/writing/body.test.ts`, and an element in
`src/components/PostBlock.astro`; nothing of a post is ever given to
`set:html`.

## Adding a browser check

The checks are Playwright tests, `tests/browser/*.spec.ts`.
`npm run test:browser` runs them on two sites: the repo's own (the
project `site`) and the made-up one in `tests/sample` (the project
`sample`), which has what a starter site may not: Ask, a viewer, a second
language, a path it's served under. The contact form's checks also run on
the sample as Netlify serves it (the project `netlify`,
`tests/sample/on-netlify.ts`), where Netlify Forms takes its messages.
The sample's projects test the template's shared code, so they run in the
template alone (`isTheTemplate` in `scripts/template.ts`, by the repo
GitHub Actions or the clone's `origin` names): a site made from it runs
`site` alone, and so do the two unit tests that build the sample. It
needs `npm run build` first, and says so. On CI the checks take every
core, split three ways across jobs side by side.

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
  (`firstThread`, `secondThread`, each with its page's `path`), `words`,
  `questions`, `languages` and the rest, read from the built page; any
  tab's page is `site.pathOf()` its id.
- **A part only some sites have is a fixture**: `viewerLink`,
  `playedPicture`, `movingPicture`, `comingIntoView`, `otherThread`,
  `clock`, `startingPrompt`, `personalAnswer`, `foldingGroup`,
  `contactForm`, `writingTab`, `postInViewer`, `panelActivity`,
  `gatheredContext`, `githubHistory`. A test
  that asks for one is skipped, with the reason, on a site without it. For
  any other condition, `test.skip(!site.ask, "Ask is off")`. Never an `if`
  around assertions: a part that silently doesn't run reads as a pass.
- **Select by the page's names**: `CLASS_SELECTOR`, `ID_SELECTOR`,
  `ATTRIBUTE_SELECTOR` (`src/contracts/page-selectors.ts`), not by a class
  or an id typed out. Parts more than one spec looks for are in
  `tests/browser/parts.ts` (`openTab()`, `OPEN_CHAT`, `sentInto()`); what a
  visitor does in more than one is in `tests/browser/visitor.ts` (`askIn()`,
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
- **A new kind of page gets a line in the accessibility check**,
  `tests/browser/accessibility.spec.ts`, which runs axe-core (WCAG 2.0 and
  2.1, A and AA) on each kind, with the script and without, wide and on a
  phone. What it finds is fixed in the page, not by turning a rule off.
