/* The globe turns under a drag, as if held: across turns it east and west,
   and up and down tilts it, a little. Let go mid-drag and it keeps turning,
   slowing to a stop, unless motion is reduced. */
import { isMotionReduced } from "../lib/motion.ts";

/** A turn, in degrees: of longitude, and of tilt. */
export type Turned = { longitude: number; tilt: number };

/** How much a turn slows each frame once let go, and the slowest it keeps
    going at, in degrees a frame. */
const SLOWS_TO = 0.955;
/** How much further than the pointer a drag turns it: a little more than
    held, so a flick spins it. */
const SENSITIVITY = 1.6;
const STOPS_BELOW = 0.02;

type Spinning = {
  /** Degrees a pixel of drag turns the globe, at its size now. */
  degreesPerPixel: () => number;
  /** Whether a press there takes hold of the globe. */
  isOnGlobe: (event: PointerEvent) => boolean;
  /** The globe turned by this much: draw it again. */
  turn: (by: Turned) => void;
};

/** Lets `area` turn the globe. */
export function makeSpinnable(area: HTMLElement, spinning: Spinning): void {
  let last: PointerEvent | null = null;
  let velocity: Turned = { longitude: 0, tilt: 0 };
  area.addEventListener("pointerdown", (event) => {
    if (!spinning.isOnGlobe(event)) return;
    area.setPointerCapture(event.pointerId);
    [last, velocity] = [event, { longitude: 0, tilt: 0 }];
  });
  area.addEventListener("pointermove", (event) => {
    if (!last) return;
    const perPixel = spinning.degreesPerPixel() * SENSITIVITY;
    velocity = {
      longitude: -(event.clientX - last.clientX) * perPixel,
      tilt: (event.clientY - last.clientY) * perPixel,
    };
    spinning.turn(velocity);
    last = event;
  });
  const letGo = () => {
    if (!last) return;
    last = null;
    if (!isMotionReduced()) coast(velocity, spinning.turn);
  };
  area.addEventListener("pointerup", letGo);
  area.addEventListener("pointercancel", letGo);
}

/** Keeps turning by `velocity`, slower each frame, until it stops. */
function coast(velocity: Turned, turn: (by: Turned) => void): void {
  let { longitude, tilt } = velocity;
  const frame = () => {
    [longitude, tilt] = [longitude * SLOWS_TO, tilt * SLOWS_TO];
    if (Math.abs(longitude) < STOPS_BELOW && Math.abs(tilt) < STOPS_BELOW) return;
    turn({ longitude, tilt });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
