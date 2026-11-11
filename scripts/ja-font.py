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
"""

import html
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    import brotli  # noqa: F401 (fontTools needs it to read and write WOFF2)
except ImportError as missing:
    sys.exit(f"The Japanese fonts need fonttools and brotli ({missing}): pip install fonttools brotli")

REPO = Path(__file__).resolve().parent.parent
# The built pages (run `npm run build` first), and the fonts, which are
# source files: the build copies public/ into the site as it is.
ROOT = REPO / "dist"
NOT_FOUND = ROOT / "404.html"
FONTS = REPO / "public" / "assets" / "fonts"
SANS = FONTS / "noto-sans-jp.woff2"
SERIF = FONTS / "noto-serif-jp.woff2"
# A browser that's sent WOFF2 (and the variable font) by the API.
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
# lang="ja", or a Japanese with a region or script: "ja-JP".
JA = r'\blang="ja(?:-[\w-]+)?"'

# What the stylesheet sets in var(--serif), by class (src/styles): the
# greeting and the goodbye (.hello), the name in the sidebar (.wordmark, and
# a new chat's heading, which the script copies from it), the clock, and the
# name at the top of a printout. The goodbye's title and the greeting's
# other times of day are in data-* attributes until the script shows them.
SERIF_CLASSES = ["hello", "wordmark", "clock-time", "print-name"]
SERIF_DATA = ["data-greet-", "data-bye-title"]


def is_emoji(c):
    """Emoji come from the system's emoji font, not ours."""
    return 0x1F000 <= ord(c) <= 0x1FAFF or c in "‍️"


def non_ascii(text):
    return {c for c in text if ord(c) > 0x7E and not c.isspace() and not is_emoji(c)}


def data_values(src, prefix="data-"):
    """Text a page keeps in data-* attributes for its script to put on screen."""
    return " ".join(html.unescape(v) for v in re.findall(rf'\b{prefix}[\w-]*="([^"]*)"', src))


def json_strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from json_strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from json_strings(item)


def is_japanese(src):
    return re.search(r"<html\s[^>]*" + JA, src) is not None


def japanese_page():
    """The page the build wrote in Japanese, if there is one."""
    for page in [ROOT / "index.html", *sorted(ROOT.glob("*/index.html"))]:
        if page.exists() and is_japanese(page.read_text(encoding="utf-8")):
            return page
    return None


def text_of(markup):
    return html.unescape(re.sub(r"<[^>]+>", " ", markup))


def page_chars(page):
    """Every character outside ASCII that a page puts on screen, including
    the question card's data that the script shows (a JSON block in the page)."""
    src = page.read_text(encoding="utf-8")
    body = src[src.index("<body>"):]
    data = " ".join(
        " ".join(json_strings(json.loads(block)))
        for block in re.findall(r'<script type="application/json"[^>]*>(.*?)</script>', body, flags=re.S)
    )
    body = re.sub(r"<script\b.*?</script>", "", body, flags=re.S)
    return non_ascii(text_of(body) + data_values(src) + data)


def not_found_chars():
    """The 404 page's Japanese: all of it, or the lines marked lang="ja"."""
    if not NOT_FOUND.exists():
        return set()
    src = NOT_FOUND.read_text(encoding="utf-8")
    if is_japanese(src):
        return page_chars(NOT_FOUND)
    lines = re.findall(r"<(\w+)\b[^>]*" + JA + r"[^>]*>(.*?)</\1>", src, flags=re.S)
    return non_ascii(" ".join(text_of(inner) for _, inner in lines))


def sans_chars(page):
    return sorted(page_chars(page) | not_found_chars())


def serif_text(src):
    """The text of a page's serif elements, and what the script shows in them."""
    classes = "|".join(SERIF_CLASSES)
    tag = rf'<(\w+)\b[^>]*\bclass="(?:[^"]*\s)?(?:{classes})(?:\s[^"]*)?"[^>]*>(.*?)</\1>'
    shown = [text_of(inner) for _, inner in re.findall(tag, src, flags=re.S)]
    return " ".join(shown + [data_values(src, prefix) for prefix in SERIF_DATA])


def serif_chars(page):
    """The serif's characters on the Japanese page, and on 404.html if it's Japanese too."""
    sources = [page.read_text(encoding="utf-8")]
    if NOT_FOUND.exists():
        sources.append(NOT_FOUND.read_text(encoding="utf-8"))
    return sorted(non_ascii(" ".join(serif_text(src) for src in sources if is_japanese(src))))


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as res:
        return res.read()


def build(family, axis, chars, out):
    text = "".join(chars)
    css = fetch(
        f"https://fonts.googleapis.com/css2?family={family}:wght@{axis}&text="
        + urllib.parse.quote(text)
    ).decode()
    src = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css).group(1)
    font = TTFont(io.BytesIO(fetch(src)))
    if "fvar" in font:
        low, _, high = axis.partition("..")
        font = instancer.instantiateVariableFont(
            font, {"wght": (int(low), int(high)) if high else int(low)}
        )
    options = subset.Options()
    options.layout_features = ["kern", "palt", "halt"]
    options.drop_tables += ["vhea", "vmtx", "VORG"]
    options.hinting = False
    options.desubroutinize = True
    options.name_IDs = ["*"]
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.save(out)
    print(f"{out.relative_to(REPO)}: {len(chars)} characters, {out.stat().st_size:,} bytes")


def check(chars, font, what):
    cmap = TTFont(font).getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap]
    if missing:
        print(f"{font.relative_to(REPO)} is missing {''.join(missing)} — run `npm run fonts`")
        return False
    print(f"{font.relative_to(REPO)} has all {len(chars)} characters used by {what}")
    return True


if __name__ == "__main__":
    page = japanese_page()
    if page is None:
        print("No Japanese page, so no Japanese fonts to build.")
        sys.exit(0)
    if "--check" in sys.argv[1:]:
        ok = check(sans_chars(page), SANS, "the Japanese text")
        ok = check(serif_chars(page), SERIF, "the Japanese in the serif") and ok
        sys.exit(0 if ok else 1)
    build("Noto+Sans+JP", "300..900", sans_chars(page), SANS)
    build("Noto+Serif+JP", "400", serif_chars(page), SERIF)
