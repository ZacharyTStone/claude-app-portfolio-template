/* The diagram kit's one entry: every site's diagrams import from this file, and nothing else imports the
   modules beside it. A name that leaves here leaves every site's diagrams without it. */
export { COLOR, FONT } from "./diagram/palette.ts";
export { aroundOrigin, centreOf, rightOf, type Place, type Point } from "./diagram/places.ts";
export { PLAYS_ATTRIBUTE, rounded, shape, svgOf, type Attributes, type Drawing, type Shape } from "./diagram/svg.ts";
export {
  arrowhead,
  ARROWHEAD_LENGTH,
  bar,
  box,
  dot,
  dots,
  group,
  label,
  line,
  moving,
  onlyWhenMoving,
  placed,
} from "./diagram/shapes.ts";
export { arc, levelCurve } from "./diagram/paths.ts";
export { baselineAround, sizeToFit, textWidth } from "./diagram/text.ts";
export { loopOf, type Loop } from "./diagram/loop.ts";
export { EASE, type Frame, type Pace } from "./diagram/loop/values.ts";
