# Contributing

Pull requests and issues are welcome. A few things keep the template what
it is:

- **Plain HTML and CSS reach the browser.** Astro builds the pages; no
  framework code, `client:` directive or third-party request reaches a
  visitor. (The one exception is a page a site lists in `viewer`, which
  loads in a frame once the visitor opens it.) The one script (`src/app/`)
  only adds polish, so every tab works with JavaScript off.
- **The CSP stays strict.** Nothing inline (no `style` attribute, `<style>`
  or `<script>` in a component), and the browser code builds elements,
  never HTML from strings.
- **Everything a person writes lives in `site.config.ts`.** A new feature
  gets a documented field in the config's types (`src/config/`), is used
  in the sample (Alex Example), and in `examples/ja.ts` if it has wording.

[AGENTS.md](../AGENTS.md) has the layout of the code and its rules, and
[Changing the code](../docs/changing-the-code.md) the steps to add a
config field or a browser check.

## The shared code

The template is the one source of the files in `SHARED`
(`scripts/template.ts`). Every site made from it takes them, byte for
byte, with `npm run update-template`, and nothing comes back the other
way. So a change to one of them here reaches each site at its next update,
and replaces what that site had there:

- Keep them free of anyone's content: no names, addresses or links that
  belong in a config. They hold only the sample person.
- A change that would stop an existing site's config, its visitors' saved
  chats or its Worker's settings from working needs a way across for
  those sites. Say what it is in the pull request.

Everything else (`site.config.ts`, `examples/`, `README.md`,
`wrangler.jsonc`, `tests/ask-questions.json`, the pictures, the Japanese
font subsets and most of `.github/`) is the template's own, and no site
takes it.

## Checking a change

```sh
npm ci
npx playwright install chromium   # once, for the browser checks
npm run dev                       # the site at localhost:4321
npm run verify                    # everything CI runs, in order
```

`npm run verify` stops at the first step that fails and names the command
to rerun. Then, for what you touched:

- Anything a visitor sees: look at it at phone width too, and with
  JavaScript off.
- Anything a second language affects: add `examples/ja.ts` as the
  [README](../README.md#guides) says. Cutting its fonts needs Python with
  `pip install fonttools brotli`.
- What a host gets: set `host` to it, and run `npm run build` and
  `npm test`.
- Ask: turn it on as [Ask](../docs/ask.md#turning-it-on) says, and try it
  with `npx wrangler dev`.
- What a guide describes: change the guide. `npm test` fails while a guide
  names a file or an npm script that isn't there.

## Design

The look is inspired by the Claude app, but the project isn't affiliated
with Anthropic and uses its own sparkle mark and free fonts. Please don't
add Anthropic's logo, mascot or typefaces.
