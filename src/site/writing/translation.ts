/* A post in another language than the page's, read in the page's: on a site
   with writing.translate, a link under its card to Google Translate's
   machine translation of it (docs/writing.md). Nothing is fetched or
   translated by the build: the link is all there is. */
import type { LinkTranslation } from "../../config/blocks.ts";
import { LANGUAGE_PLACEHOLDER } from "../../config/writing.ts";
import { isInJapanese, type Post } from "./post.ts";

/** Google Translate's address for a page put into another language. */
export const GOOGLE_TRANSLATE = "https://translate.google.com/translate";

const JAPANESE = "ja";

/** A language code without its region: "en" for "en-US". */
const withoutRegion = (code: string): string => code.split("-")[0]?.toLowerCase() ?? code;

/** The language a post is in, as far as it can be told: Japanese with kana
    in its title or its text (isInJapanese), or else the site's main
    language, unless that's Japanese: then it can't be told, and it's
    undefined. */
export function postLanguage(post: Post, mainLanguage: string): string | undefined {
  if (isInJapanese(`${post.title} ${post.body ?? ""}`)) return JAPANESE;
  const main = withoutRegion(mainLanguage);
  return main === JAPANESE ? undefined : main;
}

/** A language's name in the words of another: "Japanese" for "ja" on an
    English page, "英語" for "en" on a Japanese one. The code itself, for a
    language the platform can't name. */
function languageName(code: string, pageLanguage: string): string {
  try {
    return new Intl.DisplayNames([pageLanguage], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Google Translate's machine translation of the page at `url`, from the
    language `from` into `into`, its own wording in `into` too. */
export function translationAddress(url: string, from: string, into: string): string {
  const query = new URLSearchParams({ sl: from, tl: into, hl: into, u: url });
  return `${GOOGLE_TRANSLATE}?${query.toString()}`;
}

/** What a page in one language says a translation with. */
export type TranslationWording = {
  /** The page's language: "en". */
  pageLanguage: string;
  /** The site's main language, which a post with no kana is taken to be in. */
  mainLanguage: string;
  /** strings.writingTranslation. */
  wording: string;
};

/** The link under a post's card to its translation into the page's
    language. None for a post in the page's language, or in one that can't
    be told (postLanguage). */
export function postTranslation(post: Post, page: TranslationWording): LinkTranslation | undefined {
  const from = postLanguage(post, page.mainLanguage);
  const into = withoutRegion(page.pageLanguage);
  if (from === undefined || from === into) return undefined;
  return {
    label: page.wording.replaceAll(LANGUAGE_PLACEHOLDER, languageName(from, page.pageLanguage)),
    href: translationAddress(post.url, from, into),
  };
}
