# Languages and fonts

The first language in `languages` is the site's main one, at `/`. Each
other one is at `/<code>/`, with a switch in the sidebar.

## Adding a language

A language is one `Language` object (`src/config/language.ts`): everything
one language's page says. Write it in a file of its own beside the config
and import it:

```ts
// site.config.ts
import japanese from "./examples/ja.ts";

export default {
  // …
  languages: { en: { /* … */ }, ja: japanese(me) },
} satisfies SiteConfig;
```

It needs the same thread ids as the main language, as many answers in
each thread, and the same personal answers and home prompts, in the same
order: the build says so when it doesn't. Its `strings` are its own
wording of the interface, every one of them: the defaults in
`src/config/english-strings.ts` are English only, and the build names a
string a page in another language leaves out. `examples/ja.ts` is the
sample's whole page in Japanese, to copy. With more than one language, each also needs
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
npm run fonts   # downloads the pinned source fonts, and cuts them
npm run build
```

The fonts are cut in TypeScript (`scripts/fonts.ts`, `scripts/fonts/`),
so this needs nothing but `npm ci`. `npm run fonts:check`, a step of
`npm run verify`, fails while the built page uses a character the fonts
lack; it reads `dist/`, and says so when there is no build. A site with
no Japanese page needs none of this.

## Letters the bundled fonts lack

The bundled Latin fonts (Inter, Source Serif 4, Geist Mono) cover Western
European letters only. Other letters (ł, ş, Greek, Cyrillic, Arabic…) show
in the visitor's system font, which works but looks different. To ship a
font for them, put its `.woff2` file in `public/assets/` and an
`@font-face` for it in `src/styles/site.css`, which is yours and loads
last.
