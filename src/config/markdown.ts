/* The config's little Markdown, read one way by
   everything that reads it: the pages (Inline.astro), the browser
   (src/app/lib/markdown.ts), ask.json and llms.txt, and the config's checks.
   It is read into pieces (Span), never into HTML: each side makes its own
   elements or text from the pieces, so no markup in the config's text can
   reach a page. */

/** Text with a little Markdown: **bold**, *italic*, `code`
    and [links](#thread, https://…, mailto:… or /a/file/on/the/site). Never
    HTML. */
export type Markdown = string;

/** A piece of a line: words, `code`, or **bold**, *italic* or a
    [link](href), which can hold the other pieces. */
export type Span =
  | string
  | { type: "code"; text: string }
  | { type: "strong"; spans: Span[] }
  | { type: "em"; spans: Span[] }
  | { type: "link"; href: string; spans: Span[] };

// One piece of markup, with what's inside it in a group of its own:
//   **bold**        → group 1, "bold"
//   *italic*        → group 2, "italic"
//   `code`          → group 3, "code"
//   [label](href)   → groups 4 and 5, "label" and "href"
// The match furthest left wins, and at one place the earlier alternative:
// "**" starts bold, not two italics.
const MARKUP = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;

/** A line of Markdown as its pieces, in order:
    spans("**Hi**, see [my work](#work)") is
    [{ type: "strong", spans: ["Hi"] }, ", see ", { type: "link", href: "#work", spans: ["my work"] }].
    Bold, italic and a link's label are read for the pieces inside them;
    code is kept as it's typed. Markup that's never closed ("2 * 3") stays
    as the characters it is. */
export function spans(text: Markdown): Span[] {
  const pieces: Span[] = [];
  let readUpTo = 0;
  for (const match of text.matchAll(MARKUP)) {
    const [matched, bold, italic, code, label, href] = match;
    if (match.index > readUpTo) pieces.push(text.slice(readUpTo, match.index));
    if (bold !== undefined) pieces.push({ type: "strong", spans: spans(bold) });
    else if (italic !== undefined) pieces.push({ type: "em", spans: spans(italic) });
    else if (code !== undefined) pieces.push({ type: "code", text: code });
    else if (label !== undefined && href !== undefined) pieces.push({ type: "link", href, spans: spans(label) });
    readUpTo = match.index + matched.length;
  }
  if (readUpTo < text.length) pieces.push(text.slice(readUpTo));
  return pieces;
}

/** The words alone, for ask.json and llms.txt: plainText("**Hi**, see
    [my work](#work)") is "Hi, see my work". */
export const plainText = (text: Markdown): string => wordsOf(spans(text));

const wordsOf = (pieces: Span[]): string =>
  pieces
    .map((piece) => {
      if (typeof piece === "string") return piece;
      return piece.type === "code" ? piece.text : wordsOf(piece.spans);
    })
    .join("");

/** Every link's href, as the pages and the browser get it. */
export const hrefsIn = (text: Markdown): string[] => hrefsOf(spans(text));

const hrefsOf = (pieces: Span[]): string[] =>
  pieces.flatMap((piece) => {
    if (typeof piece === "string" || piece.type === "code") return [];
    return piece.type === "link" ? [piece.href, ...hrefsOf(piece.spans)] : hrefsOf(piece.spans);
  });
