/* The Writing tab, made from the posts the build fetched: a thread like the
   config's own, the same in every language but for the wording around the
   posts, and a row in the sidebar that opens it. */
import type { Block, LinkCard } from "../../config/blocks.ts";
import type { Thread } from "../../config/language.ts";
import type { Sidebar } from "../../config/sidebar.ts";
import type { Strings } from "../../config/strings.ts";
import { WRITING_ICON, WRITING_TAB } from "../../config/writing.ts";
import { dayPosted, isInJapanese, type Post } from "./post.ts";
import { postTranslation } from "./translation.ts";

/** The language a post's title is in, where it isn't the page's and can be
    told from the title: "ja", or undefined. A title in kanji alone isn't
    marked (isInJapanese). */
function titleLanguage(title: string, pageLanguage: string): string | undefined {
  const pageIsJapanese = pageLanguage.split("-")[0] === "ja";
  return isInJapanese(title) && !pageIsJapanese ? "ja" : undefined;
}

/** The day as the page's language writes it: "Oct 1, 2026", "2026/10/01".
    Written as the post has it ("2026-10-01") for a language the platform
    doesn't know. */
function dayInWords(day: string, pageLanguage: string): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  try {
    return new Intl.DateTimeFormat(pageLanguage, { dateStyle: "medium", timeZone: "UTC" }).format(
      Date.UTC(year, month - 1, date),
    );
  } catch {
    return day;
  }
}

/** How a card says a post's likes, in the page's language: "12 LGTM" on
    Qiita, "1,527 likes" (strings.writingLikes) elsewhere; nothing where the
    place doesn't count them. */
function likesInWords(post: Post, strings: Strings, pageLanguage: string): string {
  if (!post.likes) return "";
  return `${countInWords(post.likes.count, pageLanguage)} ${post.likes.word ?? strings.writingLikes ?? ""}`;
}

/** A count as the page's language writes it: "1,527", or "1527" in a
    language the platform doesn't know. */
function countInWords(count: number, pageLanguage: string): string {
  try {
    return new Intl.NumberFormat(pageLanguage).format(count);
  } catch {
    return String(count);
  }
}

/** On a site with writing.translate: its main language, which a post with
    no kana is taken to be in (translation.ts). */
export type Translating = { mainLanguage: string };

/** What a card is shown with: the page's language and wording, whether
    the tab has posts from more than one place, so each card names its own,
    and, on a site with writing.translate, what a post's language is told
    by. */
export type CardWording = { pageLanguage: string; strings: Strings; namesPlace: boolean; translating?: Translating };

/** A post as a link card: its title, over the day, where it was posted (in a
    tab with more than one place), its likes and its tags
    ("Oct 1, 2026 · Zenn · 12 likes · TypeScript, Astro"); and under it, for
    a post in another language on a site with writing.translate, a link to
    its translation. */
export function postCard(post: Post, { pageLanguage, strings, namesPlace, translating }: CardWording): LinkCard {
  const day = dayInWords(dayPosted(post), pageLanguage);
  const kind = [day, namesPlace ? post.place : "", likesInWords(post, strings, pageLanguage), post.tags.join(", ")];
  const translation =
    translating && postTranslation(post, { pageLanguage, ...translating, wording: strings.writingTranslation ?? "" });
  return {
    name: post.title,
    kind: kind.filter(Boolean).join(" · "),
    href: post.url,
    icon: WRITING_ICON,
    lang: titleLanguage(post.title, pageLanguage),
    ...(translation ? { translation } : {}),
  };
}

/** Whether the posts come from more than one place. */
export const comeFromPlaces = (posts: Post[]): boolean => new Set(posts.map((post) => post.place)).size > 1;

/** The tab in one language's words: its question, then the posts newest
    first under a line that says so, or a line that there are none. A
    string the language leaves out is "", for the config's checks to name.
    `translating` is there on a site with writing.translate. */
export function writingThread(
  posts: Post[],
  strings: Strings,
  pageLanguage: string,
  translating?: Translating,
): Thread {
  const wording = { pageLanguage, strings, namesPlace: comeFromPlaces(posts), ...(translating ? { translating } : {}) };
  const answer: Block[] = posts.length
    ? [strings.writingIntro ?? "", ...posts.map((post) => ({ link: postCard(post, wording) }))]
    : [strings.writingEmpty ?? ""];
  return {
    id: WRITING_TAB,
    title: strings.writingTitle ?? "",
    messages: [{ q: strings.writingQuestion ?? "", a: answer }],
  };
}

/** The sidebar with a row for the tab, last of the rows at its top: unless
    a row opens the tab already, where the config wants it. */
export function withWritingRow(sidebar: Sidebar, strings: Strings): Sidebar {
  const rows = [...sidebar.nav, ...sidebar.groups.flatMap((group) => group.tabs)];
  if (rows.some((row) => row.tab === WRITING_TAB)) return sidebar;
  const row = { tab: WRITING_TAB, icon: WRITING_ICON, label: strings.writingTitle ?? "" };
  return { ...sidebar, nav: [...sidebar.nav, row] };
}
