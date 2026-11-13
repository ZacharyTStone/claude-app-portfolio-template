import { aroundOrigin, box, svgOf, type Attributes, type Shape } from "../../../scripts/diagram.ts";

const MOTION_TAG = /^animate|^set$/;

/** The attributes of each motion a shape has on it, in order. */
export function motionsOn(target: Shape): Attributes[] {
  return target.children.flatMap((child) =>
    typeof child !== "string" && MOTION_TAG.test(child.tag) ? [child.attributes] : [],
  );
}

/** A picture of these shapes, as a file's text. */
export function pictureOf(shapes: Shape[], how: "moving" | "still"): string {
  return svgOf({ width: 100, height: 100, shapes }, how);
}

/** A box to put motion on, or to carry. */
export const aBox = (): Shape => box(aroundOrigin(10, 6));

export const A_PATH = "M0 0 L10 0";
