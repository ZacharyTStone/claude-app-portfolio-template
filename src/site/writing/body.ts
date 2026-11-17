/* A post's text, as its author wrote it on Qiita (Markdown), read into
   pieces: never into HTML. The post's own page makes its elements from the
   pieces (src/components/PostBlock.astro), so no markup in a post reaches
   a page. HTML in a post is left out, a link goes to a web address or is
   just its words, and a picture is a link to it, since the pages load
   nothing from another site. Astro's own Markdown reader (satteri) reads
   the text; Qiita's notes (":::note" to ":::"), which no other Markdown
   has, are found here first. */
import { markdownToMdast } from "satteri";

/** A piece of a line: its words as they are, code, a new line, words in
    bold, in italics or struck out, or a link to a web address. */
export type PostSpan =
  | string
  | { type: "code"; text: string }
  | { type: "break" }
  | { type: "strong" | "em" | "del"; spans: PostSpan[] }
  | { type: "link"; href: string; spans: PostSpan[] };

/** The levels a post's headings have on its page, under its title. */
const HEADING_LEVELS = [2, 3, 4, 5, 6] as const;

type HeadingLevel = (typeof HEADING_LEVELS)[number];

/** A part of a post. A list's item, a quote and a note are made of parts
    themselves; a table's cell is a line. */
export type PostBlock =
  | { type: "heading"; level: HeadingLevel; spans: PostSpan[] }
  | { type: "paragraph"; spans: PostSpan[] }
  | { type: "list"; ordered: boolean; start?: number; items: PostBlock[][] }
  | { type: "code"; text: string; file?: string }
  | { type: "quote" | "note"; blocks: PostBlock[] }
  | { type: "table"; head: PostSpan[][]; rows: PostSpan[][][] }
  | { type: "rule" };

/** A node of the tree the reader makes of Markdown (mdast): as much of one
    as is read here. */
type Node = {
  type: string;
  children?: Node[];
  value?: string;
  url?: string;
  alt?: string | null;
  identifier?: string;
  depth?: number;
  ordered?: boolean | null;
  start?: number | null;
  checked?: boolean | null;
  lang?: string | null;
};

/** What reading a stretch of a post goes by: where each of its
    [references] goes, by the reference's name. */
type Reading = { definitions: ReadonlyMap<string, string> };

type SpanReader = (node: Node, reading: Reading) => PostSpan[];
type BlockReader = (node: Node, reading: Reading) => PostBlock[];

const BREAK: PostSpan = { type: "break" };

/** The page's own heading is the post's title, so a post's are under it. */
const TITLE_LEVEL = 1;

const levelAt = (level: number): HeadingLevel => HEADING_LEVELS.find((each) => each >= level) ?? 6;

const isWebAddress = (href: string | undefined): href is string =>
  href !== undefined && /^https?:\/\//i.test(href) && URL.canParse(href);

/** A line's words, without its markup. */
function wordsOf(spans: PostSpan[]): string {
  const words = spans.map((span) => {
    if (typeof span === "string") return span;
    if (span.type === "code") return span.text;
    return span.type === "break" ? " " : wordsOf(span.spans);
  });
  return words.join("");
}

const hasWords = (spans: PostSpan[]): boolean => wordsOf(spans).trim() !== "";

/** Qiita starts a new line wherever a post's author did, so each line
    break in the text is one on the page. */
const textSpans = (text: string): PostSpan[] =>
  text.split("\n").flatMap((line, at): PostSpan[] => (at === 0 ? [line] : [BREAK, line]));

/** A link to a web address, called by the address if it has no words. To
    any other address (a place in the post, a path on Qiita, another
    scheme) it's just its words. */
function linkTo(href: string | undefined, spans: PostSpan[]): PostSpan[] {
  if (!isWebAddress(href)) return spans;
  return [{ type: "link", href, spans: hasWords(spans) ? spans : [href] }];
}

// A picture as Qiita's editor writes one that's given a width:
// <img width="400" alt="shot.png" src="https://…">
const IMAGE_TAG = /<img\b[^>]*>/gi;

const attributeIn = (tag: string, name: string): string | undefined =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1]?.replaceAll("&amp;", "&");

/** All that's kept of a post's HTML: a link to each picture in it, called
    by what the picture shows. */
function picturesIn(html: string): PostSpan[] {
  return Array.from(html.matchAll(IMAGE_TAG), ([tag]) => tag).flatMap((tag) => {
    const address = attributeIn(tag, "src");
    return isWebAddress(address) ? picture(address, attributeIn(tag, "alt")) : [];
  });
}

function marked(type: "strong" | "em" | "del", node: Node, reading: Reading): PostSpan[] {
  const spans = spansIn(node, reading);
  return hasWords(spans) ? [{ type, spans }] : [];
}

/** A picture is a link to it, called by what it shows, or by its address.
    One that isn't at a web address is the words for what it shows, if it
    has any. */
function picture(address: string | undefined, shows: string | null | undefined): PostSpan[] {
  if (isWebAddress(address)) return linkTo(address, [shows || address]);
  return shows ? [shows] : [];
}

const definedAt = (node: Node, { definitions }: Reading): string | undefined => definitions.get(node.identifier ?? "");

const SPANS_OF: ReadonlyMap<string, SpanReader> = new Map<string, SpanReader>([
  ["text", (node) => textSpans(node.value ?? "")],
  ["inlineCode", (node) => [{ type: "code", text: node.value ?? "" }]],
  ["break", () => [BREAK]],
  ["strong", (node, reading) => marked("strong", node, reading)],
  ["emphasis", (node, reading) => marked("em", node, reading)],
  ["delete", (node, reading) => marked("del", node, reading)],
  ["link", (node, reading) => linkTo(node.url, spansIn(node, reading))],
  ["linkReference", (node, reading) => linkTo(definedAt(node, reading), spansIn(node, reading))],
  ["image", (node) => picture(node.url, node.alt)],
  ["imageReference", (node, reading) => picture(definedAt(node, reading), node.alt)],
  ["footnoteReference", (node) => [`[${node.identifier ?? ""}]`]],
  ["html", (node) => picturesIn(node.value ?? "")],
]);

/** A node as pieces of a line. One of a kind not known here is what's in
    it, or its text. */
function spansOf(node: Node, reading: Reading): PostSpan[] {
  const read = SPANS_OF.get(node.type);
  if (read) return read(node, reading);
  return node.children ? spansIn(node, reading) : textSpans(node.value ?? "");
}

function spansIn(node: Node, reading: Reading): PostSpan[] {
  return (node.children ?? []).flatMap((child) => spansOf(child, reading));
}

const paragraph = (spans: PostSpan[]): PostBlock[] => (hasWords(spans) ? [{ type: "paragraph", spans }] : []);

/** `blocks` with `label` before their first words. */
function labelled(label: string, blocks: PostBlock[]): PostBlock[] {
  const [first, ...rest] = blocks;
  if (first?.type === "paragraph") return [{ ...first, spans: [`${label} `, ...first.spans] }, ...rest];
  return [{ type: "paragraph", spans: [label] }, ...blocks];
}

/** A heading inside a list, a quote or a note is a line in bold: the page's
    outline is the post's own headings, top to bottom. */
const headingInside: BlockReader = (node, reading) => paragraph(marked("strong", node, reading));

/** A list's item: its parts, after its box if it's one to tick. */
function listItem(item: Node, reading: Reading): PostBlock[] {
  const blocks = blocksIn(item, reading);
  if (typeof item.checked !== "boolean") return blocks;
  return labelled(item.checked ? "[x]" : "[ ]", blocks);
}

const list: BlockReader = (node, reading) => {
  const items = (node.children ?? []).map((item) => listItem(item, reading)).filter((blocks) => blocks.length > 0);
  if (!items.length) return [];
  const ordered = node.ordered === true;
  const startsLater = ordered && typeof node.start === "number" && node.start !== 1;
  return [{ type: "list", ordered, ...(startsLater ? { start: node.start ?? 1 } : {}), items }];
};

// Spaces and tabs a line of code ends with, which show nowhere.
const SPACES_AT_A_LINES_END = /[ \t]+$/gm;

/** A block of code, under its file's name if it has one: Qiita writes the
    name after the language (```ts:src/app.ts). */
const code: BlockReader = (node) => {
  const text = (node.value ?? "").replace(SPACES_AT_A_LINES_END, "");
  if (text.trim() === "") return [];
  const file = (node.lang ?? "").split(":").slice(1).join(":").trim();
  return [{ type: "code", text, ...(file ? { file } : {}) }];
};

const boxed =
  (type: "quote" | "note"): BlockReader =>
  (node, reading) => {
    const blocks = blocksIn(node, reading);
    return blocks.length ? [{ type, blocks }] : [];
  };

/** A table, every row as wide as its head: a short one is filled out, and
    a long one cut. */
const table: BlockReader = (node, reading) => {
  const lines = (node.children ?? []).map((row) => (row.children ?? []).map((cell) => spansIn(cell, reading)));
  const [head = [], ...rows] = lines;
  if (!head.length) return [];
  return [{ type: "table", head, rows: rows.map((row) => head.map((_, at) => row[at] ?? [])) }];
};

const leftOut: BlockReader = () => [];

const BLOCKS_OF: ReadonlyMap<string, BlockReader> = new Map<string, BlockReader>([
  ["paragraph", (node, reading) => paragraph(spansIn(node, reading))],
  ["heading", headingInside],
  ["list", list],
  ["code", code],
  ["blockquote", boxed("quote")],
  ["table", table],
  ["thematicBreak", () => [{ type: "rule" }]],
  ["footnoteDefinition", (node, reading) => labelled(`[${node.identifier ?? ""}]`, blocksIn(node, reading))],
  ["html", (node) => paragraph(picturesIn(node.value ?? ""))],
  // Where a [reference] goes: read ahead of the rest (definitionsIn).
  ["definition", leftOut],
]);

/** A node as parts of a post. One of a kind not known here is its parts,
    if it has any, or else its words as a paragraph. */
function blocksOf(node: Node, reading: Reading): PostBlock[] {
  const read = BLOCKS_OF.get(node.type);
  if (read) return read(node, reading);
  const hasParts = (node.children ?? []).some((child) => BLOCKS_OF.has(child.type));
  return hasParts ? blocksIn(node, reading) : paragraph(spansOf(node, reading));
}

function blocksIn(node: Node, reading: Reading): PostBlock[] {
  return (node.children ?? []).flatMap((child) => blocksOf(child, reading));
}

/** One of the post's own headings, at the level its "#"s give it under the
    page's title (withHeadingsInOrder has the last word). */
function heading(node: Node, reading: Reading): PostBlock[] {
  const spans = spansIn(node, reading);
  return hasWords(spans) ? [{ type: "heading", level: levelAt((node.depth ?? 1) + TITLE_LEVEL), spans }] : [];
}

/** Each heading one level under the nearest one before it that the post
    puts above it, or right under the page's title: an outline that skips no
    level, whichever of "#" to "######" the post starts at or jumps to. */
function withHeadingsInOrder(blocks: PostBlock[]): PostBlock[] {
  /** The headings the next one may be under: each one's level as the post
      has it, and as the page shows it. */
  const above: Array<{ own: number; shown: number }> = [];
  return blocks.map((block) => {
    if (block.type !== "heading") return block;
    while ((above.at(-1)?.own ?? 0) >= block.level) above.pop();
    const shown = (above.at(-1)?.shown ?? TITLE_LEVEL) + 1;
    above.push({ own: block.level, shown });
    return { ...block, level: levelAt(shown) };
  });
}

/** Where every [reference] in a tree goes, by the reference's name. */
function definitionsIn(tree: Node): Map<string, string> {
  const definitions = new Map<string, string>();
  const read = (node: Node): void => {
    if (node.type === "definition" && node.identifier && node.url) definitions.set(node.identifier, node.url);
    node.children?.forEach(read);
  };
  read(tree);
  return definitions;
}

/** What the reader reads besides plain Markdown: GitHub's tables, struck-out
    words, boxes to tick and footnotes, as Qiita has them. Not a block of
    settings at the top, which a post has none of. */
const FEATURES = { gfm: true, frontmatter: false } as const;

/** The tree a stretch of Markdown reads as. None if the reader throws: the
    stretch is then left out, and the page still links to the post. */
function treeOf(markdown: string): Node | undefined {
  try {
    return markdownToMdast(markdown, { features: FEATURES });
  } catch {
    return undefined;
  }
}

/** A stretch of a post: its lines, and whether they're inside one of
    Qiita's notes. */
type Stretch = { note: boolean; lines: string[] };

// Up to three spaces, then three or more backticks or tildes: where a block
// of code starts and ends.
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const NOTE_OPENS = /^:::note\b/;
const NOTE_CLOSES = /^:::\s*$/;

/** Whether a line ends the block of code that the fence `open` started: a
    fence of the same character, at least as long, alone on its line. */
function closesFence(line: string, open: string): boolean {
  const fence = line.match(FENCE)?.[1] ?? "";
  return fence.startsWith(open) && line.trim() === fence;
}

/** For each line, whether it's part of a fenced block of code, where
    ":::" is code like any other. */
function linesOfCode(lines: string[]): boolean[] {
  let open: string | undefined;
  return lines.map((line) => {
    if (open === undefined) {
      open = line.match(FENCE)?.[1];
      return open !== undefined;
    }
    if (closesFence(line, open)) open = undefined;
    return true;
  });
}

/** A post's lines as stretches, in order: each note, and what's before,
    between and after them. A note that's never closed isn't one. */
function stretchesOf(lines: string[]): Stretch[] {
  const isCode = linesOfCode(lines);
  const isMark = (at: number, mark: RegExp): boolean => !isCode[at] && mark.test(lines[at] ?? "");
  const stretches: Stretch[] = [];
  let from = 0;
  for (let at = 0; at < lines.length; at++) {
    if (!isMark(at, NOTE_OPENS)) continue;
    const opensAt = at;
    const closesAt = lines.findIndex((_, later) => later > opensAt && isMark(later, NOTE_CLOSES));
    if (closesAt < 0) break;
    stretches.push({ note: false, lines: lines.slice(from, opensAt) });
    stretches.push({ note: true, lines: lines.slice(opensAt + 1, closesAt) });
    from = closesAt + 1;
    at = closesAt;
  }
  return [...stretches, { note: false, lines: lines.slice(from) }];
}

function stretchBlocks({ note, lines }: Stretch): PostBlock[] {
  const tree = treeOf(lines.join("\n"));
  if (!tree) return [];
  const reading = { definitions: definitionsIn(tree) };
  if (note) return boxed("note")(tree, reading);
  return (tree.children ?? []).flatMap((node) =>
    node.type === "heading" ? heading(node, reading) : blocksOf(node, reading),
  );
}

/** A post's Markdown as the parts of its page, in order. None for a post
    with no words. */
export function postBlocks(markdown: string): PostBlock[] {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  return withHeadingsInOrder(stretchesOf(lines).flatMap(stretchBlocks));
}
