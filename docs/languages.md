# Languages and fonts

The first language in `languages` is the site's main one, at `/`. Each
other one is at `/<code>/`, with a switch in the sidebar.

## Adding a language

A language is one `Language` object (`src/config/language.ts`): everything
one language's page says. Write it in a file of its own beside the config
and import it:

```ts
// site.config.ts
import japanese from "./ja.ts";

export default {
  // …
  languages: { en: { /* … */ }, ja: japanese(me) },
} satisfies SiteConfig;
```

It needs the same thread ids as the main language, as many answers in
each thread, and the same personal answers and home prompts, in the same
order: the build says so when it doesn't. Its `strings` are its own
wording of the interface. With more than one language, each also needs
`account.language`, the name of the menu row that switches. A
right-to-left language sets `dir: "rtl"`.

A [diagram](diagrams.md) has each language's words in its `words`, and
writes a file for each.

## Japanese fonts

Japanese fonts are large, so the site ships two cut down to the
characters its Japanese page uses: the files in `public/assets/fonts/`
whose names start `noto-`. They are yours, and committed. After adding or
changing Japanese text, cut them again:

```sh
npm run build   # the fonts are cut from the built page
npm run fonts   # needs Python: pip install fonttools brotli
npm run build
```

`npm run fonts:check`, a step of `npm run verify`, fails while the page
uses a character the fonts lack. A site with no Japanese page needs none
of this, and no Python.

## Letters the bundled fonts lack

The bundled Latin fonts (Inter, Source Serif 4, Geist Mono) cover Western
European letters only. Other letters (ł, ş, Greek, Cyrillic, Arabic…) show
in the visitor's system font, which works but looks different. To ship a
font for them, put its `.woff2` file in `public/assets/` and an
`@font-face` for it in `src/styles/site.css`, which is yours and loads
last.
