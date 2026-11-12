#!/usr/bin/env python3
"""The Japanese page's fonts, cut down to the characters it uses.

    npm run fonts          rebuild both fonts
    npm run fonts:check    fail if the Japanese page uses a character its
                           font doesn't have

(scripts/fonts.ts runs this file, on a site that has a Japanese page.)

The Japanese page is the built one in Japanese (lang="ja", or "ja-JP" and
the like); a site without one needs no Japanese fonts. Noto Sans JP gets
every character the page and 404.html show in Japanese, Noto Serif JP only
those of what the stylesheet sets in the serif. Both read dist/, so run
`npm run build` first, and again after a rebuild. Needs fonttools and brotli
(pip install fonttools brotli).

A rebuild downloads each font from Google Fonts and writes it over the one
in public/assets/fonts; the check only reads. Either prints a line a font.
"""

import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import NamedTuple

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    import brotli  # noqa: F401 (fontTools needs it to read and write WOFF2)
except ImportError as missing:
    sys.exit(f"The Japanese fonts need fonttools and brotli ({missing}): pip install fonttools brotli")

REPO_DIR = Path(__file__).resolve().parent.parent
# The built pages (run `npm run build` first).
BUILT_SITE_DIR = REPO_DIR / "dist"
NOT_FOUND_PAGE = BUILT_SITE_DIR / "404.html"
# The fonts are source files: the build copies public/ into the site as it is.
FONTS_DIR = REPO_DIR / "public" / "assets" / "fonts"


class JapaneseFont(NamedTuple):
    """One of the two font files, and what it's cut from."""

    # Where the cut-down font is kept.
    file: Path
    # Its family, as a Google Fonts address writes it: "Noto+Sans+JP".
    google_family: str
    # The weights its @font-face rule gives it (src/styles/fonts.css): one
    # ("400"), or the two ends of a variable font's range ("300..900").
    weights: str
    # What it sets, as the check's lines say it.
    used_by: str


SANS = JapaneseFont(FONTS_DIR / "noto-sans-jp.woff2", "Noto+Sans+JP", "300..900", "the Japanese text")
SERIF = JapaneseFont(FONTS_DIR / "noto-serif-jp.woff2", "Noto+Serif+JP", "400", "the Japanese in the serif")

# What the stylesheet sets in var(--serif), by class (src/styles): the
# greeting and the goodbye (.hello), the name in the sidebar (.wordmark, and
# a new chat's heading, which the script copies from it), the clock, and the
# name at the top of a printout. The goodbye's title and the greeting's
# other times of day are in data-* attributes until the script shows them.
SERIF_CLASSES = ["hello", "wordmark", "clock-time", "print-name"]
SERIF_DATA_PREFIXES = ["data-greet-", "data-bye-title"]

# "~", where printable ASCII ends. The Latin fonts have everything up to it,
# so the Japanese fonts need only what comes after.
LAST_PRINTABLE_ASCII = 0x7E
# Unicode's blocks of emoji, and the two invisible characters that go with
# them: the joiner that makes one emoji of several, and the selector that
# asks for a character's emoji form.
FIRST_EMOJI = 0x1F000
LAST_EMOJI = 0x1FAFF
EMOJI_JOINER_AND_SELECTOR = "\u200d\ufe0f"

# The lang attribute of something in Japanese: lang="ja", or Japanese with a
# region or script, lang="ja-JP". A part of the two patterns after it.
JAPANESE_LANG = r'\blang="ja(?:-[\w-]+)?"'
# The start of a page that is in Japanese: <html lang="ja" dir="ltr" …
JAPANESE_HTML_TAG = re.compile(r"<html\s[^>]*" + JAPANESE_LANG)
# An element marked as Japanese on a page that isn't, with its tag's name
# and its contents: <p class="intro" lang="ja">このアドレスには何もありません。</p>
JAPANESE_ELEMENT = re.compile(r"<(\w+)\b[^>]*" + JAPANESE_LANG + r"[^>]*>(.*?)</\1>", flags=re.S)
# An element with one of the serif's classes among its own (so not
# class="hello-wrap"), with its tag's name and its contents:
# <h1 class="hello" id="hello">こんにちは。</h1>
ANY_SERIF_CLASS = "|".join(SERIF_CLASSES)
SERIF_ELEMENT = re.compile(
    rf'<(\w+)\b[^>]*\bclass="(?:[^"]*\s)?(?:{ANY_SERIF_CLASS})(?:\s[^"]*)?"[^>]*>(.*?)</\1>',
    flags=re.S,
)
# Any tag, opening or closing: <p class="intro">, </p>
HTML_TAG = re.compile(r"<[^>]+>")
# A script element and all that's in it: <script type="module" src="/_astro/app.js"></script>
SCRIPT_ELEMENT = re.compile(r"<script\b.*?</script>", flags=re.S)
# A block of data for the page's script, with the JSON in it:
# <script type="application/json" id="questions">{"title": "…"}</script>
JSON_DATA_BLOCK = re.compile(r'<script type="application/json"[^>]*>(.*?)</script>', flags=re.S)

# The stylesheet Google Fonts writes for a family, and the font file's
# address in it: url(https://fonts.gstatic.com/l/font?kit=…)
GOOGLE_FONTS_STYLESHEET = "https://fonts.googleapis.com/css2"
FONT_FILE_URL = re.compile(r"url\((https://fonts\.gstatic\.com/[^)]+)\)")
# A browser that's sent WOFF2 (and the variable font) by the API.
BROWSER_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)


def main(arguments):
    """Checks the two fonts, if --check is among the arguments, or rebuilds
    them. Returns the exit code."""
    japanese_page = find_japanese_page()
    if japanese_page is None:
        print("No Japanese page, so no Japanese fonts to build.")
        return 0
    if "--check" in arguments:
        return 0 if fonts_have_their_characters(japanese_page) else 1
    build_font(SANS, sans_characters(japanese_page))
    build_font(SERIF, serif_characters(japanese_page))
    return 0


def find_japanese_page():
    """The page the build wrote in Japanese, or None if it wrote none: the
    home page if that's Japanese, or else the first language's page that
    is, taking their folders in order of name."""
    pages = [BUILT_SITE_DIR / "index.html", *sorted(BUILT_SITE_DIR.glob("*/index.html"))]
    for page in pages:
        if page.exists() and is_japanese_page(page.read_text(encoding="utf-8")):
            return page
    return None


def is_japanese_page(page_html):
    """Whether a page, as its <html> tag says, is in Japanese."""
    return JAPANESE_HTML_TAG.search(page_html) is not None


# ---- Which characters each font needs ----------------------------------------


def sans_characters(japanese_page):
    """The characters Noto Sans JP needs, in order: all that the Japanese
    page shows, and the 404 page's Japanese."""
    return sorted(page_characters(japanese_page) | not_found_page_characters())


def serif_characters(japanese_page):
    """The characters Noto Serif JP needs, in order: those of the serif's
    elements on the Japanese page, and on 404.html if it's Japanese too."""
    pages_html = [japanese_page.read_text(encoding="utf-8")]
    if NOT_FOUND_PAGE.exists():
        pages_html.append(NOT_FOUND_PAGE.read_text(encoding="utf-8"))
    serif_texts = [serif_text(page_html) for page_html in pages_html if is_japanese_page(page_html)]
    return sorted(characters_needing_a_font(" ".join(serif_texts)))


def page_characters(page):
    """Every character outside ASCII that a page puts on screen: its body's
    text, the wording its data-* attributes hold, and the question card's
    data that the script shows (a JSON block in the page)."""
    page_html = page.read_text(encoding="utf-8")
    body = page_html[page_html.index("<body>"):]
    body_text = text_of(SCRIPT_ELEMENT.sub("", body))
    return characters_needing_a_font(body_text + data_attribute_text(page_html) + json_block_text(body))


def not_found_page_characters():
    """The 404 page's Japanese: all of it, or the lines marked lang="ja"."""
    if not NOT_FOUND_PAGE.exists():
        return set()
    page_html = NOT_FOUND_PAGE.read_text(encoding="utf-8")
    if is_japanese_page(page_html):
        return page_characters(NOT_FOUND_PAGE)
    japanese_lines = [text_of(contents) for _tag_name, contents in JAPANESE_ELEMENT.findall(page_html)]
    return characters_needing_a_font(" ".join(japanese_lines))


def serif_text(page_html):
    """The text of a page's serif elements, and what the script shows in them."""
    in_elements = [text_of(contents) for _tag_name, contents in SERIF_ELEMENT.findall(page_html)]
    in_data_attributes = [data_attribute_text(page_html, prefix) for prefix in SERIF_DATA_PREFIXES]
    return " ".join(in_elements + in_data_attributes)


def text_of(markup):
    """A piece of HTML as text: a space for each tag, and its entities
    (&amp;, &#x3042;) as the characters they stand for."""
    return html.unescape(HTML_TAG.sub(" ", markup))


def data_attribute_text(page_html, attribute_prefix="data-"):
    """Text a page keeps in data-* attributes for its script to put on
    screen: every such attribute's, or only those whose name starts with
    `attribute_prefix`."""
    values = re.findall(rf'\b{attribute_prefix}[\w-]*="([^"]*)"', page_html)
    return " ".join(html.unescape(value) for value in values)


def json_block_text(body):
    """The text in a page's JSON data blocks: every string in them, at any depth."""
    return " ".join(
        " ".join(strings_in(json.loads(block_json))) for block_json in JSON_DATA_BLOCK.findall(body)
    )


def strings_in(json_value):
    """Yields each string in a parsed JSON value: itself, a list's items or
    an object's values, however deep. Not an object's keys, which the page
    doesn't show."""
    if isinstance(json_value, str):
        yield json_value
    elif isinstance(json_value, list):
        for item in json_value:
            yield from strings_in(item)
    elif isinstance(json_value, dict):
        for item in json_value.values():
            yield from strings_in(item)


def characters_needing_a_font(text):
    """The characters of a text that a Japanese font has to have: those
    after ASCII (all of which the Latin fonts have), less spaces and emoji."""
    return {
        character
        for character in text
        if ord(character) > LAST_PRINTABLE_ASCII and not character.isspace() and not is_emoji(character)
    }


def is_emoji(character):
    """Emoji come from the system's emoji font, not ours."""
    return FIRST_EMOJI <= ord(character) <= LAST_EMOJI or character in EMOJI_JOINER_AND_SELECTOR


# ---- npm run fonts:check -----------------------------------------------------


def fonts_have_their_characters(japanese_page):
    """Checks both fonts, saying what it found of each. True if neither
    lacks a character."""
    sans_is_complete = font_has_characters(SANS, sans_characters(japanese_page))
    serif_is_complete = font_has_characters(SERIF, serif_characters(japanese_page))
    return sans_is_complete and serif_is_complete


def font_has_characters(font, characters):
    """Says whether the font's file has a glyph for every character, and
    which it lacks if not. True if it has them all."""
    code_points_in_font = TTFont(font.file).getBestCmap()
    missing = [character for character in characters if ord(character) not in code_points_in_font]
    if missing:
        print(f"{font.file.relative_to(REPO_DIR)} is missing {''.join(missing)} — run `npm run fonts`")
        return False
    print(f"{font.file.relative_to(REPO_DIR)} has all {len(characters)} characters used by {font.used_by}")
    return True


# ---- npm run fonts -----------------------------------------------------------


def build_font(font, characters):
    """Downloads the font with just these characters, strips what the site
    doesn't use of it, and writes it over the font's file."""
    text = "".join(characters)
    downloaded_font = download_font(font.google_family, font.weights, text)
    site_font = limit_to_weights(downloaded_font, font.weights)
    subsetter = subset.Subsetter(subset_options())
    subsetter.populate(text=text)
    subsetter.subset(site_font)
    site_font.save(font.file)
    size = font.file.stat().st_size
    print(f"{font.file.relative_to(REPO_DIR)}: {len(characters)} characters, {size:,} bytes")


def download_font(google_family, weights, text):
    """Asks Google Fonts for the family in these weights and opens the font
    it sends. Given a `text`, the API writes a stylesheet with one font file
    in it, which has those characters and no others."""
    stylesheet_url = (
        f"{GOOGLE_FONTS_STYLESHEET}?family={google_family}:wght@{weights}&text="
        + urllib.parse.quote(text)
    )
    stylesheet = fetch(stylesheet_url).decode()
    font_file_url = FONT_FILE_URL.search(stylesheet).group(1)
    return TTFont(io.BytesIO(fetch(font_file_url)))


def fetch(url):
    """What's at an address, in bytes, as a browser would be sent it."""
    request = urllib.request.Request(url, headers={"User-Agent": BROWSER_USER_AGENT})
    with urllib.request.urlopen(request) as response:
        return response.read()


def limit_to_weights(opened_font, weights):
    """A variable font with its weight axis cut down to `weights`: a range
    ("300..900") or one weight ("400"), which leaves it not variable at all.
    A font that was sent with one weight only is returned as it is."""
    is_variable = "fvar" in opened_font
    if not is_variable:
        return opened_font
    lightest, _, heaviest = weights.partition("..")
    weight_limits = (int(lightest), int(heaviest)) if heaviest else int(lightest)
    return instancer.instantiateVariableFont(opened_font, {"wght": weight_limits})


def subset_options():
    """What the subsetter keeps of a font, besides the glyphs asked for. The
    same options give the same font: change one, and every site's fonts
    change when next rebuilt."""
    options = subset.Options()
    # Kerning, and the spacing of Japanese punctuation and kana: palt, which
    # the stylesheet turns on (src/styles/japanese.css), and halt. No other
    # OpenType feature.
    options.layout_features = ["kern", "palt", "halt"]
    # The tables for text set top to bottom, which the site never does.
    options.drop_tables += ["vhea", "vmtx", "VORG"]
    # No instructions for fitting glyphs to a coarse pixel grid.
    options.hinting = False
    # For a font with CFF outlines: each written out in full, not as shared
    # subroutines, which tends to compress better as WOFF2. (Google sends
    # these two with TrueType outlines, which have none.)
    options.desubroutinize = True
    # Every name record, not only the first seven the subsetter keeps by
    # default: the licence's address is one of the others.
    options.name_IDs = ["*"]
    options.flavor = "woff2"
    return options


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
