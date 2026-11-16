/* Text in the config's little Markdown (src/config/markdown.ts), made into
   text and elements, never HTML. A link the browser can't follow
   (browserFollows) is just its words. */
import type { Markdown, Span } from "../../config/markdown.ts";
import { browserFollows, newTabAttributes } from "../../contracts/links.ts";
import { spans } from "../../config/markdown.ts";
import { make } from "./dom.ts";

/** What an element is given to hold: elements, and plain text. */
type Children = Array<Node | string>;

/** Where a link goes on the page, from the address the text gives it: a
    tab's #id is the tab's own address. */
type LinkTo = (href: string) => string;

/** One piece of a line: its words as they are, or the element for it. */
function renderSpan(span: Span, linkTo: LinkTo): Children {
  if (typeof span === "string") return [span];
  if (span.type === "code") return [make("code", {}, span.text)];
  const inside = span.spans.flatMap((piece) => renderSpan(piece, linkTo));
  if (span.type !== "link") return [make(span.type, {}, ...inside)];
  return browserFollows(span.href)
    ? [make("a", { href: linkTo(span.href), ...newTabAttributes(span.href) }, ...inside)]
    : inside;
}

/** A line's words, code, bold, italic and links. */
export const rich = (text: Markdown, linkTo: LinkTo): Children =>
  spans(text).flatMap((span) => renderSpan(span, linkTo));
