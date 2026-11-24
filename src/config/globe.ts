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
    it from there as it turns; with each language's `home.place`, the mark
    has the city's name and the time there (the site's `timezone`). Only the
    script draws it; with motion reduced it shows already turned. */
export type Globe = {
  /** Your city, which the globe turns to and marks. */
  here: Place;
  /** Where a line to your city starts: where you're from. Leave out for
      none. */
  from?: Place;
  /** Visitors on the globe (Cloudflare only: its Worker counts them). Each
      sees roughly where they are, with their own time, and dots where the
      site's visitors have come from, each to the nearest whole degree and
      counted once a day; no address is kept. Leave out for none. */
  visitors?: true;
  /** Places visitors came from before the Worker counted them (from your
      host's analytics, say), each with how many came: dots on the globe
      with those it counts, whether or not `visitors` is on. Leave out for
      none. */
  seed?: SeedPlace[];
};

/** A place visitors came from, and how many: { latitude: 35.68,
    longitude: 139.69, visits: 66 }. */
type SeedPlace = Place & {
  /** How many visitors came from there: a whole number above 0. */
  visits: number;
};
