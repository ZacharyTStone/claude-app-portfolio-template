/* The site's `globe`: under the home screen's text, a globe that turns to where you are. */

/** A place, in degrees: its longitude (east of Greenwich, so the Americas
    are below 0), then its latitude (south of the equator is below 0).
    Fukushima is [140.47, 37.75]. */
export type Coordinates = readonly [longitude: number, latitude: number];

/** The globe the home screen draws under its text, once it shows: it turns
    to `here` as a line draws to it from `from`, then marks it with the time
    there (the site's `timezone`) and each language's `home.place`. Only the
    script draws it, and a visitor who asks for less motion sees it still. */
export type Globe = {
  /** Where you are, which the globe turns to and marks. */
  here: Coordinates;
  /** Where the line it draws starts: where you're from. Leave out for none. */
  from?: Coordinates;
};
