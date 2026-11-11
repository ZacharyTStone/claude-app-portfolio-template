/* The config's little Markdown (content.ts's Markdown), read one way by
   everything that reads it: the pages (Inline.astro), the browser
   (src/app/lib/markdown.ts), ask.json and llms.txt, and the config's checks. */

import type { Markdown } from "./content.ts";

/** A piece of a line: words, `code`, or **bold**, *italic* or a
    [link](href), which can hold the other pieces. */
export type Span =
  | string
  | { type: "code"; text: string }
  | { type: "strong"; spans: Span[] }
  | { type: "em"; spans: Span[] }
  | { type: "link"; href: string; spans: Span[] };

// The match furthest left wins, and at one place the earlier alternative:
// "**" starts bold, not two italics.
const SPAN = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;

export function spans(text: Markdown): Span[] {
  const found: Span[] = [];
  let last = 0;
  for (const match of text.matchAll(SPAN)) {
    const [whole, bold, italic, code, label, href] = match;
    if (match.index > last) found.push(text.slice(last, match.index));
    if (bold !== undefined) found.push({ type: "strong", spans: spans(bold) });
    else if (italic !== undefined) found.push({ type: "em", spans: spans(italic) });
    else if (code !== undefined) found.push({ type: "code", text: code });
    else if (label !== undefined && href !== undefined) found.push({ type: "link", href, spans: spans(label) });
    last = match.index + whole.length;
  }
  if (last < text.length) found.push(text.slice(last));
  return found;
}

/** The words alone, for ask.json and llms.txt. */
export const plainText = (text: Markdown): string => words(spans(text));

const words = (list: Span[]): string =>
  list
    .map((span) => {
      if (typeof span === "string") return span;
      return span.type === "code" ? span.text : words(span.spans);
    })
    .join("");

/** Every link's href, as the pages and the browser get it. */
export const hrefsIn = (text: Markdown): string[] => hrefs(spans(text));

const hrefs = (list: Span[]): string[] =>
  list.flatMap((span) => {
    if (typeof span === "string" || span.type === "code") return [];
    return span.type === "link" ? [span.href, ...hrefs(span.spans)] : hrefs(span.spans);
  });

/** A link to another site opens in a new tab, and tells it nothing. */
export const external = (href: string): { target?: string; rel?: string } =>
  /^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};

/** Whether the browser follows a link in the text it shows (a personal
    answer, the script's words): a #tab, a web or a mailto address. It
    doesn't know the site's path, so it can't link to a file on the site;
    any other link is shown as its words. */
export const browserFollows = (href: string): boolean => /^(#|https?:|mailto:)/i.test(href);
