/** A point in the picture, in its own units from the top left. */
export type Point = { x: number; y: number };

/** A rectangle in the picture: its top left corner and its size. */
export type Place = Point & { width: number; height: number };

export const centreOf = (place: Place): Point => ({ x: place.x + place.width / 2, y: place.y + place.height / 2 });

/** How far across the picture a rectangle's right edge is. */
export const rightOf = (place: Place): number => place.x + place.width;

/** A rectangle of a size around (0, 0), for a shape that's scaled, turned or carried about its own middle
    (`placed` puts it where it goes). */
export const aroundOrigin = (width: number, height: number): Place => ({
  x: -width / 2,
  y: -height / 2,
  width,
  height,
});
