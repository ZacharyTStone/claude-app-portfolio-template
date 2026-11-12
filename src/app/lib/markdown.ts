/* Answer text in the config's little Markdown (src/shared/markdown.ts),
   made into text and elements, never HTML. A link the browser can't follow
   (browserFollows) is just its words. */
import type { Markdown } from "../../shared/content.ts";
import { browserFollows, external, spans } from "../../shared/markdown.ts";
import type { Span } from "../../shared/markdown.ts";
import { make } from "./dom.ts";

/** What an element is given to hold: elements, and plain text. */
type Children = Array<Node | string>;

// An emoji at the start of a line (with the variation selector, U+FE0F,
// that can follow it) and the space after it: the "🎸 " of "🎸 Plays
// guitar". Its first group is the emoji alone.
const LEADING_EMOJI = /^(\p{Extended_Pictographic}\uFE0F?)\s*/u;

/** A line's words, code, bold, italic and links. */
export const rich = (text: Markdown): Children => spans(text).flatMap(renderSpan);

/** One piece of a line: its words as they are, or the element for it. */
function renderSpan(span: Span): Children {
  if (typeof span === "string") return [span];
  if (span.type === "code") return [make("code", {}, span.text)];
  const inside = span.spans.flatMap(renderSpan);
  if (span.type !== "link") return [make(span.type, {}, ...inside)];
  return browserFollows(span.href) ? [make("a", { href: span.href, ...external(span.href) }, ...inside)] : inside;
}

/** A line. A leading emoji is decoration: screen readers skip it. */
export function renderLine(text: Markdown): Children {
  const leading = text.match(LEADING_EMOJI);
  if (!leading) return rich(text);
  const [emojiAndSpace, emoji = ""] = leading;
  return [make("span", { "aria-hidden": "true" }, emoji), " ", ...rich(text.slice(emojiAndSpace.length))];
}

/** A paragraph, or a list of lines. A list whose items all start with an
    emoji drops its bullets. */
export function renderBlock(part: Markdown | Markdown[]): HTMLElement {
  if (!Array.isArray(part)) return make("p", {}, ...renderLine(part));
  const everyLineStartsWithEmoji = part.every((line) => LEADING_EMOJI.test(line));
  return make(
    "ul",
    { class: everyLineStartsWithEmoji ? "plain" : null },
    ...part.map((line) => make("li", {}, ...renderLine(line))),
  );
}
