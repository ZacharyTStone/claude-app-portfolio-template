# Diagrams: pictures that move

A diagram is a picture: boxes, lines, and things that move along them.
Each is a short TypeScript file in `diagrams/`, drawn with the kit in
`scripts/diagram.ts`. `npm run diagrams` writes it as SVG files in
`public/assets`, and an `image` in the config shows it.

For steps in order with nothing to watch, a `flow` block draws two to
five boxes with an arrow from each to the next, and needs none of this
([What the site says](content.md#answers)).

## One, start to finish

```ts
// diagrams/order.ts
import { arrowhead, box, label, levelCurve, line, loopOf, moving, type Diagram } from "../scripts/diagram.ts";

type Words = { till: string; kitchen: string };

function draw(words: Words) {
  const loop = loopOf(6); // seconds, and then it starts again
  const road = levelCurve({ x: 520, y: 200 }, { x: 1048, y: 200 });
  return {
    width: 1600,
    height: 400,
    plays: loop.clears.from, // a visitor plays it: for this long, then it's still again
    shapes: [
      box({ x: 120, y: 120, width: 400, height: 160 }),
      label(words.till, { x: 320, y: 214 }, { size: 46, weight: 600 }),
      box({ x: 1080, y: 120, width: 400, height: 160 }),
      label(words.kitchen, { x: 1280, y: 214 }, { size: 46, weight: 600 }),
      moving(line(road), ...loop.draw(0.5, 1.5)), // the line draws itself,
      arrowhead({ x: 1064, y: 200 }, 0),
      loop.traveller(road, 1.5, 3), // and an order travels along it
    ],
  };
}

export default {
  name: "order",
  words: { en: { till: "The till", kitchen: "The kitchen" }, ja: { till: "レジ", kitchen: "キッチン" } },
  draw,
} satisfies Diagram<Words>;
```

```sh
npm run diagrams          # writes every diagram's files into public/assets
npm run diagrams order    # or one
```

```ts
// site.config.ts, in an answer
{ image: { src: "/assets/order.svg", still: "/assets/order-still.svg", alt: "…", width: 1600, height: 400 } }
```

Open the SVG file in a browser to look at it. Commit the files with the
diagram: `npm test` fails while they aren't what it draws
(`tests/diagrams.test.ts`).

## What the kit has

`scripts/diagram.ts` is the kit's one entry: a diagram imports from it
and nothing else, and each name is documented in the module behind it, in
`scripts/diagram/`.

- **Shapes.**
  - To draw: `box`, `label`, `dot`, `line`, `arrowhead`, `bar` (it stands
    for words), `dots` (a map).
  - A line's path: `levelCurve`, `arc`, or any SVG path (`rounded` writes a
    number in one).
  - Where things go: `Place`, `centreOf`, `rightOf`; `aroundOrigin` and
    `placed`, for what turns or grows about its own middle.
  - Room for text: `textWidth(text, size, { mono, weight })`,
    `sizeToFit`, `baselineAround`.
  - Colours and type: `COLOR`, `FONT`.
  - Together: `group`, `moving` (a shape with motion on it),
    `onlyWhenMoving`.
- **Motion**, from `loopOf(seconds)`.
  - A value changing: `loop.track` (any attribute), `loop.transform`,
    `loop.shown`, `loop.changing` (one text after another).
  - A line: `loop.draw` draws it, and
    `loop.along(path, from, to, { back, pace })` moves a shape along one
    (`pace` is `"smooth"`, the default, or `"even"`; `back` runs it end to
    start).
  - Passing through: `loop.traveller` (a dot) and `loop.carried` (any
    shapes) along a path, `loop.ripple`.
  - A light: `loop.flash`, `loop.light` (over anything), `loop.edgeLight`
    (a box's edge, as something arrives).
- **A story's loop**, for a picture that follows one thing, ends as its
  still, then clears and starts again.
  - When it clears: `loopOf(seconds, { from, to })`. What the story built
    up fades then, together.
  - Coming to stay: `loop.since`, or by `loop.popping`, `loop.rising` or
    `loop.gliding` into place.
  - Starting over: `loop.fromTheStart` (what the loop changes),
    `loop.untilClear` (what something else brought in). `justBefore(seconds)`
    is the moment just before one, so that a value held until then changes
    all at once.

## How to draw one well

- **A diagram waits to be played.** Motion beside text pulls the eye off
  the text, so a picture that says how long it `plays` rests as its still,
  dimmed, with a Play button; pressed, it moves for that long, and rests
  again (`src/components/Picture.astro`, `src/app/play.ts`). Give `plays`
  the moment the moving picture looks as the still does: a story's loop
  is `loop.clears.from`. The build reads it from the picture's own file,
  so the config says nothing about it. Without JavaScript the button is a
  link to the moving file. A picture where little moves leaves `plays`
  out and moves all the time: a marker that pulses on a map isn't worth a
  press. A site with either needs `strings.play` and `strings.pause`.
- **Move things, not words.** A dot along a line, a card up a list, a box
  that lights as something reaches it. Text that fades in a row at a time
  is a list: a `flow` or a paragraph says it better, and without motion.
- **The motion is SVG's own** (`<animate>`, `<animateMotion>`), which runs
  in an `<img>`: the page needs no script for it and its security policy
  allows nothing new. So a diagram has no `<style>`, `<script>`, `class`
  or file of another's (`tests/diagrams.test.ts` says so).
- **Every motion lasts the whole loop.** Say when a thing happens in
  seconds into the loop (`loop.shown(2, 5)`), never with a length of its
  own, or the parts drift apart. Make the loop's end meet its start: what
  resets does it out of sight (a story's loop does this for what's put on
  it).
- **Draw each shape the way it rests.** The file ending `-still.svg` is
  the same shapes without their motion (the image's `still`; a test says
  if it's missing). It's what a played picture shows before and after it
  plays, so most of the time, and what a visitor who has asked their
  computer for less motion sees of one that moves all the time. It should
  read as a finished diagram. What only passes through is `onlyWhenMoving`
  (what's `loop.carried`, a `traveller`, a `ripple` and a `light` already
  are).
- **Big and few words.** It's shown about 700 px wide on a desktop and 340
  on a phone: draw it 1600 wide, with text at 32 or more. It's drawn in
  the visitor's own font, so leave room around text (`textWidth`
  estimates it).
- **Each language's words are in `words`.** The first language's files
  are named for the diagram, and another's have its code after the name
  (`-ja`).
- **What two diagrams draw goes in a part:** a file in a folder inside
  `diagrams/`, named for what it draws, with a header that says which
  diagrams use it. What any diagram might need goes in the kit instead. A
  change to either shouldn't change a picture it wasn't meant to:
  `npm run diagrams -- --check` names the files that would change.
- **Say what moves.** `alt` says what the picture shows and what moves in
  it, for someone who can't see it. A picture is an illustration: Ask and
  llms.txt read only its caption, so a fact belongs in the answer's text
  too.
