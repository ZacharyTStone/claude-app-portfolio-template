/* The config's little Markdown. It is read into pieces (Span), never into
   HTML: the pages, the browser code and the plain-text files each make
   their own elements or text from the pieces, so no markup in the config's
   text can reach a page. */

/** Text with a little Markdown: **bold**, *italic*, `code`
    and [links](#thread, https://…, mailto:… or /a/file/on/the/site). Never
    HTML. */
export type Markdown = string;

export type Span =
  | string
  | { type: "code"; text: string }
  | { type: "strong"; spans: Span[] }
  | { type: "em"; spans: Span[] }
  | { type: "link"; href: string; spans: Span[] };

// The match furthest left wins, and at one place the earlier alternative:
// "**" starts bold, not two italics.
const MARKUP = /\*\*(?<bold>.+?)\*\*|\*(?<italic>.+?)\*|`(?<code>.+?)`|\[(?<label>.+?)\]\((?<href>.+?)\)/g;

/** spans("**Hi**, see [my work](#work)") is
    [{ type: "strong", spans: ["Hi"] }, ", see ", { type: "link", href: "#work", spans: ["my work"] }].
    Markup that's never closed ("2 * 3") stays as the characters it is. */
export function spans(text: Markdown): Span[] {
  const pieces: Span[] = [];
  let readUpTo = 0;
  for (const match of text.matchAll(MARKUP)) {
    const { bold, italic, code, label, href } = match.groups ?? {};
    if (match.index > readUpTo) pieces.push(text.slice(readUpTo, match.index));
    if (bold !== undefined) pieces.push({ type: "strong", spans: spans(bold) });
    else if (italic !== undefined) pieces.push({ type: "em", spans: spans(italic) });
    else if (code !== undefined) pieces.push({ type: "code", text: code });
    else if (label !== undefined && href !== undefined) pieces.push({ type: "link", href, spans: spans(label) });
    readUpTo = match.index + match[0].length;
  }
  if (readUpTo < text.length) pieces.push(text.slice(readUpTo));
  return pieces;
}

/** plainText("**Hi**, see [my work](#work)") is "Hi, see my work". */
export const plainText = (text: Markdown): string => wordsOf(spans(text));

const wordsOf = (pieces: Span[]): string =>
  pieces
    .map((piece) => {
      if (typeof piece === "string") return piece;
      return piece.type === "code" ? piece.text : wordsOf(piece.spans);
    })
    .join("");

/** A link in the text: where it goes, and its words as plain text. */
export type TextLink = { href: string; text: string };

/** linksIn("See [**my** work](#work)") is [{ href: "#work", text: "my work" }]:
    each link in the order it starts, one inside another's label after it. */
export const linksIn = (text: Markdown): TextLink[] => linksOf(spans(text));

const linksOf = (pieces: Span[]): TextLink[] =>
  pieces.flatMap((piece) => {
    if (typeof piece === "string" || piece.type === "code") return [];
    const inside = linksOf(piece.spans);
    return piece.type === "link" ? [{ href: piece.href, text: wordsOf(piece.spans) }, ...inside] : inside;
  });

export const hrefsIn = (text: Markdown): string[] => linksIn(text).map((link) => link.href);
