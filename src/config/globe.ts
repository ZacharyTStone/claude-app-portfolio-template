/* The site's `globe`: behind the home screen's text, a globe that turns to
   your city. */

/** A place on the globe, in degrees: north of the equator and east of
    Greenwich are above 0. A map app shows both when you press and hold a
    place, latitude first: Tokyo is { latitude: 35.69, longitude: 139.69 }. */
export type Place = {
  /** How far north of the equator, from -90 to 90: south is below 0. */
  latitude: number;
  /** How far east of Greenwich, from -180 to 180: west is below 0. */
  longitude: number;
};

/** The globe the home screen draws behind its text, once it shows: it
    turns to `here`, your city, and marks it. With `from`, a line draws to
    it from there as it turns. Your name is over the mark, and each
    language's `home.place` beside it. Only the script draws it; with
    motion reduced it shows already turned. */
export type Globe = {
  /** Your city, which the globe turns to and marks. */
  here: Place;
  /** Where a line to your city starts: where you're from. Leave out for
      none. */
  from?: Place;
};
