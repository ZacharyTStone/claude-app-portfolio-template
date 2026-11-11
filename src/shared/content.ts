/* The content model: what an answer on the site is made of. site.config.ts
   is written in these types, the build turns them into HTML, and the
   browser renders personal answers from the same data. */

/** Text with a little Markdown (markdown.ts): **bold**, *italic*, `code`
    and [links](#thread, https://…, mailto:… or /a/file/on/the/site). Never
    HTML. */
export type Markdown = string;

/** A value in a file card: a line, several lines, or one in the accent
    colour. */
export type CardValue = string | string[] | { accent: string };

/** A line in a file card: [key, value, comment?]. */
export type CardLine = [key: string, value: CardValue, comment?: string];

/** A file card, drawn like a small config file. */
export type Card = {
  file: string;
  lines: CardLine[];
  /** Spaces between the longest key and the values (1). */
  gap?: number;
};

/** A link drawn as one of the app's artifact tiles. */
export type LinkCard = {
  name: string;
  kind: string;
  href: string;
  icon: string;
};

/** Amounts on one scale, drawn as bars from one baseline: a before and an
    after, or one version beside the next. At least two, or it's a number,
    not a chart: write that in the text. */
export type Bars = {
  /** What's measured: "Time to load". */
  title: string;
  rows: BarRow[];
  /** What the bars come to, beside the title: "64% faster". */
  note?: string;
};

/** One bar. `value` is the amount as it's written at the bar's tip
    ("385 ms"), and `amount` the number its length is drawn from, in the
    same unit on every row (385). `accent` draws it in the accent colour,
    for the row the figure is about; the others are grey. */
export type BarRow = { label: string; value: string; amount: number; accent?: boolean };

/** Steps in order, drawn as boxes with an arrow from each to the next: a
    pipeline, or the way a request goes. Two to five. */
export type Flow = {
  title: string;
  steps: Array<{ name: string; note?: string }>;
};

/** A picture of the thing itself, such as a screenshot: a file on the
    site ("/assets/app.webp"), its size in pixels (so the page keeps its
    place while it loads), and `alt`, which says what it shows to anyone who
    can't see it. With `href`, the picture links there. */
export type Picture = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  href?: string;
  /** Shown small and round, as a portrait is. */
  round?: boolean;
};

/** Someone else's words about your work, and who said them. `by` can be
    their part rather than their name ("A fellow engineer"). */
export type Quote = { text: string; by: string };

/** A heading inside a long answer, to set its parts apart: the part's
    name, and optionally a word over it saying what kind of part it is
    ("Project"). */
export type Heading = { title: string; label?: string };

/** One part of an answer: a paragraph, a list, a file card, a link, a
    figure (bars or a flow), a picture, a quote or a heading. */
export type Block =
  | Markdown
  | Markdown[]
  | { card: Card }
  | { link: LinkCard }
  | { bars: Bars }
  | { flow: Flow }
  | { image: Picture }
  /** Pictures side by side, while there's room for two. */
  | { images: Picture[] }
  | { quote: Quote }
  | { heading: Heading };

/** How many of each a figure can hold and still read at a glance. */
export const FIGURE_LIMITS = {
  bars: { min: 2, max: 6 },
  flow: { min: 2, max: 5 },
} as const;
