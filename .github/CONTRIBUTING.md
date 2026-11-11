# Contributing

Pull requests and issues are welcome. A few things keep the template what
it is:

- **Plain HTML and CSS reach the browser.** Astro builds the pages; no
  framework code, `client:` directive or third-party request reaches a
  visitor. The one script (`src/app`) only adds polish, so every tab works
  with JavaScript off.
- **The CSP stays strict.** Nothing inline (no `style` attribute, `<style>`
  or `<script>` in a component), and the browser code builds elements,
  never HTML from strings.
- **Everything a person writes lives in `site.config.ts`.** A new feature
  gets a documented field in `SiteConfig` (`src/shared/config.ts`), is used
  in the sample (Alex Example), and in `examples/ja.ts` if it has wording.

[AGENTS.md](../AGENTS.md) has the rest: the layout of the code, its rules,
and how to add a config field or a browser check.

## The shared code

The files in `SHARED` (`scripts/template.ts`) are the same, byte for byte,
in the template and in the site it is made from, and sites made from the
template take them with `npm run update-template`. A change to one of them
here is carried over to that site, so keep them free of anyone's content:
no names, addresses or links that belong in a config. Everything else
(`site.config.ts`, `examples/`, `README.md`, `wrangler.jsonc`,
`tests/ask-questions.json`, the pictures, the Japanese font subsets and
most of `.github/`) is the template's own.

## Checking a change

```sh
npm ci
npx playwright install chromium   # once, for the browser checks
npm run dev                       # the site at localhost:4321
npm run verify                    # everything CI runs, in order
```

`npm run verify` stops at the first step that fails and names the command
to rerun. Check the site at phone width too. If you touched anything a
second language affects, add `examples/ja.ts` as the README's "Languages
and fonts" says (it needs Python with `pip install fonttools brotli`). If
you changed what a host gets, set `host` to it and run `npm run build` and
`npm test`. If you changed Ask, turn it on as the README's "Ask" says and
try it with `npx wrangler dev`.

## Design

The look is inspired by the Claude app, but the project isn't affiliated
with Anthropic and uses its own sparkle mark and free fonts. Please don't
add Anthropic's logo, mascot or typefaces.
