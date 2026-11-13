# Changing the code

For changes to the shared code: the pages, the script, the Worker, the
checks. Make them in the template, where every site takes them with its
next update; a change made in a site's own copy is replaced by that
update ([Updating](updating.md)). [AGENTS.md](../AGENTS.md) has the layout
and the rules every change keeps to.

## Adding a config field

1. Add it, with a doc comment, to its type in `src/config/`:
   `src/config/site-config.ts` for a setting of the whole site,
   `src/config/language.ts` for one language's text,
   `src/config/blocks.ts` for a part of an answer. Make it optional unless
   every site must set it.
2. Set it in `site.config.ts`.
3. If it can be wrong (it names a thread, a file, an icon), check it:
   in `src/site/validate/language.ts` for one language's text,
   `src/site/validate/whole-site.ts` for a setting of the site, or
   `src/site/validate/blocks.ts` for a part of an answer.
   `src/site/validate.ts` lists the checks in the order their problems
   print. Add a test in `tests/config.test.ts`.
4. Show it in the component it belongs to, in `src/components/`. Astro
   escapes text; the config's Markdown goes through
   `src/components/Inline.astro`.
5. If the script needs it:
   - Wording the script shows is an entry in `SCRIPT_STRING_ATTRIBUTES`
     (`src/config/strings.ts`). Each language's `strings` then needs it,
     the page carries it as a `data-*` attribute on `<html>`, and the
     script reads it as `words` (`src/app/page.ts`).
   - Wording for a part only some sites have is also listed under its
     part in `PART_STRINGS`, and the config's checks ask for it only on a
     site with the part.
   - Another `data-*` attribute is an entry in `DATA`
     (`src/contracts/page-attributes.ts`), spread onto its element:
     `{...{ [DATA.prompt]: value }}`, or `flag(DATA.copyLink)` for a bare
     one (`src/components/attributes.ts`).
   - Data with a shape is a type that both sides import.
6. `npm run verify`.

## Changing what Ask may say

What the model is told is in `src/worker/ask/write.ts`, and what is
checked in a reply is in `src/worker/ask/grounded.ts` and its tests. A
change to either is a change to what Ask may say: make it there, with a
test, and say so in [Ask](ask.md), which tells a site's owner what a reply
is held to.

## Adding a browser check

- Add `{ name, url, device?, skip?, allowAsk?, test(page) }` to the list in
  the `tests/browser/checks/` file for its area (`home`, `ask`, `chats`,
  `sidebar`, `figures`, `viewer`, `views`). A new area is a new file
  there, listed in `tests/browser/run.ts`.
- Find what to look for through `site` (`tests/browser/site.ts`): its
  threads (`A`, `B`, `C`), `words`, `questions`, `languages`, `ask`. When a
  site might not have the thing, set `skip` to say why.
- Select by `ID` and `CLASS` (the page's ids, and its and the script's
  classes, as selectors, from `tests/browser/site.ts`) and `DATA` (the
  data attributes, from `src/contracts/page-attributes.ts`), not by ids,
  classes or attributes typed out. A new chat is
  `askInNewChat(page, question)`, and the open chat is `OPEN_CHAT`
  (`tests/browser/helpers.ts`).
- Stand in for `/ask` with `askReturns(page, site.askUrl, replies)`; the
  checks never use the network.
- Wait for anything that changes a moment after an action (`waitFor()`,
  `eventually()`, `settledTitle()`) instead of reading it straight away.
  Pass a timeout only when a check needs another.
- Callbacks that run in the page are compiled with Node's types, not the
  DOM's: type their arguments as `PageElement`, adding the member a
  callback needs. `attributeOfEach`, `hasClass`, `hasFocus` and
  `computedStyle` cover the common reads.
- Give each assertion words that say what was expected. A step of more
  than a few lines is a function under the list (`check…` when it
  asserts): a failure prints the step it happened in.
- Run `npm run test:browser` a few times: a check that passes once may
  still race.
