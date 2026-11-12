/* The content model: what an answer on the site is made of. site.config.ts
   is written in these types, the build turns them into HTML
   (src/components/Block.astro and the component each kind names), and the
   browser renders personal answers from the same data. Ask and llms.txt
   read every answer as plain text, a line for each block
   (src/site/answers.ts).

   An answer is a list of blocks, top to bottom:

       a: [
         "A paragraph, with **bold** and a [link](#work).",
         ["A list's first item", "and its second"],
         { card: { file: "acme.yaml", lines: [["role", "Engineer"]] } },
         { link: { name: "Resume", kind: "PDF", href: "/assets/resume.pdf", icon: "file" } },
       ] */

/** Text with a little Markdown (markdown.ts): **bold**, *italic*, `code`
    and [links](#thread, https://…, mailto:… or /a/file/on/the/site). Never
    HTML. */
export type Markdown = string;

// ---- File cards ----------------------------------------------------------------

/** A value in a file card: a line ("Engineer"), several lines (the first
    beside the key, the rest under it: ["TypeScript", "Astro"]), or one in
    the accent colour ({ accent: "Hiring" }). */
export type CardValue = string | string[] | { accent: string };

/** A line in a file card: [key, value, comment?], drawn as
    `key: value  # comment`. */
export type CardLine = [key: string, value: CardValue, comment?: string];

/** A file card, drawn like a small config file: its name over lines of
    `key: value`, the values in one column.

        { file: "acme.yaml", lines: [["role", "Engineer", "since 2020"], ["stack", ["TypeScript", "Astro"]]] } */
export type Card = {
  /** The file's name, in the card's heading: "acme.yaml". */
  file: string;
  /** Its lines, top to bottom. */
  lines: CardLine[];
  /** Spaces between the longest key and the values (1). */
  gap?: number;
};

// ---- Link cards ----------------------------------------------------------------

/** A link drawn as one of the app's artifact tiles: an icon in a square,
    then a name over what kind of thing it is. */
export type LinkCard = {
  /** The first line: "Resume". It's also what the viewer calls the link
      when it opens there, and all Ask and llms.txt read of it. */
  name: string;
  /** The second line, smaller: "PDF", "github.com/alex-example". */
  kind: string;
  /** Where it goes: a web address (which opens in a new tab), a path on
      the site ("/assets/resume.pdf"), mailto:… or #thread. One the
      config's `viewer` lists opens in the viewer. */
  href: string;
  /** The tile's icon: one of the .i-* classes in src/styles by its name
      ("file"), or "github" or "linkedin", which are drawn as lettered
      badges. */
  icon: string;
};

// ---- Figures -------------------------------------------------------------------

/** Amounts on one scale, drawn as bars from one baseline: a before and an
    after, or one version beside the next. At least two, or it's a number,
    not a chart: write that in the text.

        { title: "Time to load", note: "63% faster", rows: [
          { label: "Before", value: "1.04 s", amount: 1040 },
          { label: "After", value: "385 ms", amount: 385, accent: true },
        ] } */
export type Bars = {
  /** What's measured: "Time to load". */
  title: string;
  /** The bars, top to bottom: FIGURE_LIMITS.bars says how many. */
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
    pipeline, or the way a request goes. Two to five.

    With `example`, the flow follows one example through its steps, and
    plays. It's then drawn down the page, a step a row, each with what the
    example looks like there (the step's own `example`). The visitor
    watches the steps light up in turn, and can pick any step or play it
    again. Without JavaScript, and printed, every step shows at once.

        flow: {
          title: "What happens to an order",
          example: "An example: two coffees, ordered at 8:02",
          steps: [
            { name: "The till", note: "takes the order", example: "2 × flat white, to go" },
            { name: "The kitchen", note: "makes it", example: "Ticket 41, two cups" },
            { name: "The counter", note: "calls the name", example: "“Order for Alex!”" },
          ],
        }

    It needs strings.flowPlay and strings.flowReplay in each language. */
export type Flow = {
  /** What the steps are, over the figure: "What happens to an order". */
  title: string;
  /** The steps, first to last: FIGURE_LIMITS.flow says how many. */
  steps: FlowStep[];
  /** What's followed through the steps, in a line: "An example: one
      visitor's question". Every step then needs its own `example`. Leave
      out for a flow that's only its boxes and arrows. */
  example?: Markdown;
};

/** One step of a flow: its name, and optionally what it does, in a few
    words. */
export type FlowStep = {
  /** The step's name, in bold: "The till". */
  name: string;
  /** What it does, after the name: "takes the order". */
  note?: string;
  /** In a flow with an `example`: what the example looks like at this
      step. A line, or several (each its own line); **bold** marks the part
      to look at. It's an illustration, so Ask and llms.txt don't read it:
      they read the steps. */
  example?: Markdown | Markdown[];
};

/** How many of each a figure can hold and still read at a glance. */
export const FIGURE_LIMITS = {
  bars: { min: 2, max: 6 },
  flow: { min: 2, max: 5 },
} as const;

// ---- Pictures, quotes and headings ---------------------------------------------

/** A picture of the thing itself, such as a screenshot: a file on the
    site ("/assets/app.webp"), its size in pixels (so the page keeps its
    place while it loads), and `alt`, which says what it shows to anyone who
    can't see it. With `href`, the picture links there.

        { src: "/assets/app.webp", alt: "The app's home screen", width: 1600, height: 900, caption: "The home screen" } */
export type Picture = {
  /** The picture's file: a path on the site. */
  src: string;
  /** What it shows, for anyone who can't see it. The build stops without
      one. */
  alt: string;
  /** The file's size in pixels. */
  width: number;
  height: number;
  /** A line under the picture. It's also what the viewer calls the picture
      when its `href` opens there (its `alt`, without one), and all Ask and
      llms.txt read of it. */
  caption?: string;
  /** Where a click on the picture goes, as a link card's `href`. Leave out
      for a picture that isn't a link. */
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

// ---- A part of an answer -------------------------------------------------------

/** One part of an answer: a paragraph (a string), a list (an array of
    strings, an item each), or an object named for what it is: a file card,
    a link, a figure (bars or a flow), a picture, a quote or a heading. */
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

/** What each kind of block that's an object holds, under the name of its
    kind: { card: Card; link: LinkCard; bars: Bars; … }. It's made from
    Block, so a kind added there is here too. */
export type BlockParts = {
  [Named in Exclude<Block, Markdown | Markdown[]> as keyof Named]: Named[keyof Named];
};
