# Languages and fonts

The first language in `languages` is the site's main one, at `/`, with
each tab's page at `/<id>/`. Each other one is at `/<code>/`, its tabs'
pages at `/<code>/<id>/`, with a switch in the sidebar that goes to the
tab that's open in the other language.

## A visitor's own language

A visitor who comes in at a page in the main language, from another site
or a typed address, and whose browser lists one of the site's other
languages before it (`navigator.languages`: "ja-JP" finds `ja`), is sent to
that language's version of the page, the same tab open, before the page
starts. Once they follow a language link themselves (the sidebar's switch,
the account menu's row), that's their pick, kept in this browser, and
they're never sent anywhere again. Nobody is sent from a page in another
language, from a link on the site, on a refresh or Back, or from a chat's
address (`/#chat-…`). Without JavaScript every visitor stays where they
came in, and search engines find each version by the page's `hreflang`
links as before. A site in one language does nothing.

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

The posts a [Writing tab](writing.md#japanese-fonts) lists are left out:
they change at every build, so the fonts aren't cut for them, the check
doesn't ask for them, and they're set in the system's Japanese font.

The fonts are cut in TypeScript (`scripts/fonts.ts`, `scripts/fonts/`),
so this needs nothing but `npm ci`. `npm run fonts:check`, a step of
`npm run verify`, fails while the built page uses a character the fonts
lack; it reads `dist/`, and says so when there is no build. A site with
no Japanese page needs none of this.

## The serif

Source Serif 4 sets a few large titles: the greeting, the name atop the
sidebar, a chat's name, the clocks. It's cut down too, but to a fixed set
of characters rather than to what the pages use, since a greeting, a name
or the time can change at any build: Basic Latin, Latin-1 (é, ñ, ß, ø…),
Œ œ ı, and the spaces, dashes, quotes and signs Western European text
uses, as `scripts/fonts/latin.ts` lists them. `src/styles/fonts.css` gives
it the same set as its `unicode-range`, so a browser never asks it for a
character it hasn't. It's cut to weights from 400 up and sizes from 20px
up: a lighter or smaller serif of your own in `src/styles/site.css` is
drawn at 400 or as at 20px.

The file is the same on every site, so it's shared, and an update brings
it: a site never cuts it. `npm run fonts` cuts it again all the same, to
the same file, and `npm run fonts:check` fails if it lacks a character of
its set.

## Letters the bundled fonts lack

The bundled Latin fonts (Inter, Source Serif 4, Geist Mono) cover Western
European letters only ([The serif](#the-serif) has the serif's set). Other
letters (ł, ş, Greek, Cyrillic, Arabic…), and in the serif an accent typed
on its own after its letter, show in the visitor's system font, which
works but looks different. To ship a font for them, put its `.woff2` file
in `public/assets/` and an `@font-face` for it in `src/styles/site.css`,
which is yours and loads last.
