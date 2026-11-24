/* Once it has landed, the globe turns slowly by itself, east as the Earth
   does, until a visitor takes hold of it, and carries on a moment after
   they let go; while it rests it's still drawn each frame, for its lights
   and its spark. Not with motion reduced, and not while the home screen is
   hidden. */
import { isMotionReduced } from "../lib/motion.ts";

/** How fast it turns by itself, in degrees of longitude a second. */
const DEGREES_PER_SECOND = 4;
/** How long it rests after a visitor last turned it. */
const RESTS_AFTER_TURN_MS = 2500;
/** The most one frame turns it, after the page has been in the background. */
const LONGEST_FRAME_MS = 100;

type Drifting = {
  /** Whether the globe is on screen to be drawn. */
  isShowing: () => boolean;
  /** When a visitor last turned it (performance.now()), or 0. */
  lastTurnedAt: () => number;
  /** Turns it by this many degrees of longitude (none while it rests), and
      draws it. */
  turn: (degrees: number) => void;
};

/** Starts the drift, and says whether it did: not with motion reduced. */
export function drift(drifting: Drifting): boolean {
  if (isMotionReduced()) return false;
  let last = performance.now();
  const frame = (now: number): void => {
    const elapsed = Math.min(now - last, LONGEST_FRAME_MS);
    last = now;
    const isResting = now - drifting.lastTurnedAt() < RESTS_AFTER_TURN_MS;
    // East: the face turns to the right, so the view's longitude goes down.
    if (drifting.isShowing()) drifting.turn(isResting ? 0 : (-DEGREES_PER_SECOND * elapsed) / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return true;
}
