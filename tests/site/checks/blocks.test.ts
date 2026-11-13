/* The checks of one block of an answer (src/site/checks/blocks.ts): each
   problem's wording. Every block here is added to the sample's "work"
   thread, in English. */
import type { BarRow, Bars, Block, Picture } from "../../../src/config/blocks.ts";
import { testEachProblem, withBlock, type ProblemRow } from "./problems.ts";

const NOT_A_SAFE_LINK = "which should be a web, mailto, #thread or relative address";

/** A picture with nothing wrong, to change one thing of. */
const picture: Picture = { src: "/a.png", alt: "A picture", width: 1200, height: 630 };

/** A picture that moves, but for its still. */
const movingPicture: Picture = { src: "/assets/how.svg", alt: "How it works", width: 1600, height: 800 };

const twoBars: BarRow[] = [
  { label: "Before", value: "1.04 s", amount: 1040 },
  { label: "After", value: "385 ms", amount: 385 },
];

/** Bars whose first bar has `amount`, which may be no number at all. */
const barsWithAmount = (amount: unknown): Block => ({
  bars: { title: "Two", rows: [{ label: "Before", value: "none", amount }, twoBars[1]] } as Bars,
});

const steps = (count: number) => Array.from({ length: count }, (_, index) => ({ name: `Step ${index + 1}` }));

/** A row for a block that's wrong: the one problem is in English, in the thread "work". */
const wrongBlock = (wrong: string, block: Block, problem: string): ProblemRow => ({
  wrong,
  change: withBlock(block),
  problems: [`en: ${problem}`],
});

testEachProblem([
  wrongBlock(
    "a picture on another site",
    { image: { ...picture, src: "https://example.com/a.png" } },
    `the thread "work" has a picture at "https://example.com/a.png", which should be a path on this site`,
  ),
  wrongBlock(
    "a picture without an alt",
    { image: { ...picture, alt: "" } },
    `the thread "work" has the picture "/a.png" without an alt: say what it shows, for anyone who can't see it`,
  ),
  wrongBlock(
    "a picture without a width",
    { image: { ...picture, width: 0 } },
    `the thread "work" has the picture "/a.png" without its width and height in pixels`,
  ),
  wrongBlock(
    "a picture whose height is a fraction",
    { image: { ...picture, height: 630.5 } },
    `the thread "work" has the picture "/a.png" without its width and height in pixels`,
  ),
  wrongBlock(
    "a picture that links to code",
    { image: { ...picture, href: "javascript:alert(1)" } },
    `the picture "/a.png" links to "javascript:alert(1)", ${NOT_A_SAFE_LINK}`,
  ),
  {
    wrong: "a picture in a row of pictures, with everything wrong",
    change: withBlock({
      images: [{ src: "https://example.com/a.png", alt: "", width: 0, height: 630, href: "javascript:alert(1)" }],
    }),
    problems: [
      `en: the thread "work" has a picture at "https://example.com/a.png", which should be a path on this site`,
      `en: the thread "work" has the picture "https://example.com/a.png" without an alt: say what it shows, for anyone who can't see it`,
      `en: the thread "work" has the picture "https://example.com/a.png" without its width and height in pixels`,
      `en: the picture "https://example.com/a.png" links to "javascript:alert(1)", ${NOT_A_SAFE_LINK}`,
    ],
  },
  ...["https://example.com/how-still.svg", movingPicture.src, ""].map((still) =>
    wrongBlock(
      `a moving picture whose still is "${still}"`,
      { image: { ...movingPicture, still } },
      `the thread "work" has the picture "/assets/how.svg" with the still "${still}", which should be another file on this site: the same picture without its motion`,
    ),
  ),
  wrongBlock(
    "a link card with an icon the stylesheet doesn't have",
    { link: { name: "A file", kind: "PDF", href: "/a.pdf", icon: "nope" } },
    `the link card "A file" has the icon "nope", but src/styles has no .i-nope`,
  ),
  wrongBlock(
    "a link card whose link hides a scheme behind a line break",
    { link: { name: "A file", kind: "PDF", href: "java\nscript:alert(1)", icon: "file" } },
    `the link card "A file" links to "java\nscript:alert(1)", ${NOT_A_SAFE_LINK}`,
  ),
  wrongBlock(
    "bars without a title",
    { bars: { title: "", rows: twoBars } },
    `the thread "work" has bars without a title`,
  ),
  wrongBlock(
    "one bar alone",
    { bars: { title: "One", rows: twoBars.slice(1) } },
    `the thread "work" has 1 bars in "One": it takes 2 to 6 (one number alone is text)`,
  ),
  wrongBlock(
    "more bars than read at a glance",
    { bars: { title: "Many", rows: Array.from({ length: 7 }, () => twoBars[0]!) } },
    `the thread "work" has 7 bars in "Many": it takes 2 to 6 (one number alone is text)`,
  ),
  wrongBlock(
    "a bar without a label",
    { bars: { title: "Two", rows: [{ ...twoBars[0]!, label: "" }, twoBars[1]!] } },
    `the thread "work" has a bar in "Two" without a label or a value`,
  ),
  wrongBlock(
    "a bar without a value",
    { bars: { title: "Two", rows: [{ ...twoBars[0]!, value: "" }, twoBars[1]!] } },
    `the thread "work" has a bar in "Two" without a label or a value`,
  ),
  wrongBlock(
    "a bar with no amount to draw",
    barsWithAmount(0),
    `the thread "work" has the bar "Before" with the amount 0: it should be a number above zero, in the same unit on every row`,
  ),
  wrongBlock(
    "a bar whose amount isn't a number",
    barsWithAmount(Number.NaN),
    `the thread "work" has the bar "Before" with the amount null: it should be a number above zero, in the same unit on every row`,
  ),
  wrongBlock(
    "a bar whose amount is written as its value is",
    barsWithAmount("385 ms"),
    `the thread "work" has the bar "Before" with the amount "385 ms": it should be a number above zero, in the same unit on every row`,
  ),
  wrongBlock(
    "a flow without a title",
    { flow: { title: "", steps: steps(2) } },
    `the thread "work" has a flow without a title`,
  ),
  wrongBlock(
    "a flow of one step",
    { flow: { title: "Short", steps: steps(1) } },
    `the thread "work" has 1 steps in "Short": it takes 2 to 5`,
  ),
  wrongBlock(
    "a flow of more steps than read at a glance",
    { flow: { title: "Long", steps: steps(6) } },
    `the thread "work" has 6 steps in "Long": it takes 2 to 5`,
  ),
  wrongBlock(
    "a flow's step without a name",
    { flow: { title: "Named", steps: [{ name: "" }, { name: "Publish" }] } },
    `the thread "work" has a step in "Named" without a name`,
  ),
  wrongBlock(
    "a heading without a title",
    { heading: { title: "" } },
    `the thread "work" has a heading without a title`,
  ),
  wrongBlock(
    "a quote without who said it",
    { quote: { text: "Good.", by: "" } },
    `the thread "work" has a quote without its text or who said it (by)`,
  ),
  wrongBlock(
    "a quote without its words",
    { quote: { text: "", by: "A coworker" } },
    `the thread "work" has a quote without its text or who said it (by)`,
  ),
]);
