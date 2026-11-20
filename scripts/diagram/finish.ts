/* The finish every picture has, so it reads as an illustration rather than
   flat boxes, in its still as much as when it moves. Nothing in a diagram
   asks for it: svgOf puts the light and the definitions in every picture
   (svg.ts), and box() lifts and lights its own surfaces (shapes.ts).

   - A faint warm light falls from the top of the picture, the accent's
     colour, so the ground isn't one flat grey.
   - A surface (a box, a panel, a window, a card) big enough to be a thing
     of its own sits a little above the ground: a soft shadow falls under
     it. A chip, a bar or a small step stays flat, so the picture doesn't
     turn to soot.
   - An outlined surface's top edge catches the light: its outline is
     brightest along the top and fades down its sides. A highlighted one
     (the accent's) keeps its colour.

   Nothing here changes a fill, so a box drawn in two pieces of the same
   colour (a window and its bar) never shows a seam. All of it is SVG's own
   gradients and filters, named from inside the picture (`url(#…)`).

   The motion has its finish where the motion is: a pop springs and a small
   one of the accent's sparks (loop/arriving.ts), and a traveller leaves a
   trail (loop/passing.ts). */
import { COLOR } from "./palette.ts";
import type { Place } from "./places.ts";

/** What each of the finish's definitions is called, inside the picture. */
export const FINISH_ID = {
  light: "finish-light",
  lift: "finish-lift",
  rim: "finish-rim",
  warmRim: "finish-warm-rim",
} as const;

/** The light from the top: the accent at this opacity where it's brightest, fading to nothing this far down. */
export const LIGHT = { opacity: 0.1, reach: "70%" } as const;
/** A surface's shadow: how far below it falls, how soft, and how dark. */
export const SHADOW = { down: 10, soft: 14, opacity: 0.42 } as const;
/** An outline's colours, from its top edge down: a plain one's, and a highlighted one's. */
export const RIMS: Record<typeof FINISH_ID.rim | typeof FINISH_ID.warmRim, ReadonlyArray<[string, string]>> = {
  [FINISH_ID.rim]: [
    ["0", "#6a6a6a"],
    ["0.3", COLOR.boxLine],
    ["1", "#323232"],
  ],
  [FINISH_ID.warmRim]: [
    ["0", "#a0664f"],
    ["0.3", COLOR.accentLine],
    ["1", "#55362a"],
  ],
};

/** The smallest surface with a shadow of its own. */
const LIFTED = { width: 100, height: 60 } as const;
/** The surfaces' colours: a box, a panel, a highlighted box and what's inside it. */
const SURFACES = new Set<string>([COLOR.box, COLOR.panel, COLOR.accentBox, COLOR.accentInner]);
/** Which outline is lit with which rim. */
const RIM_OF = new Map<string, string>([
  [COLOR.boxLine, FINISH_ID.rim],
  [COLOR.accentLine, FINISH_ID.warmRim],
]);

/** What a box of this place, fill, outline and roundness takes from the finish: its outline's colour (lit
    along the top, if it's one the finish lights), and a shadow under it, if it's a surface big enough. */
export function surfaceLook(
  at: Place,
  look: { fill: string; line: string; radius: number },
): { stroke: string; filter?: string } {
  const rim = RIM_OF.get(look.line);
  const lifted = SURFACES.has(look.fill) && look.radius > 0 && at.width >= LIFTED.width && at.height >= LIFTED.height;
  return { stroke: rim ? `url(#${rim})` : look.line, ...(lifted ? { filter: `url(#${FINISH_ID.lift})` } : {}) };
}
