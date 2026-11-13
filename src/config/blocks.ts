/* What an answer is made of. An answer is a list of blocks, top to bottom:

       a: [
         "A paragraph, with **bold** and a [link](#work).",
         ["A list's first item", "and its second"],
         { card: { file: "acme.yaml", lines: [["role", "Engineer"]] } },
         { link: { name: "Resume", kind: "PDF", href: "/assets/resume.pdf", icon: "file" } },
       ]

   The pages draw each block (src/components/Block.astro); Ask and llms.txt
   read it as a line of plain text (src/site/plain-answers.ts). */

import type { Language } from "./language.ts";
import type { Markdown } from "./markdown.ts";

/** A paragraph, or a list of lines. */
export type TextBlock = Markdown | Markdown[];

/** A block that isn't text: an object with one key, which says what kind
    it is. */
type NamedBlock =
  | {
      /** A file card, drawn like a small config file. */
      card: FileCard;
    }
  | {
      /** A link, drawn as a tile: an icon, a name, and what kind of thing
          it is. */
      link: LinkCard;
    }
  | {
      /** Amounts on one scale, drawn as bars. */
      bars: Bars;
    }
  | {
      /** Steps in order, drawn as boxes with an arrow from each to the next. */
      flow: Flow;
    }
  | {
      /** A picture: a screenshot, a diagram. */
      image: Picture;
    }
  | {
      /** Pictures side by side, while there's room for two. */
      images: Picture[];
    }
  | {
      /** Someone else's words about your work. */
      quote: Quote;
    }
  | {
      /** A heading inside a long answer, to set its parts apart. */
      heading: Heading;
    };

export type Block = TextBlock | NamedBlock;

/** What each kind of named block holds, under the name of its kind:
    { card: FileCard; link: LinkCard; bars: Bars; … }. It's made from
    NamedBlock, so a kind added there is here too. */
export type BlockByKind = {
  [Named in NamedBlock as keyof Named]: Named[keyof Named];
};

/** One line ("Engineer"), several (the first beside the key, the rest
    under it: ["TypeScript", "Astro"]), or one in the accent colour. */
export type CardValue =
  | string
  | string[]
  | {
      /** The value, drawn in the accent colour: "Hiring". */
      accent: string;
    };

/** Drawn as `key: value  # comment`. */
type CardLine = [key: string, value: CardValue, comment?: string];

/** Its name over lines of `key: value`, the values in one column.

        { file: "acme.yaml", lines: [["role", "Engineer", "since 2020"], ["stack", ["TypeScript", "Astro"]]] } */
export type FileCard = {
  /** In the card's heading: "acme.yaml". */
  file: string;
  /** Top to bottom, each [key, value] or [key, value, comment]. */
  lines: CardLine[];
  /** Spaces between the longest key and the values (1). */
  gap?: number;
};

export type LinkCard = {
  /** The first line: "Resume". It's also what the viewer calls the link
      when it opens there, and all Ask and llms.txt read of it. */
  name: string;
  /** The second line, smaller: "PDF", "github.com/alex-example". */
  kind: string;
  /** A web address (which opens in a new tab), a path on the site
      ("/assets/resume.pdf"), mailto:… or #thread. One the config's
      `viewer` lists opens in the viewer. */
  href: string;
  /** One of the .i-* classes in src/styles by its name ("file"), or
      "github" or "linkedin", which are drawn as lettered badges. */
  icon: string;
};

/** A before and an after, or one version beside the next, from one
    baseline. One number alone is a sentence, not a chart.

        { title: "Time to load", note: "63% faster", rows: [
          { label: "Before", value: "1.04 s", amount: 1040 },
          { label: "After", value: "385 ms", amount: 385, accent: true },
        ] } */
export type Bars = {
  /** What's measured: "Time to load". */
  title: string;
  /** Top to bottom: two to six (FIGURE_LIMITS.bars). */
  rows: BarRow[];
  /** What the bars come to, beside the title: "63% faster". */
  note?: string;
};

export type BarRow = {
  /** What the bar is: "Before". */
  label: string;
  /** The amount as it's written at the bar's tip: "385 ms". */
  value: string;
  /** The number the bar's length is drawn from, above zero and in the
      same unit on every row: 385. */
  amount: number;
  /** true for the row the figure is about, drawn in the accent colour;
      the others are grey. */
  accent?: boolean;
};

/** A pipeline, or the way a request goes.

        { title: "What happens to an order", steps: [
          { name: "The till", note: "takes the order" },
          { name: "The kitchen", note: "makes it" },
        ] } */
export type Flow = {
  /** What the steps are, over the figure: "What happens to an order". */
  title: string;
  /** First to last: two to five (FIGURE_LIMITS.flow). */
  steps: FlowStep[];
};

type FlowStep = {
  /** In bold: "The till". */
  name: string;
  /** What the step does, after its name: "takes the order". */
  note?: string;
};

/** How many of each a figure can hold and still read at a glance. */
export const FIGURE_LIMITS = {
  bars: { min: 2, max: 6 },
  flow: { min: 2, max: 5 },
} as const;

/** A picture that moves (an SVG with its own animation, as `npm run
    diagrams` writes: docs/diagrams.md) names itself without its motion as
    `still`. One whose file says how long it plays rests as its still, with
    a Play button; any other moves all the time.

        { src: "/assets/app.webp", alt: "The app's home screen", width: 1600, height: 900, caption: "The home screen" } */
export type Picture = {
  /** The picture's file: a path on the site ("/assets/app.webp"). */
  src: string;
  /** For a picture that moves: the same picture, still. A picture a
      visitor plays shows it until it's played, and after; one that moves
      all the time shows it to a visitor who has asked for less motion. */
  still?: string;
  /** What the picture shows, for anyone who can't see it. The build stops
      without one. */
  alt: string;
  /** The file's width in pixels, so the page keeps its place while it
      loads. */
  width: number;
  /** The file's height in pixels. */
  height: number;
  /** A line under the picture. It's also what the viewer calls the picture
      when its `href` opens there (its `alt`, without one), and all Ask and
      llms.txt read of it. */
  caption?: string;
  /** Where a click on the picture goes, as a link card's `href`. Leave out
      for a picture that isn't a link. */
  href?: string;
  /** true for a picture shown small and round, as a portrait is. */
  round?: boolean;
};

export type Quote = {
  /** What they said. */
  text: string;
  /** Who said it: their name, or their part ("A fellow engineer"). */
  by: string;
};

export type Heading = {
  /** The part's name. */
  title: string;
  /** A word over the title saying what kind of part it is: "Project". */
  label?: string;
};

export const isTextBlock = (block: Block): block is TextBlock => typeof block !== "object" || Array.isArray(block);

export const answerBlocksIn = (language: Language): Block[] =>
  language.threads.flatMap((thread) => thread.messages.flatMap((message) => message.a));

/** One picture, a row of them, or none. */
export function picturesIn(block: Block): Picture[] {
  if (isTextBlock(block)) return [];
  if ("image" in block) return [block.image];
  return "images" in block ? block.images : [];
}
