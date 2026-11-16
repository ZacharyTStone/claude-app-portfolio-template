/* Which played picture plays by itself, and when. Each has one turn: the
   first time most of it is on screen, it plays once (play.ts). One that
   comes on screen while another plays waits for it to stop by itself, and
   then plays if most of it is on screen still; if it has gone by then, it
   plays the next time it's back. A press is the visitor's say: the picture
   pressed has had its turn, and never plays by itself. It needs no page. */

/** How much of a picture has to be on screen for it to play by itself, as a
    share of it; or else, for one too tall to show that much of, how much of
    the screen it has to fill. */
export const MOSTLY_ON_SCREEN = 0.7;

/** The shares of a picture on screen at which the browser says how much of
    it is: every tenth, so that one taller than the screen is seen filling
    it in good time. */
export const SHARES_TO_TELL = Array.from({ length: 11 }, (_, tenths) => tenths / 10);

/** What the browser says of how much of a picture is on screen: an
    IntersectionObserverEntry has these. */
export type Sighting = {
  readonly isIntersecting: boolean;
  /** The share of the picture that's on screen, from 0 to 1. */
  readonly intersectionRatio: number;
  /** The part of it that's on screen. */
  readonly intersectionRect: { readonly height: number };
  /** The screen, if the browser says. */
  readonly rootBounds: { readonly height: number } | null;
};

/** Whether most of a picture is on screen. Without the screen's size, only
    the share of the picture counts. */
export function isMostlyOnScreen(sighting: Sighting): boolean {
  if (!sighting.isIntersecting) return false;
  const screen = sighting.rootBounds;
  const fillsTheScreen = screen !== null && sighting.intersectionRect.height >= screen.height * MOSTLY_ON_SCREEN;
  return sighting.intersectionRatio >= MOSTLY_ON_SCREEN || fillsTheScreen;
}

export type Turns<Picture> = {
  /** Says whether most of a picture is on screen now. */
  seen(picture: Picture, mostlyOnScreen: boolean): void;
  /** The picture whose turn it is, if one is waiting: of those mostly on
      screen that haven't had theirs, the first to have come there. */
  next(): Picture | undefined;
  /** A picture has had its turn, by itself or by a press: it never plays by
      itself from now on. */
  taken(picture: Picture): void;
};

/** Every picture's turn, from the start: none has had one. */
export function takingTurns<Picture extends object>(): Turns<Picture> {
  // A picture that's gone from the page (a chat's, once the chat is) is
  // forgotten here too.
  const hadTheirTurn = new WeakSet<Picture>();
  /** In the order they came on screen. */
  const waiting = new Set<Picture>();
  return {
    seen(picture, mostlyOnScreen) {
      if (mostlyOnScreen && !hadTheirTurn.has(picture)) waiting.add(picture);
      else waiting.delete(picture);
    },
    next: () => waiting.values().next().value,
    taken(picture) {
      hadTheirTurn.add(picture);
      waiting.delete(picture);
    },
  };
}
