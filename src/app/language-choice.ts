/* Which of the site's languages a visitor would read: the first of their
   browser's languages (navigator.languages, most wanted first) that the
   site has a page in. It needs no page. */

/** "ja" for "ja-JP", "pt" for "pt-BR". */
const primary = (tag: string): string => tag.toLowerCase().split("-")[0] ?? "";

/** The one of `offered` that a tag the visitor wants names: the same tag,
    or else one in the same language ("ja-JP" for "ja", "en" for "en-GB"). */
function offeredFor(wanted: string, offered: readonly string[]): string | undefined {
  const tag = wanted.toLowerCase();
  return offered.find((code) => code.toLowerCase() === tag) ?? offered.find((code) => primary(code) === primary(tag));
}

/** The first of the visitor's languages the site has, or undefined when it
    has none of them. */
export function preferredLanguage(wanted: readonly string[], offered: readonly string[]): string | undefined {
  for (const tag of wanted) {
    const code = offeredFor(tag, offered);
    if (code !== undefined) return code;
  }
  return undefined;
}
