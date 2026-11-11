/* Answer text in the config's little Markdown (src/shared/markdown.ts),
   made into text and elements, never HTML. A link the browser can't follow
   (browserFollows) is just its words. */
import type { Markdown } from "../../shared/content.ts";
import { browserFollows, external, spans } from "../../shared/markdown.ts";
import type { Span } from "../../shared/markdown.ts";
import { make } from "./dom.ts";

// A leading emoji (and the variation selector that can follow it).
const EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;

/** A line's words, code, bold, italic and links. */
export const rich = (text: Markdown): Array<Node | string> => spans(text).flatMap(nodes);

function nodes(span: Span): Array<Node | string> {
  if (typeof span === "string") return [span];
  if (span.type === "code") return [make("code", {}, span.text)];
  const inner = span.spans.flatMap(nodes);
  if (span.type !== "link") return [make(span.type, {}, ...inner)];
  return browserFollows(span.href) ? [make("a", { href: span.href, ...external(span.href) }, ...inner)] : inner;
}

/** A line. A leading emoji is decoration: screen readers skip it. */
export function line(text: Markdown): Array<Node | string> {
  const emoji = text.match(EMOJI);
  if (!emoji) return rich(text);
  return [make("span", { "aria-hidden": "true" }, emoji[1] ?? ""), " ", ...rich(text.slice(emoji[0].length))];
}

/** A paragraph, or a list of lines. A list whose items all start with an
    emoji drops its bullets. */
export function block(part: Markdown | Markdown[]): HTMLElement {
  if (!Array.isArray(part)) return make("p", {}, ...line(part));
  const plain = part.every((item) => EMOJI.test(item));
  return make("ul", { class: plain ? "plain" : null }, ...part.map((item) => make("li", {}, ...line(item))));
}
