/* The Writing tab, made from the posts the build fetched: a thread like the
   config's own, the same in every language but for the wording around the
   posts, and a row in the sidebar that opens it. */
import type { Block, LinkCard } from "../../config/blocks.ts";
import type { Thread } from "../../config/language.ts";
import type { Sidebar } from "../../config/sidebar.ts";
import type { Strings } from "../../config/strings.ts";
import { WRITING_ICON, WRITING_TAB } from "../../config/writing.ts";
import { dayPosted, type Post } from "./post.ts";

/** Kana. A title with any is Japanese; one with kanji alone could be
    Chinese as well, so it isn't marked. */
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

/** The language a post's title is in, where it isn't the page's and can be
    told from the title: "ja", or undefined. */
function titleLanguage(title: string, pageLanguage: string): string | undefined {
  const isJapanese = KANA.test(title);
  const pageIsJapanese = pageLanguage.split("-")[0] === "ja";
  return isJapanese && !pageIsJapanese ? "ja" : undefined;
}

/** The day as the page's language writes it: "Oct 1, 2026", "2026/10/01".
    Written as Qiita has it ("2026-10-01") for a language the platform
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

/** A post as a link card: its title, over the day, its LGTMs and its tags
    ("Oct 1, 2026 · 12 LGTM · TypeScript, Astro"). */
export function postCard(post: Post, pageLanguage: string): LinkCard {
  const kind = [dayInWords(dayPosted(post), pageLanguage), `${post.likes} LGTM`, post.tags.join(", ")];
  return {
    name: post.title,
    kind: kind.filter(Boolean).join(" · "),
    href: post.url,
    icon: WRITING_ICON,
    lang: titleLanguage(post.title, pageLanguage),
  };
}

/** The tab in one language's words: its question, then the posts newest
    first under a line that says so, or a line that there are none. A
    string the language leaves out is "", for the config's checks to name. */
export function writingThread(posts: Post[], strings: Strings, pageLanguage: string): Thread {
  const answer: Block[] = posts.length
    ? [strings.writingIntro ?? "", ...posts.map((post) => ({ link: postCard(post, pageLanguage) }))]
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
