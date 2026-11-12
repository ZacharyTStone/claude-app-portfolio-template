/* Dragging something by a handle: the sidebar's edge, a panel section's
   grip. */

/** Follows the pointer that went down on `handle` until it's lifted, or the
    browser takes it away (pointercancel): `onMove` for each move, then
    `onEnd` once. The handle captures the pointer, so it keeps hearing about
    it wherever it goes, even as the page moves under it. */
export function followPointer(
  handle: HTMLElement,
  down: PointerEvent,
  onMove: (move: PointerEvent) => void,
  onEnd: () => void,
): void {
  // The drag's listeners are all taken off again, together, when it ends.
  const drag = new AbortController();
  const untilItEnds = { signal: drag.signal };
  const end = () => {
    drag.abort();
    onEnd();
  };
  handle.setPointerCapture(down.pointerId);
  handle.addEventListener("pointermove", onMove, untilItEnds);
  handle.addEventListener("pointerup", end, untilItEnds);
  handle.addEventListener("pointercancel", end, untilItEnds);
}
